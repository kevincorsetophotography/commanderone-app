// Cancellazione account self-service (GDPR). La parte delicata non è
// "cancellare l'utente" ma non rompere lo storico condiviso con altri
// giocatori — vedi lib/accountDeletion.js per il ragionamento completo.
import { describe, it, expect } from 'vitest';
import { request, app, unique, registerUser, createGroup, PASSWORD } from '../helpers.js';
import prisma from '../../src/lib/prisma.js';
import { GHOST_USERNAME } from '../../src/lib/accountDeletion.js';

async function joinGroup(token, inviteCode) {
  return request(app).post('/api/groups/join').set('Authorization', `Bearer ${token}`).send({ inviteCode });
}

describe('DELETE /api/auth/account', () => {
  it('rifiuta senza password / con password sbagliata, account intatto', async () => {
    const { token, username } = await registerUser('del');

    const noPw = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({});
    expect(noPw.status).toBe(400);

    const wrongPw = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({ password: 'nope-nope-nope' });
    expect(wrongPw.status).toBe(401);

    // L'account esiste ancora: login con la password vera funziona.
    const login = await request(app).post('/api/auth/login').send({ username, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('con password corretta cancella l\'account: vecchio JWT invalidato, username riusabile', async () => {
    const { token, username } = await registerUser('del2');

    const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({ password: PASSWORD });
    expect(res.status).toBe(200);

    const me = await request(app).get('/api/groups/mine').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);

    const reregister = await request(app).post('/api/auth/register').send({ username, email: `${username}@example.test`, password: PASSWORD });
    expect(reregister.status).toBe(200);
  });

  it('blocca se sei l\'unico admin di un gruppo con altri membri', async () => {
    const owner = await registerUser('soleadmin');
    const group = await createGroup(owner.token, unique('Gruppo solo-admin '));
    const other = await registerUser('member');
    await joinGroup(other.token, group.inviteCode);

    const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${owner.token}`).send({ password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SOLE_ADMIN_BLOCKED');
    expect(res.body.groupNames).toContain(group.name);

    // Niente è stato toccato: l'owner esiste ancora e il gruppo pure.
    const login = await request(app).post('/api/auth/login').send({ username: owner.username, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('non blocca se esiste un altro admin nello stesso gruppo', async () => {
    const owner = await registerUser('coadmin');
    const group = await createGroup(owner.token, unique('Gruppo co-admin '));
    const other = await registerUser('promoted');
    await joinGroup(other.token, group.inviteCode);
    await request(app)
      .patch(`/api/groups/${group.slug}/admin/members/${other.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'ADMIN' });

    const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${owner.token}`).send({ password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('cancella (non blocca) un gruppo di cui l\'utente è l\'unico membro', async () => {
    const owner = await registerUser('lone');
    const group = await createGroup(owner.token, unique('Gruppo solitario '));

    const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${owner.token}`).send({ password: PASSWORD });
    expect(res.status).toBe(200);

    const check = await prisma.group.findUnique({ where: { slug: group.slug } });
    expect(check).toBeNull();
  });

  it('riassegna al fantasma i mazzi/partecipazioni usate in partite condivise, senza romperle per gli altri', async () => {
    const owner = await registerUser('ghost-owner');
    const group = await createGroup(owner.token, unique('Gruppo fantasma '));
    const p2 = await registerUser('ghost-p2');
    const p3 = await registerUser('ghost-p3');
    await joinGroup(p2.token, group.inviteCode);
    await joinGroup(p3.token, group.inviteCode);

    const players = [];
    for (const u of [owner, p2, p3]) {
      const deckRes = await request(app)
        .post(`/api/groups/${group.slug}/decks`)
        .set('Authorization', `Bearer ${u.token}`)
        .send({ name: `Mazzo di ${u.username}` });
      players.push({ userId: u.user.id, deckId: deckRes.body.id });
    }
    const gameRes = await request(app)
      .post(`/api/groups/${group.slug}/games`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ players, winnerId: players[1].userId, winnerDeckId: players[1].deckId });
    expect(gameRes.status).toBe(200);
    const gameId = gameRes.body.id;
    const ownerDeckId = players[0].deckId;

    // owner è l'unico admin: senza promuovere qualcun altro la cancellazione
    // sarebbe bloccata (vedi il test dedicato più sopra) — non è quello che
    // questo test vuole isolare, quindi si passa la palla a p2 prima.
    await request(app)
      .patch(`/api/groups/${group.slug}/admin/members/${p2.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'ADMIN' });

    // owner cancella l'account
    const del = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${owner.token}`).send({ password: PASSWORD });
    expect(del.status).toBe(200);

    // p2 (rimasto nel gruppo) vede ancora la partita completa, ora con 3
    // giocatori dove uno è il fantasma al posto dell'owner cancellato.
    const gameAfter = await request(app)
      .get(`/api/groups/${group.slug}/games/${gameId}`)
      .set('Authorization', `Bearer ${p2.token}`);
    expect(gameAfter.status).toBe(200);
    expect(gameAfter.body.players).toHaveLength(3);
    const ghostSlot = gameAfter.body.players.find(p => p.userId !== p2.user.id && p.userId !== p3.user.id);
    expect(ghostSlot.user.username).toBe(GHOST_USERNAME);
    expect(ghostSlot.deck.id).toBe(ownerDeckId); // stesso mazzo, non sparito né duplicato

    // il mazzo dell'owner esiste ancora, ora di proprietà del fantasma
    const deckAfter = await prisma.deck.findUnique({ where: { id: ownerDeckId } });
    expect(deckAfter).not.toBeNull();
    const ghost = await prisma.user.findUnique({ where: { username: GHOST_USERNAME } });
    expect(deckAfter.userId).toBe(ghost.id);
  });

  it('cancella per davvero un mazzo mai usato in una partita', async () => {
    const owner = await registerUser('unused-deck');
    const group = await createGroup(owner.token, unique('Gruppo mazzo inutilizzato '));
    // Un secondo membro promosso admin: altrimenti o il gruppo ha un solo
    // membro (si cancella per intero insieme al mazzo, e questo test non
    // isolerebbe più la pulizia dei mazzi mai usati) o owner resta l'unico
    // admin (cancellazione bloccata, vedi il test dedicato più sopra).
    const other = await registerUser('unused-deck-p2');
    await joinGroup(other.token, group.inviteCode);
    await request(app)
      .patch(`/api/groups/${group.slug}/admin/members/${other.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'ADMIN' });

    const deckRes = await request(app)
      .post(`/api/groups/${group.slug}/decks`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Mazzo mai sceso in campo' });
    const deckId = deckRes.body.id;

    await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${owner.token}`).send({ password: PASSWORD });

    const deckAfter = await prisma.deck.findUnique({ where: { id: deckId } });
    expect(deckAfter).toBeNull();
  });

  it('il fantasma è un solo utente condiviso tra più cancellazioni', async () => {
    // Gruppi di cui ciascuno è l'unico membro: la cancellazione non è
    // bloccata (il gruppo sparisce con loro), non serve altro per isolare
    // quello che questo test vuole verificare — l'unicità del fantasma.
    // (getOrCreateGhostUser è chiamato comunque anche se non c'è nulla da
    // riassegnare, quindi basta questo per crearlo/trovarlo.)
    const u1 = await registerUser('sharedghost1');
    await createGroup(u1.token, unique('Gruppo sg1 '));
    await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${u1.token}`).send({ password: PASSWORD });

    const u2 = await registerUser('sharedghost2');
    await createGroup(u2.token, unique('Gruppo sg2 '));
    await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${u2.token}`).send({ password: PASSWORD });

    const after = await prisma.user.count({ where: { username: GHOST_USERNAME } });
    expect(after).toBe(1);
  });
});
