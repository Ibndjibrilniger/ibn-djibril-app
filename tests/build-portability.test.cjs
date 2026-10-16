'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lock = require('../package-lock.json');

test('locked public dependencies remain downloadable outside the Replit network', () => {
  const dependencies = Object.entries(lock.packages).filter(([name]) => name);
  assert.ok(dependencies.length > 0, 'The lockfile must contain dependencies');
  for (const [name, dependency] of dependencies) {
    assert.ok(dependency.resolved, `${name}: missing tarball URL`);
    const url = new URL(dependency.resolved);
    assert.equal(url.protocol, 'https:', `${name}: use HTTPS`);
    assert.equal(url.hostname, 'registry.npmjs.org',
      `${name}: keep public npm URLs in the committed lockfile, not workspace-internal registry URLs`);
    assert.ok(dependency.integrity, `${name}: preserve tarball integrity verification`);
  }
});
