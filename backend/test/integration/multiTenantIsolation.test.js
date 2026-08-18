// Il cuore della promessa architetturale di CommanderOne (vedi CLAUDE.md,
// "Multi-tenancy"): dati di un gruppo mai visibili da un altro, nemmeno per
// uno stesso utente che è membro di entrambi. Prima di questo file, nessun
// test automatico copriva questa garanzia.
import { describe, it, expect } from 'vitest';
import { request, app, unique, registerUser, createGroup } from '../helpers.js';
import prisma from '../../src/lib/prisma.js';

describe('isolamento multi-tenant tra gruppi', () => {
  it('un mazzo creato nel gruppo A non appare nella lista mazzi del gruppo B', async () => {
    const user = await registerUser('iso');
    const groupA = await createGroup(user.token, unique('Gruppo A '));
    const groupB = await createGroup(user.token, unique('Gruppo B '));

    const createRes = await request(app)
      .post(`/api/groups/${groupA.slug}/decks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Mazzo solo di A' });
    expect(createRes.status).toBe(200);
    const deckId = createRes.body.id;

    const listB = await request(app)
      .get(`/api/groups/${groupB.slug}/decks`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(listB.status).toBe(200);
    expect(listB.body.find(d => d.id === deckId)).toBeUndefined();

    const listA = await request(app)
      .get(`/api/groups/${groupA.slug}/decks`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(listA.body.find(d => d.id === deckId)).toBeTruthy();
  });

  it('un mazzo del gruppo A non è raggiungibile per id passando dallo slug del gruppo B', async () => {
    const user = await registerUser('iso2');
    const groupA = await createGroup(user.token, unique('Gruppo A '));
    const groupB = await createGroup(user.token, unique('Gruppo B '));

    const createRes = await request(app)
      .post(`/api/groups/${groupA.slug}/decks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Mazzo solo di A' });
    const deckId = createRes.body.id;

    const res = await request(app)
      .get(`/api/groups/${groupB.slug}/decks/${deckId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(404);
  });

  it('un achievement sbloccato nel gruppo A non appare nel gruppo B per lo stesso utente', async () => {
    // Stesso utente in due gruppi: gli unlock sono scoped per gruppo
    // (@@unique([groupId, userId, achievementId]) in schema.prisma). Creiamo
    // l'unlock direttamente via Prisma invece di passare dal flusso che lo
    // sblocca (checkAchievements è fire-and-forget, non awaited in decks.js:
    // testarlo via HTTP sarebbe una race condition della logica applicativa,
    // non di quello che vogliamo verificare qui — il filtro per groupId).
    const user = await registerUser('iso3');
    const groupA = await createGroup(user.token, unique('Gruppo A '));
    const groupB = await createGroup(user.token, unique('Gruppo B '));

    await prisma.achievementUnlock.create({
      data: { groupId: groupA.id, userId: user.user.id, achievementId: 'collector' },
    });

    const statsA = await request(app)
      .get(`/api/groups/${groupA.slug}/stats/achievements/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const statsB = await request(app)
      .get(`/api/groups/${groupB.slug}/stats/achievements/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(statsA.body.unlocked).toContain('collector');
    expect(statsB.body.unlocked).not.toContain('collector');
  });
});
