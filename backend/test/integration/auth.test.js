import { describe, it, expect } from 'vitest';
import { request, app, unique, registerUser, PASSWORD } from '../helpers.js';

describe('POST /api/auth/register', () => {
  it('crea un account e ritorna un token utilizzabile', async () => {
    const username = unique('reg');
    const res = await request(app).post('/api/auth/register').send({ username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.username).toBe(username);
  });

  it('rifiuta uno username già in uso', async () => {
    const { username } = await registerUser('dup');
    const res = await request(app).post('/api/auth/register').send({ username, password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it('rifiuta username/password mancanti', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: unique('u') });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('accetta credenziali corrette', async () => {
    const { username } = await registerUser('login');
    const res = await request(app).post('/api/auth/login').send({ username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rifiuta una password sbagliata', async () => {
    const { username } = await registerUser('login');
    const res = await request(app).post('/api/auth/login').send({ username, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rifiuta uno username inesistente', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: unique('ghost'), password: PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('token JWT', () => {
  it('un token valido dà accesso a una route autenticata (GET /api/groups/mine)', async () => {
    const { token } = await registerUser('tok');
    const res = await request(app).get('/api/groups/mine').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('nessun token → 401', async () => {
    const res = await request(app).get('/api/groups/mine');
    expect(res.status).toBe(401);
  });

  it('token manomesso → 401', async () => {
    const { token } = await registerUser('tok');
    const res = await request(app)
      .get('/api/groups/mine')
      .set('Authorization', `Bearer ${token.slice(0, -3)}xyz`);
    expect(res.status).toBe(401);
  });
});
