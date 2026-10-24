'use strict';
// Loaded before test imports: never ask Node to format a DOM assertion diff.
const assert = require('node:assert');
const strict = require('node:assert/strict');
const {isDeepStrictEqual} = require('node:util');
const {syncBuiltinESMExports} = require('node:module');
const childProcess = require('node:child_process');
const object = value => value !== null && (typeof value === 'object' || typeof value === 'function');
function fail(operator, message) {
  const error = new Error('Assertion failed (' + operator + '). ' + (typeof message === 'string' ? message.slice(0, 500) : 'Compare primitive values or short summaries; object dumps are disabled.'));
  error.name = 'AssertionError';
  throw error;
}
for (const api of [assert, strict]) {
  for (const name of ['equal','strictEqual','notEqual','notStrictEqual']) {
    api[name] = function(actual, expected, message) {
      const loose = api === assert && (name === 'equal' || name === 'notEqual');
      const same = loose ? actual == expected : Object.is(actual, expected);
      if (name.startsWith('not') ? same : !same) fail(name, message);
    };
  }
  for (const name of ['deepEqual','deepStrictEqual','notDeepEqual','notDeepStrictEqual']) {
    api[name] = function(actual, expected, message) {
      if (api === assert && (name === 'deepEqual' || name === 'notDeepEqual')) {
        throw new Error('Use node:assert/strict for structured comparisons in A45 checks.');
      }
      // Compare without ever constructing Node's AssertionError or object diff.
      const same = isDeepStrictEqual(actual, expected);
      if (name.startsWith('not') ? same : !same) fail(name, message);
    };
  }
}
const brief = value => typeof value === 'string' ? value.slice(0, 2000) : object(value) ? '[Object output suppressed; log a primitive summary]' : String(value);
for (const name of ['log','info','warn','error','debug','dir','dirxml','table','trace']) {
  console[name] = (...args) => process[name === 'error' || name === 'warn' ? 'stderr' : 'stdout'].write(args.slice(0, 8).map(brief).join(' ').slice(0, 2048) + '\n');
}
function fatal(error) {
  // Do not print error.actual/error.expected, cause chains, or the default object dump.
  const message = typeof error?.message === 'string' ? error.message.slice(0, 1200) : 'Unknown error';
  const stack = typeof error?.stack === 'string' ? error.stack.split('\n').slice(1, 7).map(line => line.slice(0, 240)).join('\n') : '';
  process.stderr.write('FAIL: ' + message + '\n' + stack + '\n');
  process.exit(1);
}
process.on('uncaughtException', fatal);
process.on('unhandledRejection', fatal);
// All descendants must remain in the supervised process group.
for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) {
  const original = childProcess[name];
  childProcess[name] = function(...args) {
    if (args.some(arg => arg && typeof arg === 'object' && !Array.isArray(arg) && arg.detached)) throw new Error('Detached child processes are forbidden in automatic checks.');
    return Reflect.apply(original, this, args);
  };
}
syncBuiltinESMExports();
