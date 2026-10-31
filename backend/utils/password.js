'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const OPTIONS = Object.freeze({ N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
const HASH_PATTERN = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
// Not a usable account password: used only to preserve the expensive workload
// for an unknown account or a malformed historical hash.
const DUMMY_HASH = 'scrypt$32768$8$3$' + '0'.repeat(32) + '$' + '0'.repeat(128);

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || Buffer.byteLength(password, 'utf8') > 512) {
    const error = new Error('A senha deve ter entre 12 e 128 caracteres.');
    error.status = 400;
    error.publicMessage = error.message;
    throw error;
  }
  return password;
}

async function hashPassword(password) {
  validatePassword(password);
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, OPTIONS);
  return 'scrypt$32768$8$3$' + salt.toString('hex') + '$' + hash.toString('hex');
}

async function verifyPassword(password, storedHash) {
  const bounded = typeof password === 'string' && password.length <= 128 && Buffer.byteLength(password, 'utf8') <= 512;
  const original = typeof storedHash === 'string' ? HASH_PATTERN.exec(storedHash) : null;
  const parsed = original || HASH_PATTERN.exec(DUMMY_HASH);
  const candidate = await scrypt(bounded ? password : 'invalid-password-input', Buffer.from(parsed[1], 'hex'), 64, OPTIONS);
  const matches = crypto.timingSafeEqual(candidate, Buffer.from(parsed[2], 'hex'));
  return Boolean(original && bounded && matches);
}

module.exports = { hashPassword, verifyPassword, validatePassword };
