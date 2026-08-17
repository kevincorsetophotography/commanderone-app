// Helper condivisi dai test di integrazione (registrazione + gruppo pronti
// all'uso, senza ripetere il boilerplate in ogni file).
const request = require('supertest');
const app = require('../src/app');

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

const PASSWORD = 'password123';

// Registra un utente nuovo (username sempre univoco) e ritorna token/utente.
async function registerUser(prefix = 'user') {
  const username = unique(prefix);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`registerUser fallita (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { username, password: PASSWORD, token: res.body.token, user: res.body.user };
}

// Crea un gruppo per conto dell'utente (che ne diventa ADMIN).
async function createGroup(token, name) {
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: name || unique('Gruppo ') });
  if (res.status !== 200) {
    throw new Error(`createGroup fallita (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body; // { id, name, slug, inviteCode, role }
}

// Scorciatoia: utente nuovo + gruppo nuovo di cui è ADMIN.
async function registerUserWithGroup(prefix = 'user') {
  const auth = await registerUser(prefix);
  const group = await createGroup(auth.token);
  return { ...auth, group };
}

module.exports = { request, app, unique, registerUser, createGroup, registerUserWithGroup, PASSWORD };
