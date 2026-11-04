const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-secret';
const { signSession } = require('./tokens');

test('session token carries id, role and token_version', () => {
  const payload = jwt.verify(signSession({ id: 'u1', email: 'a@b.c', token_version: 3 }, 'driver'), 'test-secret');
  assert.equal(payload.id, 'u1');
  assert.equal(payload.role, 'driver');
  assert.equal(payload.tv, 3);
});

test('a token signed with another secret is rejected', () => {
  const token = signSession({ id: 'u1', email: 'a@b.c', token_version: 0 }, 'driver');
  assert.throws(() => jwt.verify(token, 'fulmile_jwt_secret_change_in_prod'));
});
