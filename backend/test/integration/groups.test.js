import { describe, it, expect } from 'vitest';
import { request, app, unique, registerUser, createGroup } from '../helpers.js';

describe('POST /api/groups', () => {
  it('crea un gruppo e il creatore ne diventa ADMIN', async () => {
    const { token } = await registerUser('creator');
    const group = await createGroup(token, unique('Amici del venerdì '));
    expect(group.role).toBe('ADMIN');
    expect(group.slug).toBeTruthy();
    expect(group.inviteCode).toBeTruthy();
  });

  it('rifiuta un nome vuoto', async () => {
    const { token } = await registerUser('creator');
    const res = await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`).send({ name: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/groups/join', () => {
  it('un secondo utente entra col codice invito e diventa PLAYER', async () => {
    const owner = await registerUser('owner');
    const group = await createGroup(owner.token);

    const joiner = await registerUser('joiner');
    const res = await request(app)
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${joiner.token}`)
      .send({ inviteCode: group.inviteCode });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('PLAYER');
    expect(res.body.slug).toBe(group.slug);
  });

  it('rifiuta un codice invito inesistente', async () => {
    const { token } = await registerUser('joiner');
    const res = await request(app)
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ inviteCode: 'CODICE-INESISTENTE' });
    expect(res.status).toBe(404);
  });

  it('un utente non può unirsi due volte allo stesso gruppo', async () => {
    const owner = await registerUser('owner');
    const group = await createGroup(owner.token);
    const joiner = await registerUser('joiner');
    await request(app).post('/api/groups/join').set('Authorization', `Bearer ${joiner.token}`).send({ inviteCode: group.inviteCode });

    const res = await request(app)
      .post('/api/groups/join')
      .set('Authorization', `Bearer ${joiner.token}`)
      .send({ inviteCode: group.inviteCode });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/groups/mine', () => {
  it('un utente in più gruppi li vede tutti, uno per gruppo', async () => {
    const user = await registerUser('multi');
    const groupA = await createGroup(user.token, unique('Gruppo A '));
    const groupB = await createGroup(user.token, unique('Gruppo B '));

    const res = await request(app).get('/api/groups/mine').set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    const slugs = res.body.map(g => g.slug);
    expect(slugs).toContain(groupA.slug);
    expect(slugs).toContain(groupB.slug);
  });

  it('un utente senza gruppi vede un array vuoto', async () => {
    const { token } = await registerUser('lonely');
    const res = await request(app).get('/api/groups/mine').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
