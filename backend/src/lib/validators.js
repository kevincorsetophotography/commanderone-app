// Validazione input account. Ritornano una stringa d'errore (in italiano,
// mostrata direttamente all'utente) oppure null se il valore è valido.

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateUsername(username) {
  if (typeof username !== 'string' || !username.trim()) return 'Username richiesto';
  if (!USERNAME_RE.test(username))
    return 'Username non valido: 3-24 caratteri, solo lettere, numeri, punto, trattino e underscore';
  return null;
}

function validateEmail(email) {
  if (typeof email !== 'string' || !email.trim()) return 'Email richiesta';
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'Email non valida';
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || !password) return 'Password richiesta';
  if (password.length < 8) return 'Password troppo corta (minimo 8 caratteri)';
  if (password.length > 128) return 'Password troppo lunga (max 128 caratteri)';
  return null;
}

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : email);

module.exports = { validateUsername, validateEmail, validatePassword, normalizeEmail, USERNAME_RE, EMAIL_RE };
