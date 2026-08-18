// Validazione input account. Ritornano un CODICE errore (stringa costante,
// es. "PASSWORD_TOO_SHORT" — tradotta lato client, vedi frontend/src/locales/)
// oppure null se il valore è valido. Fino a quando anche le altre route non
// vengono migrate allo stesso pattern, il resto del backend continua a
// restituire frasi italiane dirette — il frontend gestisce entrambi i casi
// (vedi lib/apiError.js).

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateUsername(username) {
  if (typeof username !== 'string' || !username.trim()) return 'USERNAME_REQUIRED';
  if (!USERNAME_RE.test(username)) return 'USERNAME_INVALID';
  return null;
}

function validateEmail(email) {
  if (typeof email !== 'string' || !email.trim()) return 'EMAIL_REQUIRED';
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'EMAIL_INVALID';
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || !password) return 'PASSWORD_REQUIRED';
  if (password.length < 8) return 'PASSWORD_TOO_SHORT';
  if (password.length > 128) return 'PASSWORD_TOO_LONG';
  return null;
}

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : email);

module.exports = { validateUsername, validateEmail, validatePassword, normalizeEmail, USERNAME_RE, EMAIL_RE };
