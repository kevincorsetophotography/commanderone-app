const crypto = require('crypto');

const SLUG_MAX = 40;
// Range combining diacritics U+0300-U+036F (costruito da code point per evitare
// caratteri unicode letterali nel sorgente).
const DIACRITICS_RE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');
// Alfabeto senza caratteri ambigui (0/O, 1/I/L) per codici invito leggibili a voce/scritti a mano.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function slugify(name) {
  return name
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX) || 'gruppo';
}

function randomInviteCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

module.exports = { slugify, randomInviteCode };
