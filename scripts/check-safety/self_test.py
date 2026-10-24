#!/usr/bin/env python3
"""Only tiny synthetic fixtures; never imports application tests, WASM DB, or Chrome."""
import contextlib
import io
from pathlib import Path
import signal
import tempfile
import time
import run as safety


def expect_stop(path, code, expected, **limits):
    path.write_text(code)
    try:
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            safety.run_check([str(path)], **limits)
    except safety.SafetyFailure as error:
        if expected not in str(error):
            raise AssertionError(f'Expected {expected!r}, received {str(error)!r}') from error
        captured = output.getvalue()
        if 'actual - expected' in captured or 'UNSAFE FORMATTER' in captured:
            raise AssertionError('Unsafe assertion formatter was reached')
        print('VERIFIED: ' + expected, flush=True)
    else:
        raise AssertionError('Fixture should have been stopped: ' + expected)


def main():
    safety.acquire_lock()
    def deadline(sig, frame):
        raise safety.SafetyFailure('Safety self-test deadline reached.')
    signal.signal(signal.SIGALRM, deadline)
    signal.signal(signal.SIGINT, deadline)
    signal.signal(signal.SIGTERM, deadline)
    signal.alarm(25)
    try:
        safety.process_snapshot()  # Stop before any fixture if monitoring is unavailable.
        with tempfile.TemporaryDirectory(prefix='a45-safety-') as directory:
            fixture = Path(directory) / 'fixture.cjs'
            fixture.write_text("const v8=require('node:v8'); if(v8.getHeapStatistics().heap_size_limit>300*1024*1024)throw Error('Heap cap missing'); console.log('Heap cap active');")
            safety.run_check([str(fixture)], timeout=3)
            # A formatter that would explode if Node tries to inspect an assertion value.
            expect_stop(fixture, "const a=require('node:assert/strict'),u=require('node:util');const value={};value.self=value;value[u.inspect.custom]=()=>{throw Error('UNSAFE FORMATTER');};a.equal(value,null);", 'code 1', timeout=3)
            expect_stop(fixture, "const a=require('node:assert/strict'),u=require('node:util');const value={};value[u.inspect.custom]=()=>{throw Error('UNSAFE FORMATTER');};a.deepEqual({value},{value:null});", 'code 1', timeout=3)
            expect_stop(fixture, 'while(true){}', 'Timeout', timeout=.3)
            # Trigger monitoring with a deliberately tiny limit, without allocating memory.
            expect_stop(fixture, 'setInterval(()=>{},1000)', 'Memory limit', timeout=3, rss_mb=1)
            expect_stop(fixture, "process.stdout.write('x'.repeat(4096));setInterval(()=>{},1000)", 'Output limit', timeout=3, output_limit=1024)
            expect_stop(fixture, "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true});", 'code 1', timeout=3)
            pid_file = Path(directory) / 'child.pid'
            child_code = "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"
            code = "const c=require('node:child_process').spawn(process.execPath,['-e'," + repr(child_code) + "],{stdio:'ignore'});require('node:fs').writeFileSync(" + repr(str(pid_file)) + ",String(c.pid));setTimeout(()=>process.exit(0),150);"
            expect_stop(fixture, code, 'left child processes', timeout=3)
            pid = int(pid_file.read_text())
            if any(row[0] == pid and not row[3].startswith('Z') for row in safety.process_snapshot()):
                raise AssertionError('Synthetic child survived cleanup')
            # The exclusive lock prevents even a second supervisor from starting.
            try:
                safety.acquire_lock()
            except safety.SafetyFailure:
                print('VERIFIED: concurrent launch refused')
            else:
                raise AssertionError('Concurrent lock accepted')
        print('PASS: safety fixtures only; no application suite, database, browser, or build executed.')
    finally:
        signal.alarm(0)
        safety.LOCK.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        main()
    except (safety.SafetyFailure, AssertionError) as error:
        print('STOP: ' + str(error))
        raise SystemExit(1)
