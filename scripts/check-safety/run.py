#!/usr/bin/env python3
"""Sequential, fail-closed supervisor. Does not import or execute application tests."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import resource
import selectors
import shutil
import signal
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
PRELOAD = Path(__file__).with_name('preload.cjs')
SUITES = json.loads(Path(__file__).with_name('suites.json').read_text())
HEAP_MB = 256
RSS_MB = 512  # Aggregate process-group RSS, including native/WASM/browser memory.
TIMEOUT = 60
SUITE_TIMEOUT = 600
OUTPUT_BYTES = 64 * 1024
LOCK = Path(tempfile.gettempdir()) / ('a45-checks-' + hashlib.sha256(str(ROOT).encode()).hexdigest()[:16] + '.lock')

class SafetyFailure(Exception):
    pass

def process_snapshot():
    try:
        result = subprocess.run(['/bin/ps', '-axo', 'pid=,pgid=,rss=,stat='], capture_output=True, text=True, timeout=1, check=True)
        rows = []
        for line in result.stdout.splitlines():
            pid, group, rss, state = line.split()
            rows.append((int(pid), int(group), int(rss), state))
        return rows
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        raise SafetyFailure('Cannot monitor process memory/cleanup; checks refused (ps unavailable or denied).') from error

def group_members(group):
    return [row for row in process_snapshot() if row[1] == group and not row[3].startswith('Z')]

def terminate_group(proc):
    # Even a successfully exited test can leave a browser or esbuild service alive.
    monitoring_failed = False
    for sig, grace in [(signal.SIGTERM, .4), (signal.SIGKILL, 1.0)]:
        try:
            os.killpg(proc.pid, sig)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + grace
        while time.monotonic() < deadline:
            proc.poll()  # Reap the direct child; zombies do not consume RSS.
            try:
                remaining = group_members(proc.pid)
            except SafetyFailure:
                monitoring_failed = True
                break  # Still send SIGKILL even when the monitor becomes unavailable.
            if not remaining:
                if monitoring_failed:
                    raise SafetyFailure('Process monitor failed during cleanup; suite stopped.')
                return
            time.sleep(.05)
    if monitoring_failed:
        raise SafetyFailure('Process monitor unavailable during cleanup; group received SIGTERM and SIGKILL, cleanup could not be verified.')
    raise SafetyFailure('Child processes remain after SIGKILL; no further checks will run.')

def child_limits():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))

def run_check(args, *, timeout=TIMEOUT, rss_mb=RSS_MB, output_limit=OUTPUT_BYTES):
    process_snapshot()  # Fail before launching anything when monitoring is unavailable.
    node = shutil.which('node')
    if not node:
        raise SafetyFailure('Node.js is unavailable.')
    env = os.environ.copy()
    # Do not accept inherited flags that can disable the heap cap or safety preload.
    env['NODE_OPTIONS'] = f'--max-old-space-size={HEAP_MB} --max-semi-space-size=8 --require="{PRELOAD}"'
    env['UV_THREADPOOL_SIZE'] = '1'
    env['NO_COLOR'] = '1'
    started = time.monotonic()
    proc = subprocess.Popen([node, *args], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            start_new_session=True, preexec_fn=child_limits)
    selector = selectors.DefaultSelector()
    selector.register(proc.stdout, selectors.EVENT_READ)
    output = 0
    reason = None
    peak = 0
    descendants = False
    try:
        while True:
            members = group_members(proc.pid)
            descendants |= any(row[0] != proc.pid for row in members)
            rss = sum(row[2] for row in members)
            peak = max(peak, rss)
            if rss > rss_mb * 1024:
                reason = f'Memory limit exceeded: process group {rss // 1024} MiB > {rss_mb} MiB.'
                break
            if time.monotonic() - started >= timeout:
                reason = f'Timeout: check exceeded {timeout:g} seconds.'
                break
            for key, _ in selector.select(.05):
                data = os.read(key.fileobj.fileno(), 4096)
                if data:
                    output += len(data)
                    if output > output_limit:
                        reason = f'Output limit exceeded ({output_limit} bytes); dump suppressed.'
                        break
                    # Print at most a bounded chunk; no accumulated page/DOM dumps.
                    sys.stdout.write(data.decode('utf-8', errors='replace'))
                    sys.stdout.flush()
                else:
                    selector.unregister(key.fileobj)
            if reason:
                break
            if proc.poll() is not None:
                # A surviving child is a test failure, even when the test returned 0.
                survivors = group_members(proc.pid)
                if survivors:
                    reason = 'Check exited but left child processes running; terminating the group.'
                    break
                if not selector.get_map():
                    if proc.returncode:
                        reason = f'Check exited with code {proc.returncode} (heap exhaustion or crash also stops the suite).'
                    break
    finally:
        try:
            terminate_group(proc)
        finally:
            selector.close()
            proc.stdout.close()
    if reason:
        raise SafetyFailure(reason)
    print(f'SAFE: peak group RSS {peak // 1024} MiB; child-process cleanup verified' + (' (children observed).' if descendants else '.'))
    return peak

def acquire_lock():
    try:
        descriptor = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise SafetyFailure(f'Another check run or stale safety lock exists: {LOCK}. Concurrent runs are refused. Inspect it before removing.') from error
    os.write(descriptor, str(os.getpid()).encode())
    os.close(descriptor)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--suite', choices=SUITES)
    parser.add_argument('--list', action='store_true')
    parser.add_argument('check', nargs='*', help='One repository .mjs/.cjs/.js file (optional --check for syntax via suites).')
    options = parser.parse_args()
    if options.list:
        print(f'Limits: V8 old heap {HEAP_MB} MiB; aggregate RSS {RSS_MB} MiB; {TIMEOUT}s/check; {SUITE_TIMEOUT}s/suite; output {OUTPUT_BYTES} bytes/check. Sequential only.')
        for name, checks in SUITES.items():
            print(name + ': ' + str(len(checks)) + ' checks')
            for check in checks:
                print('  ' + ' '.join(check))
        return
    if options.suite and options.check:
        parser.error('Choose a suite or a single file.')
    if options.suite:
        checks = SUITES[options.suite]
    elif len(options.check) == 1:
        path = (ROOT / options.check[0]).resolve()
        if not path.is_relative_to(ROOT) or path.suffix not in ('.mjs', '.cjs', '.js') or not path.is_file():
            parser.error('Expected one existing repository JavaScript file.')
        checks = [[str(path)]]
    else:
        parser.error('Use --list, --suite, or one check file.')
    acquire_lock()
    interrupted = lambda sig, frame: (_ for _ in ()).throw(SafetyFailure('Interrupted; stopping active process group.'))
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGTERM, interrupted)
    started = time.monotonic()
    try:
        for check in checks:
            remaining = SUITE_TIMEOUT - (time.monotonic() - started)
            if remaining <= 0:
                raise SafetyFailure('Suite timeout exceeded; no more checks will run.')
            print('CHECK: ' + ' '.join(check), flush=True)
            run_check(check, timeout=min(TIMEOUT, remaining))
    finally:
        LOCK.unlink(missing_ok=True)

if __name__ == '__main__':
    try:
        main()
    except SafetyFailure as error:
        print('STOP: ' + str(error), file=sys.stderr)
        sys.exit(1)
