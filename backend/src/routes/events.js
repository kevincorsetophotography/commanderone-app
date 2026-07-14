const router = require('express').Router();
const { createNotifications } = require('../lib/notify');
const { makePods, makePairings, standings1v1, rankStandings, swissPairings } = require('../lib/tournament');

const prisma = require('../lib/prisma');

const MAX_ROUNDS_1V1 = 4;

// Allega stato del turno e (per 1v1) classifica/vincitore al dettaglio.
const withStandings = (event) => {
  if (!event || !event.format) return event;
  const rounds = event.rounds || [];
  const last = rounds[rounds.length - 1] || null;
  const lastDone = last ? last.tables.every(t => t.done) : false;
  const base = {
    ...event,
    roundDone: lastDone,
    canNextRound: !!last && lastDone && (event.format !== '1v1' || rounds.length < MAX_ROUNDS_1V1),
  };
  if (event.format !== '1v1') return base;

  const seated = new Set();
  const nameOf = {};
  for (const r of rounds) for (const t of r.tables) for (const s of t.seats) { seated.add(s.userId); nameOf[s.userId] = s.user?.username; }
  const ids = seated.size ? [...seated] : (event.rsvps || []).map(r => r.userId);
  const standings = rankStandings(standings1v1(rounds, ids))
    .map(s => ({ ...s, opponents: undefined, username: nameOf[s.userId] || null }));
  const finished = rounds.length >= MAX_ROUNDS_1V1 && lastDone;
  return { ...base, standings, finished, winner: finished && standings.length ? standings[0] : null };
};

// Data leggibile per il corpo della notifica evento
const formatEventDate = (d, allDay) => {
  const date = new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  if (allDay) return date;
  const time = new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

const MAX_TITLE = 120;
const MAX_LOCATION = 160;
const MAX_DESCRIPTION = 2000;

const parseEventId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

const eventInclude = {
  createdBy: { select: { id: true, username: true } },
  rsvps: { select: { userId: true, user: { select: { username: true, avatarCardName: true, avatarScryfallId: true } } } }
};

// Dettaglio completo: + turni → tavoli → posti (con username)
const eventDetailInclude = {
  ...eventInclude,
  rounds: {
    orderBy: { number: 'asc' },
    include: {
      tables: {
        orderBy: { number: 'asc' },
        include: {
          seats: {
            orderBy: { seat: 'asc' },
            include: { user: { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } } },
          },
          game: {
            select: {
              id: true,
              players: { where: { isWinner: true }, select: { user: { select: { username: true } }, deck: { select: { name: true } } } },
            },
          },
        },
      },
    },
  },
};

// Normalizza/valida il payload di un evento. Ritorna { error } oppure { data }
const buildEventData = (body) => {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Titolo richiesto' };
  if (title.length > MAX_TITLE) return { error: `Titolo troppo lungo (max ${MAX_TITLE})` };

  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return { error: 'Data evento non valida' };

  const description = typeof body.description === 'string' && body.description.trim()
    ? body.description.trim().slice(0, MAX_DESCRIPTION)
    : null;
  const location = typeof body.location === 'string' && body.location.trim()
    ? body.location.trim().slice(0, MAX_LOCATION)
    : null;

  const format = body.format === '1v1' || body.format === 'multiplayer' ? body.format : null;
  const bestOf = format === '1v1' ? (Number.parseInt(body.bestOf, 10) === 3 ? 3 : 1) : null;

  return {
    data: {
      title,
      description,
      location,
      startsAt,
      allDay: body.allDay === true || body.allDay === 'true',
      format,
      bestOf,
    }
  };
};

// GET /api/groups/:slug/events — tutti gli eventi del gruppo (ordinati per data crescente)
router.get('/', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { groupId: req.group.id },
      orderBy: { startsAt: 'asc' },
      include: eventInclude
    });
    res.json(events);
  } catch (error) {
    console.error('list events error', error);
    res.status(500).json({ error: 'Errore durante il caricamento degli eventi' });
  }
});

// POST /api/groups/:slug/events — crea un evento (solo admin del gruppo)
router.post('/', async (req, res) => {
  if (req.membership.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono creare eventi' });

  const { error, data } = buildEventData(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const event = await prisma.event.create({
      data: { ...data, groupId: req.group.id, createdByUserId: req.user.id },
      include: eventInclude
    });

    // Notifica tutti i membri del gruppo tranne il creatore
    const members = await prisma.groupMember.findMany({ where: { groupId: req.group.id }, select: { userId: true } });
    await createNotifications(prisma, req.group.id, members.map(m => m.userId).filter(id => id !== req.user.id), {
      type: 'event',
      title: `📅 Nuovo evento: ${event.title}`,
      body: formatEventDate(event.startsAt, event.allDay) + (event.location ? ` · ${event.location}` : ''),
      link: `/eventi?focus=${event.id}`,
    });

    res.json(event);
  } catch (error) {
    console.error('create event error', error);
    res.status(500).json({ error: 'Errore durante la creazione dell\'evento' });
  }
});

// PATCH /api/groups/:slug/events/:id — modifica un evento (solo admin del gruppo)
router.patch('/:id', async (req, res) => {
  if (req.membership.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono modificare eventi' });

  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });

  const { error, data } = buildEventData(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const existing = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, groupId: true, _count: { select: { rounds: true } } },
    });
    if (!existing || existing.groupId !== req.group.id) return res.status(404).json({ error: 'Evento non trovato' });
    // Formato bloccato una volta che il torneo è iniziato
    if (existing._count.rounds > 0) { delete data.format; delete data.bestOf; }

    const event = await prisma.event.update({
      where: { id: eventId },
      data,
      include: eventInclude
    });
    res.json(event);
  } catch (error) {
    console.error('update event error', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'evento' });
  }
});

// DELETE /api/groups/:slug/events/:id — elimina un evento (solo admin del gruppo)
router.delete('/:id', async (req, res) => {
  if (req.membership.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono eliminare eventi' });

  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });

  try {
    const existing = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, groupId: true } });
    if (!existing || existing.groupId !== req.group.id) return res.status(404).json({ error: 'Evento non trovato' });

    await prisma.event.delete({ where: { id: eventId } });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete event error', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'evento' });
  }
});

// POST /api/groups/:slug/events/:id/rsvp — toggle "ci sono" dell'utente corrente
router.post('/:id/rsvp', async (req, res) => {
  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, groupId: true } });
    if (!event || event.groupId !== req.group.id) return res.status(404).json({ error: 'Evento non trovato' });

    const existing = await prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId: req.user.id } }
    });
    if (existing) {
      await prisma.eventRsvp.delete({ where: { id: existing.id } });
    } else {
      await prisma.eventRsvp.create({ data: { eventId, userId: req.user.id } });
    }

    const rsvps = await prisma.eventRsvp.findMany({
      where: { eventId },
      select: { userId: true, user: { select: { username: true } } }
    });
    res.json({ rsvps });
  } catch (error) {
    console.error('toggle rsvp error', error);
    res.status(500).json({ error: 'Errore durante l\'adesione' });
  }
});

// ─── Torneo: turni / tavoli ───────────────────────────────────────────

// GET /api/groups/:slug/events/:id — dettaglio evento con turni, tavoli e posti
router.get('/:id', async (req, res) => {
  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });
  try {
    const event = await prisma.event.findUnique({ where: { id: eventId }, include: eventDetailInclude });
    if (!event || event.groupId !== req.group.id) return res.status(404).json({ error: 'Evento non trovato' });
    res.json(withStandings(event));
  } catch (error) {
    console.error('get event error', error);
    res.status(500).json({ error: 'Errore durante il caricamento dell\'evento' });
  }
});

// POST /api/groups/:slug/events/:id/rounds — genera il turno successivo (solo admin del gruppo)
router.post('/:id/rounds', async (req, res) => {
  if (req.membership.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono generare i turni' });
  const eventId = parseEventId(req.params.id);
  if (!eventId) return res.status(400).json({ error: 'ID evento non valido' });

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId }, include: eventDetailInclude });
    if (!event || event.groupId !== req.group.id) return res.status(404).json({ error: 'Evento non trovato' });
    if (!event.format) return res.status(400).json({ error: 'Imposta prima il formato dell\'evento' });

    const rounds = event.rounds;
    const last = rounds[rounds.length - 1] || null;

    if (last) {
      if (!last.tables.every(t => t.done)) {
        return res.status(400).json({ error: 'Completa tutti i risultati del turno prima di generarne uno nuovo' });
      }
      if (event.format === '1v1' && rounds.length >= MAX_ROUNDS_1V1) {
        return res.status(400).json({ error: `Massimo ${MAX_ROUNDS_1V1} turni` });
      }
    }

    // Giocatori del torneo: i seduti finora, oppure (turno 1) gli iscritti
    const seated = new Set();
    for (const r of rounds) for (const t of r.tables) for (const s of t.seats) seated.add(s.userId);
    let ids = seated.size ? [...seated] : (await prisma.eventRsvp.findMany({ where: { eventId }, select: { userId: true } })).map(r => r.userId);

    const min = event.format === '1v1' ? 2 : 3;
    if (ids.length < min) return res.status(400).json({ error: `Servono almeno ${min} iscritti` });

    let tables;
    if (event.format === 'multiplayer') {
      tables = makePods(ids).map((pod, i) => ({
        number: i + 1,
        seats: { create: pod.map((userId, seat) => ({ seat, userId })) },
      }));
    } else {
      const { pairs, bye } = last
        ? swissPairings(standings1v1(rounds, ids))
        : makePairings(ids);
      tables = pairs.map((pair, i) => ({
        number: i + 1,
        seats: { create: pair.map((userId, seat) => ({ seat, userId })) },
      }));
      if (bye != null) {
        tables.push({ number: pairs.length + 1, done: true, winnerUserId: bye, seats: { create: [{ seat: 0, userId: bye }] } });
      }
    }

    const number = last ? last.number + 1 : 1;
    await prisma.eventRound.create({ data: { eventId, number, tables: { create: tables } } });
    const full = await prisma.event.findUnique({ where: { id: eventId }, include: eventDetailInclude });
    res.json(withStandings(full));
  } catch (error) {
    console.error('generate round error', error);
    res.status(500).json({ error: 'Errore durante la generazione del turno' });
  }
});

// POST /api/groups/:slug/events/:eventId/tables/:tableId/result — risultato 1v1 (giocatore o admin)
router.post('/:eventId/tables/:tableId/result', async (req, res) => {
  const tableId = Number.parseInt(req.params.tableId, 10);
  if (!Number.isInteger(tableId)) return res.status(400).json({ error: 'ID tavolo non valido' });

  try {
    const table = await prisma.eventTable.findUnique({
      where: { id: tableId },
      include: {
        seats: { select: { userId: true, seat: true } },
        round: { select: { event: { select: { id: true, groupId: true, format: true, bestOf: true } } } },
      },
    });
    if (!table || table.round.event.groupId !== req.group.id) return res.status(404).json({ error: 'Tavolo non trovato' });
    const event = table.round.event;

    const isParticipant = table.seats.some(s => s.userId === req.user.id);
    if (req.membership.role !== 'ADMIN' && !isParticipant) {
      return res.status(403).json({ error: 'Solo i giocatori del tavolo o un admin possono inserire il risultato' });
    }

    // Multiplayer: il risultato è una partita registrata (conta nelle statistiche)
    if (event.format === 'multiplayer') {
      const gameId = Number.parseInt(req.body.gameId, 10);
      if (!Number.isInteger(gameId)) return res.status(400).json({ error: 'Partita non valida' });
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true, groupId: true, players: { select: { userId: true } } } });
      if (!game || game.groupId !== req.group.id) return res.status(404).json({ error: 'Partita non trovata' });
      const podIds = new Set(table.seats.map(s => s.userId));
      const gameIds = new Set(game.players.map(p => p.userId));
      if (podIds.size !== gameIds.size || [...podIds].some(id => !gameIds.has(id))) {
        return res.status(400).json({ error: 'I giocatori della partita non coincidono col tavolo' });
      }
      await prisma.eventTable.update({ where: { id: tableId }, data: { gameId, done: true } });
      const full = await prisma.event.findUnique({ where: { id: event.id }, include: eventDetailInclude });
      return res.json(withStandings(full));
    }

    if (table.seats.length !== 2) return res.status(400).json({ error: 'Tavolo non valido per 1v1' });

    const bestOf = event.bestOf || 1;
    const scoreA = Number.parseInt(req.body.scoreA, 10);
    const scoreB = Number.parseInt(req.body.scoreB, 10);
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > bestOf || scoreB > bestOf) {
      return res.status(400).json({ error: `Punteggio non valido (0–${bestOf})` });
    }
    if (scoreA + scoreB < 1) return res.status(400).json({ error: 'Inserisci il risultato' });

    const a = (table.seats.find(s => s.seat === 0) || table.seats[0]).userId;
    const b = (table.seats.find(s => s.seat === 1) || table.seats[1]).userId;
    const isDraw = scoreA === scoreB;
    const winnerUserId = isDraw ? null : (scoreA > scoreB ? a : b);

    await prisma.eventTable.update({
      where: { id: tableId },
      data: { scoreA, scoreB, isDraw, winnerUserId, done: true },
    });

    const full = await prisma.event.findUnique({ where: { id: event.id }, include: eventDetailInclude });
    res.json(withStandings(full));
  } catch (error) {
    console.error('table result error', error);
    res.status(500).json({ error: 'Errore durante il salvataggio del risultato' });
  }
});

// DELETE /api/groups/:slug/events/:eventId/rounds/:roundId — elimina un turno (solo admin del gruppo)
router.delete('/:eventId/rounds/:roundId', async (req, res) => {
  if (req.membership.role !== 'ADMIN') return res.status(403).json({ error: 'Solo gli admin possono eliminare i turni' });
  const roundId = Number.parseInt(req.params.roundId, 10);
  if (!Number.isInteger(roundId)) return res.status(400).json({ error: 'ID turno non valido' });
  try {
    const round = await prisma.eventRound.findUnique({ where: { id: roundId }, select: { id: true, event: { select: { groupId: true } } } });
    if (!round || round.event.groupId !== req.group.id) return res.status(404).json({ error: 'Turno non trovato' });

    await prisma.eventRound.delete({ where: { id: roundId } });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete round error', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione del turno' });
  }
});

module.exports = router;
