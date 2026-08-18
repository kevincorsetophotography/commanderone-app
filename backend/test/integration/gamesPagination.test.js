// GET /api/groups/:slug/games: array completo (comportamento storico) senza
// query params, pagina + metadati con ?page/?pageSize (vedi CLAUDE.md roadmap
// "Paginazione GET /api/groups/:slug/games").
import { describe, it, expect, beforeAll } from 'vitest';
import { request, app, unique, registerUser, createGroup } from '../helpers.js';

describe('GET /api/groups/:slug/games', () => {
  let token, slug;

  beforeAll(async () => {
    const owner = await registerUser('pag');
    const group = await createGroup(owner.token, unique('Gruppo pag '));
    token = owner.token;
    slug = group.slug;

    // Le partite richiedono 3-5 giocatori distinti (validateGamePayload):
    // altri due utenti nello stesso gruppo, un mazzo a testa.
    const p2 = await registerUser('pag2');
    const p3 = await registerUser('pag3');
    await request(app).post('/api/groups/join').set('Authorization', `Bearer ${p2.token}`).send({ inviteCode: group.inviteCode });
    await request(app).post('/api/groups/join').set('Authorization', `Bearer ${p3.token}`).send({ inviteCode: group.inviteCode });

    const players = [];
    for (const u of [owner, p2, p3]) {
      const deckRes = await request(app)
        .post(`/api/groups/${slug}/decks`)
        .set('Authorization', `Bearer ${u.token}`)
        .send({ name: `Mazzo di ${u.username}` });
      players.push({ userId: u.user.id, deckId: deckRes.body.id });
    }

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post(`/api/groups/${slug}/games`)
        .set('Authorization', `Bearer ${token}`)
        .send({ players, winnerId: players[0].userId, winnerDeckId: players[0].deckId });
      if (res.status !== 200) throw new Error(`setup partita fallito: ${JSON.stringify(res.body)}`);
    }
  });

  it('senza query params ritorna l\'array completo (comportamento invariato)', async () => {
    const res = await request(app).get(`/api/groups/${slug}/games`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);
  });

  it('con ?page/?pageSize ritorna una pagina con metadati', async () => {
    const res = await request(app)
      .get(`/api/groups/${slug}/games?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.games.length).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.totalPages).toBe(3);
  });

  it('le pagine non si sovrappongono e coprono tutti i risultati', async () => {
    const p1 = await request(app).get(`/api/groups/${slug}/games?page=1&pageSize=2`).set('Authorization', `Bearer ${token}`);
    const p2 = await request(app).get(`/api/groups/${slug}/games?page=2&pageSize=2`).set('Authorization', `Bearer ${token}`);
    const p3 = await request(app).get(`/api/groups/${slug}/games?page=3&pageSize=2`).set('Authorization', `Bearer ${token}`);

    const ids = [...p1.body.games, ...p2.body.games, ...p3.body.games].map(g => g.id);
    expect(new Set(ids).size).toBe(5); // nessun duplicato
    expect(p3.body.games.length).toBe(1); // ultima pagina parziale (5 = 2+2+1)
  });

  it('pageSize è limitato a 100 anche se ne viene chiesto di più', async () => {
    const res = await request(app)
      .get(`/api/groups/${slug}/games?page=1&pageSize=9999`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.pageSize).toBe(100);
  });
});
