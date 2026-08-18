// Cancellazione account self-service (GDPR "diritto all'oblio").
//
// Non è un semplice DELETE FROM User: questa è un'app SOCIALE, la cronologia
// delle partite è condivisa con altri giocatori. Se Mario cancella l'account
// dopo una partita in 4, le righe GamePlayer/Deck che lo riguardano non
// possono sparire — romperebbero lo storico partita degli altri 3, che non
// hanno chiesto nulla. La riga utente PERSONALE (username, password) sparisce
// sempre; i riferimenti dentro partite condivise vengono invece riassegnati a
// un utente "fantasma" condiviso, cancellato solo se non serve più a nessuno.
//
// Cosa cancella per davvero (in cascata via schema.prisma, niente di
// personale sopravvive): GroupMember, Comment, Reaction, Notification,
// AchievementUnlock, EventRsvp, JudgeQuestion.
// Cosa riassegna al fantasma (storico condiviso, resta intatto per gli altri):
// GamePlayer.userId, Deck.userId (solo mazzi usati in almeno una partita),
// Game.createdByUserId, Event.createdByUserId, EventSeat.userId (un posto
// in un tavolo di torneo condiviso — es. l'altra metà di un pairing 1v1 —
// non può sparire per l'altro giocatore).
// Cosa cancella per davvero perché non serve a nessun altro: mazzi mai usati
// in una partita.

const GHOST_USERNAME = '[utente eliminato]';

// Il fantasma è un solo utente condiviso da tutte le cancellazioni — non un
// nuovo utente per ogni account cancellato, altrimenti si accumulerebbero
// righe inutili. Password inutilizzabile: non deve mai poter fare login.
async function getOrCreateGhostUser(prisma) {
  const existing = await prisma.user.findUnique({ where: { username: GHOST_USERNAME } });
  if (existing) return existing;
  return prisma.user.create({
    data: { username: GHOST_USERNAME, password: '!' /* hash bcrypt impossibile da produrre */ },
  });
}

// Un gruppo blocca la cancellazione solo se l'utente ne è l'UNICO admin E
// esistono altri membri — altrimenti chi resta perderebbe la governance del
// gruppo senza nessuno che gliel'abbia data esplicitamente. Se l'utente è
// l'unico membro del gruppo (admin o meno), il gruppo è "suo" e viene
// cancellato insieme all'account (cascata da Group, vedi schema.prisma).
async function findBlockingGroups(prisma, userId) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { include: { _count: { select: { members: true } } } } },
  });

  const blocking = [];
  for (const m of memberships) {
    if (m.group._count.members <= 1) continue; // unico membro: il gruppo verrà cancellato con lui
    if (m.role !== 'ADMIN') continue;
    const otherAdmins = await prisma.groupMember.count({
      where: { groupId: m.groupId, role: 'ADMIN', userId: { not: userId } },
    });
    if (otherAdmins === 0) blocking.push(m.group.name);
  }
  return blocking;
}

// Il messaggio non è più costruito qui in italiano: portiamo solo il codice
// più i nomi dei gruppi come dato strutturato, il frontend costruisce la
// frase tradotta interpolandoli (vedi frontend/src/lib/apiError.js).
class BlockedError extends Error {
  constructor(groupNames) {
    super('SOLE_ADMIN_BLOCKED');
    this.groupNames = groupNames;
  }
}

// Esegue la cancellazione vera e propria. Ritorna { error, groupNames? } se
// bloccata (nessuna modifica al DB in quel caso — la transazione va in
// rollback), altrimenti { ok: true }. Il controllo "unico admin" è dentro la
// stessa transazione della cancellazione (non una pre-verifica separata)
// apposta: altrimenti una membership cambiata tra la verifica e la scrittura
// potrebbe lasciare un gruppo senza nessun admin.
async function deleteAccount(prisma, userId) {
  try {
    await prisma.$transaction(async (tx) => {
      const blockingGroups = await findBlockingGroups(tx, userId);
      if (blockingGroups.length > 0) {
        throw new BlockedError(blockingGroups);
      }

      // Gruppi di cui l'utente è l'unico membro: cancellati per intero insieme
      // a lui (non ha senso farli sopravvivere vuoti).
      const memberships = await tx.groupMember.findMany({
        where: { userId },
        include: { group: { include: { _count: { select: { members: true } } } } },
      });
      const soleGroupIds = memberships.filter(m => m.group._count.members <= 1).map(m => m.groupId);
      if (soleGroupIds.length > 0) {
        await tx.group.deleteMany({ where: { id: { in: soleGroupIds } } });
      }

      const ghost = await getOrCreateGhostUser(tx);

      // Mazzi mai scesi in campo: nessuno storico condiviso li usa, si cancellano
      // per davvero insieme all'account invece di intasare il fantasma di righe morte.
      await tx.deck.deleteMany({ where: { userId, gamePlayers: { none: {} } } });

      // Il resto (mazzi USATI in partite) passa al fantasma: lo storico
      // condiviso con gli altri giocatori resta intatto. Rinominati con
      // l'id incluso perché @@unique([groupId, userId, name]) altrimenti
      // rischia una collisione se il fantasma ha già un mazzo con lo stesso
      // nome da una cancellazione precedente nello stesso gruppo.
      const remainingDecks = await tx.deck.findMany({ where: { userId }, select: { id: true, name: true } });
      for (const deck of remainingDecks) {
        await tx.deck.update({
          where: { id: deck.id },
          data: { userId: ghost.id, name: `${deck.name} #${deck.id}` },
        });
      }
      await tx.gamePlayer.updateMany({ where: { userId }, data: { userId: ghost.id } });
      await tx.game.updateMany({ where: { createdByUserId: userId }, data: { createdByUserId: ghost.id } });
      await tx.event.updateMany({ where: { createdByUserId: userId }, data: { createdByUserId: ghost.id } });

      // EventSeat: stesso discorso di GamePlayer, ma con un vincolo in più —
      // @@unique([tableId, userId]) impedisce due posti del fantasma allo
      // stesso tavolo. Capita se ENTRAMBI i partecipanti di un vecchio 1v1
      // hanno cancellato l'account: in quel caso il secondo posto si
      // cancella invece di far fallire tutta la cancellazione account.
      const seatsToReassign = await tx.eventSeat.findMany({ where: { userId }, select: { id: true, tableId: true } });
      if (seatsToReassign.length > 0) {
        const ghostSeats = await tx.eventSeat.findMany({
          where: { userId: ghost.id, tableId: { in: seatsToReassign.map(s => s.tableId) } },
          select: { tableId: true },
        });
        const ghostTableIds = new Set(ghostSeats.map(s => s.tableId));
        const toDelete = seatsToReassign.filter(s => ghostTableIds.has(s.tableId)).map(s => s.id);
        const toReassign = seatsToReassign.filter(s => !ghostTableIds.has(s.tableId)).map(s => s.id);
        if (toDelete.length > 0) await tx.eventSeat.deleteMany({ where: { id: { in: toDelete } } });
        if (toReassign.length > 0) await tx.eventSeat.updateMany({ where: { id: { in: toReassign } }, data: { userId: ghost.id } });
      }

      // Tutto il resto è personale: sparisce con l'utente. GroupMember, Comment,
      // Reaction, Notification, AchievementUnlock, EventRsvp, JudgeQuestion
      // sono già onDelete: Cascade in schema.prisma.
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (err) {
    if (err instanceof BlockedError) return { error: err.message, groupNames: err.groupNames };
    throw err;
  }

  return { ok: true };
}

module.exports = { GHOST_USERNAME, getOrCreateGhostUser, findBlockingGroups, deleteAccount };
