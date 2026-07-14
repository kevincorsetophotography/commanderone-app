// Algoritmi del torneo (puri): dimensionamento pod e abbinamenti.

// Dimensioni dei pod per n giocatori: ognuno 3-5, preferendo 4.
// Es: 3→[3] 4→[4] 5→[5] 6→[3,3] 7→[4,3] 9→[4,5] 11→[4,4,3] 13→[4,4,5]
function podSizes(n) {
  if (n < 3) return [];
  const k = Math.floor(n / 4);
  const r = n % 4;
  if (r === 0) return Array(k).fill(4);
  if (r === 1) return [...Array(k - 1).fill(4), 5]; // n>=5 ⇒ k>=1
  if (r === 2) return [...Array(k - 1).fill(4), 3, 3]; // n>=6 ⇒ k>=1
  return [...Array(k).fill(4), 3]; // r===3
}

// Fisher-Yates, ritorna un nuovo array mescolato.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Suddivide userIds in pod (mescolati) secondo podSizes.
function makePods(userIds) {
  const sizes = podSizes(userIds.length);
  const ids = shuffle(userIds);
  const pods = [];
  let i = 0;
  for (const s of sizes) { pods.push(ids.slice(i, i + s)); i += s; }
  return pods;
}

// Abbinamenti 1v1 del primo turno: mescola e accoppia; dispari ⇒ un bye.
function makePairings(userIds) {
  const ids = shuffle(userIds);
  let bye = null;
  if (ids.length % 2 === 1) bye = ids.pop();
  const pairs = [];
  for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
  return { pairs, bye };
}

// ── 1v1 svizzera: classifica e abbinamenti per i turni successivi ──

// Punti: vittoria 3, pareggio 1, sconfitta 0, bye 3.
// rounds: [{ tables: [{ seats:[{userId,seat}], done, winnerUserId, isDraw, scoreA, scoreB }] }]
function standings1v1(rounds, allPlayerIds = []) {
  const s = {};
  const ensure = (id) => (s[id] || (s[id] = { userId: id, points: 0, wins: 0, draws: 0, losses: 0, byes: 0, gw: 0, opponents: [] }));
  for (const id of allPlayerIds) ensure(id);

  for (const r of rounds || []) for (const tbl of r.tables || []) {
    if (!tbl.done) continue;
    if (tbl.seats.length === 1) { // bye
      const p = ensure(tbl.seats[0].userId); p.points += 3; p.byes += 1; continue;
    }
    const a = (tbl.seats.find(x => x.seat === 0) || tbl.seats[0]).userId;
    const b = (tbl.seats.find(x => x.seat === 1) || tbl.seats[1]).userId;
    const pa = ensure(a), pb = ensure(b);
    pa.opponents.push(b); pb.opponents.push(a);
    pa.gw += (tbl.scoreA || 0); pb.gw += (tbl.scoreB || 0);
    if (tbl.isDraw) { pa.points += 1; pb.points += 1; pa.draws++; pb.draws++; }
    else if (tbl.winnerUserId === a) { pa.points += 3; pa.wins++; pb.losses++; }
    else if (tbl.winnerUserId === b) { pb.points += 3; pb.wins++; pa.losses++; }
  }
  return Object.values(s);
}

// Ordina la classifica: punti, poi game vinti, poi vittorie.
function rankStandings(standings) {
  return [...standings].sort((x, y) => (y.points - x.points) || (y.gw - x.gw) || (y.wins - x.wins));
}

// Abbinamenti svizzeri del turno successivo dalla classifica (evita i re-match,
// bye al più basso che non l'ha ancora avuto).
function swissPairings(standings) {
  const ranked = rankStandings(standings);
  let pool = ranked.map(s => s.userId);
  const opp = Object.fromEntries(standings.map(s => [s.userId, new Set(s.opponents)]));
  const byes = Object.fromEntries(standings.map(s => [s.userId, s.byes || 0]));

  let bye = null;
  if (pool.length % 2 === 1) {
    for (let i = pool.length - 1; i >= 0; i--) {
      if ((byes[pool[i]] || 0) === 0) { bye = pool[i]; pool.splice(i, 1); break; }
    }
    if (bye === null) { bye = pool[pool.length - 1]; pool.pop(); }
  }

  const used = new Set();
  const pairs = [];
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (used.has(a)) continue;
    used.add(a);
    let partner = null;
    for (let j = i + 1; j < pool.length; j++) {
      const c = pool[j];
      if (!used.has(c) && !opp[a]?.has(c)) { partner = c; break; }
    }
    if (partner === null) { // ultimo ricorso: accetta un re-match col più vicino
      for (let j = i + 1; j < pool.length; j++) { if (!used.has(pool[j])) { partner = pool[j]; break; } }
    }
    if (partner !== null) { used.add(partner); pairs.push([a, partner]); }
  }
  return { pairs, bye };
}

module.exports = { podSizes, shuffle, makePods, makePairings, standings1v1, rankStandings, swissPairings };
