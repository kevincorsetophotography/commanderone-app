// Copre esplicitamente il middleware che CLAUDE.md segnala come non testato:
// resolveGroup (membership + 403/404) e, di riflesso, requireGroupAdmin.
import { describe, it, expect } from 'vitest';
import { request, app, unique, registerUser, createGroup } from '../helpers.js';

describe('resolveGroup middleware', () => {
  it('404 su uno slug di gruppo inesistente', async () => {
    const { token } = await registerUser('u');
    const res = await request(app)
      .get('/api/groups/gruppo-che-non-esiste-xyz/decks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('403 se l\'utente non è membro del gruppo', async () => {
    const owner = await registerUser('owner');
    const group = await createGroup(owner.token);
    const outsider = await registerUser('outsider');

    const res = await request(app)
      .get(`/api/groups/${group.slug}/decks`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });

  it('200 e passa req.group/req.membership se l\'utente è membro', async () => {
    const { token } = await registerUser('member');
    const group = await createGroup(token);

    const res = await request(app)
      .get(`/api/groups/${group.slug}/decks`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('richiede comunque autenticazione prima di resolveGroup (401, non 404/403)', async () => {
    const owner = await registerUser('owner');
    const group = await createGroup(owner.token);

    const res = await request(app).get(`/api/groups/${group.slug}/decks`);
    expect(res.status).toBe(401);
  });
});

describe('requireGroupAdmin middleware (via /admin/*)', () => {
  it('un PLAYER non può accedere alle route admin del gruppo', async () => {
    const owner = await registerUser('owner');
    const group = await createGroup(owner.token);
    const player = await registerUser('player');
    await request(app).post('/api/groups/join').set('Authorization', `Bearer ${player.token}`).send({ inviteCode: group.inviteCode });

    const res = await request(app)
      .get(`/api/groups/${group.slug}/admin/export`)
      .set('Authorization', `Bearer ${player.token}`);
    expect(res.status).toBe(403);
  });

  it('l\'ADMIN del gruppo accede alle route admin', async () => {
    const owner = await registerUser('owner');
    const group = await createGroup(owner.token);

    const res = await request(app)
      .get(`/api/groups/${group.slug}/admin/export`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
  });
});
