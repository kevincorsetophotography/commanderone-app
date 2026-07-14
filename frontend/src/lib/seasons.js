// Stagioni automatiche a blocchi di 4 mesi: Gen–Apr (1), Mag–Ago (2), Set–Dic (3).
// Punteggio: podio fisso 1°=3, 2°=2, 3°=1 + 1 di presenza per ogni partita giocata.
// Qualificato al titolo: ha giocato ≥ 30% delle partite della stagione.

const LABELS = ['Gennaio–Aprile', 'Maggio–Agosto', 'Settembre–Dicembre']
const QUALIFY_RATIO = 0.30

export function seasonOf(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const idx = Math.floor(d.getMonth() / 4) // 0,1,2
  return {
    key: `${year}-${idx}`,
    year,
    idx,
    label: `${LABELS[idx]} ${year}`,
  }
}

// Elenco stagioni presenti nei dati, dalla più recente alla più vecchia.
export function listSeasons(games) {
  const map = new Map()
  for (const g of games) {
    const s = seasonOf(g.playedAt)
    if (!map.has(s.key)) map.set(s.key, s)
  }
  return [...map.values()].sort((a, b) => (b.year - a.year) || (b.idx - a.idx))
}

// Punti di un giocatore in una partita (presenza + piazzamento).
function pointsFor(player, game) {
  let pts = 1 // bonus presenza
  const hasPlacement = game.players.every(p => p.placement != null)
  if (hasPlacement) {
    if (player.placement === 1) pts += 3
    else if (player.placement === 2) pts += 2
    else if (player.placement === 3) pts += 1
  } else if (player.isWinner) {
    pts += 3 // senza piazzamenti conosciamo solo il vincitore
  }
  return pts
}

// Classifica di una stagione (key) dai games.
export function computeStandings(games, seasonKey) {
  const seasonGames = games.filter(g => seasonOf(g.playedAt).key === seasonKey)
  const total = seasonGames.length
  const threshold = Math.max(1, Math.ceil(total * QUALIFY_RATIO))

  const tally = {}
  for (const g of seasonGames) {
    for (const p of g.players) {
      const id = p.user.id
      if (!tally[id]) tally[id] = { id, username: p.user.username, points: 0, games: 0, wins: 0 }
      tally[id].points += pointsFor(p, g)
      tally[id].games += 1
      if (p.isWinner) tally[id].wins += 1
    }
  }

  const standings = Object.values(tally)
    .map(s => ({ ...s, qualified: s.games >= threshold }))
    .sort((a, b) => (b.points - a.points) || (b.wins - a.wins) || (b.games - a.games))

  const champion = standings.find(s => s.qualified) || null

  return { standings, total, threshold, champion }
}
