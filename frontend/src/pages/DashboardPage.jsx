import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { SkeletonList, Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import BracketBadge from '../components/BracketBadge'
import ArchetypeBadge from '../components/ArchetypeBadge'
import GameSocial from '../components/GameSocial'
import { ARCHETYPE_OPTIONS } from '../lib/archetypes'
import { BRACKETS, BRACKET_OPTIONS } from '../lib/brackets'
import { useCountUp } from '../hooks/useCountUp'
import { useIsMobile } from '../hooks/useIsMobile'
import { listSeasons, computeStandings } from '../lib/seasons'
import PlayerAvatar from '../components/PlayerAvatar'

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  )
}


function MetricCard({ label, value, t }) {
  const shown = useCountUp(value)
  return (
    <div style={{
      background: t.bgSurface,
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      borderRadius: 16,
      padding: '1rem 1.15rem',
      border: `1px solid ${t.border}`,
      boxShadow: t.shadow,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.gradient }} />
      <div style={{ fontSize: 11, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, lineHeight: 1 }}>{shown}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  // La tab vive nell'URL (?tab=...): così il "back" del browser/gesture ripristina
  // la scheda da cui si era partiti invece di tornare sempre a "Giocatori".
  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_TABS = ['stagione', 'giocatori', 'mazzi', 'matchup', 'storico', 'primati']
  const qTab = searchParams.get('tab')
  const tab = VALID_TABS.includes(qTab) ? qTab : 'giocatori'
  const setTab = (next) => setSearchParams(next === 'giocatori' ? {} : { tab: next }, { replace: true })
  const [playerStats, setPlayerStats] = useState([])
  const [deckStats, setDeckStats] = useState([])
  const [matchups, setMatchups] = useState([])
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMatchupDeckId, setSelectedMatchupDeckId] = useState(null)
  const [expandedPlayerId, setExpandedPlayerId]           = useState(null)
  const [colorFilter, setColorFilter]   = useState([])
  const [ownerFilter, setOwnerFilter]   = useState('')
  const [deckSortDir, setDeckSortDir]   = useState('desc')
  const [deckSearch, setDeckSearch]     = useState('')
  const [bracketFilter, setBracketFilter] = useState('')
  const [archetypeFilter, setArchetypeFilter] = useState('')
  const [seasonKey, setSeasonKey]         = useState(null)

  useEffect(() => {
    Promise.all([
      api.statsPlayers(),
      api.statsDecks(),
      api.statsMatchups(),
      api.getGames()
    ]).then(([p, d, m, g]) => {
      setPlayerStats(p); setDeckStats(d); setMatchups(m); setGames(g)
    }).catch(() => setError('Errore nel caricamento statistiche')).finally(() => setLoading(false))
  }, [])

  const [matchupOppOwner,  setMatchupOppOwner]  = useState('')
  const [matchupOppDeck,   setMatchupOppDeck]   = useState('')
  const [matchupSortDir,   setMatchupSortDir]   = useState('desc')
  const [historicPeriod,   setHistoricPeriod]   = useState('all')
  const [historicFrom,     setHistoricFrom]     = useState('')
  const [historicTo,       setHistoricTo]       = useState('')

  // I miei mazzi che compaiono nei matchup
  const myMatchupDecks = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const m of matchups) {
      if (m.deckA.owner === user?.username && !seen.has(m.deckA.id)) {
        seen.add(m.deckA.id)
        result.push(m.deckA)
      }
    }
    return result
  }, [matchups, user?.username])

  // Auto-seleziona primo mazzo
  useEffect(() => {
    if (myMatchupDecks.length > 0 && !selectedMatchupDeckId) {
      setSelectedMatchupDeckId(myMatchupDecks[0].id)
    }
  }, [myMatchupDecks])

  // Tutti i matchup del mazzo selezionato (senza filtri avversario)
  const baseMatchups = useMemo(() => {
    if (!selectedMatchupDeckId) return []
    return matchups
      .filter(m => m.deckA.id === selectedMatchupDeckId && m.deckA.owner === user?.username)
      .sort((a, b) => b.games - a.games)
  }, [matchups, selectedMatchupDeckId, user?.username])

  // Opzioni filtro avversari derivate dai matchup del mazzo selezionato
  const oppPlayers   = useMemo(() => [...new Set(baseMatchups.map(m => m.deckB.owner))].sort(), [baseMatchups])
  const oppDeckNames = useMemo(() => {
    const source = matchupOppOwner
      ? baseMatchups.filter(m => m.deckB.owner === matchupOppOwner)
      : baseMatchups
    return [...new Set(source.map(m => m.deckB.name))].sort()
  }, [baseMatchups, matchupOppOwner])

  // Reset filtri avversario quando cambia il mazzo
  useEffect(() => { setMatchupOppOwner(''); setMatchupOppDeck('') }, [selectedMatchupDeckId])

  // Storico filtrato per periodo / range date
  const visibleGames = useMemo(() => {
    const hasCustom = historicFrom || historicTo
    let from = null, to = null

    if (hasCustom) {
      if (historicFrom) from = new Date(historicFrom + 'T00:00:00')
      if (historicTo)   { to = new Date(historicTo + 'T23:59:59') }
    } else if (historicPeriod !== 'all') {
      from = new Date()
      from.setDate(from.getDate() - { '7d': 7, '30d': 30, '90d': 90, '180d': 180 }[historicPeriod])
      from.setHours(0, 0, 0, 0)
    }

    if (!from && !to) return games
    return games.filter(g => {
      const d = new Date(g.playedAt)
      if (from && d < from) return false
      if (to   && d > to)   return false
      return true
    })
  }, [games, historicPeriod, historicFrom, historicTo])

  // Matchup filtrati
  const filteredMatchups = useMemo(() => {
    let list = [...baseMatchups]
    if (matchupOppOwner) list = list.filter(m => m.deckB.owner === matchupOppOwner)
    if (matchupOppDeck)  list = list.filter(m => m.deckB.name  === matchupOppDeck)
    list.sort((a, b) => matchupSortDir === 'desc' ? b.winRate - a.winRate : a.winRate - b.winRate)
    return list
  }, [baseMatchups, matchupOppOwner, matchupOppDeck, matchupSortDir])

  // Owner unici dai deckStats
  const deckOwners = useMemo(() => [...new Set(deckStats.map(d => d.owner))].sort(), [deckStats])

  // Mappa deckId → commander (i matchup dal backend non includono il commander)
  const commanderById = useMemo(() => {
    const m = {}
    for (const d of deckStats) m[d.id] = d.commander
    return m
  }, [deckStats])

  // Lista mazzi filtrata e ordinata
  const visibleDecks = useMemo(() => {
    let list = [...deckStats]
    if (colorFilter.length > 0)
      list = list.filter(d => d.colors && colorFilter.every(c => d.colors.includes(c)))
    if (ownerFilter)
      list = list.filter(d => d.owner === ownerFilter)
    if (bracketFilter)
      list = list.filter(d => String(d.bracket) === bracketFilter)
    if (archetypeFilter)
      list = list.filter(d => d.archetype === archetypeFilter)
    if (deckSearch.trim()) {
      const q = deckSearch.trim().toLowerCase()
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) || (d.commander || '').toLowerCase().includes(q))
    }
    list.sort((a, b) => deckSortDir === 'desc' ? b.winRate - a.winRate : a.winRate - b.winRate)
    return list
  }, [deckStats, colorFilter, ownerFilter, bracketFilter, archetypeFilter, deckSortDir, deckSearch])

  const toggleColor = (c) =>
    setColorFilter(f => f.includes(c) ? f.filter(x => x !== c) : [...f, c])

  // ── STAGIONI ──
  const seasons = useMemo(() => listSeasons(games), [games])
  useEffect(() => {
    if (seasons.length > 0 && !seasonKey) setSeasonKey(seasons[0].key)
  }, [seasons])
  const season = useMemo(
    () => (seasonKey ? computeStandings(games, seasonKey) : null),
    [games, seasonKey]
  )

  // ── PRIMATI / META / ATTIVITÀ ──
  const records = useMemo(() => {
    if (games.length === 0) return null

    // Streak più lunga di sempre per giocatore
    const byPlayer = {}
    for (const g of [...games].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))) {
      for (const p of g.players) {
        if (!byPlayer[p.user.id]) byPlayer[p.user.id] = { username: p.user.username, cur: 0, best: 0 }
        const rec = byPlayer[p.user.id]
        if (p.isWinner) { rec.cur++; rec.best = Math.max(rec.best, rec.cur) }
        else rec.cur = 0
      }
    }
    const longestStreak = Object.values(byPlayer).sort((a, b) => b.best - a.best)[0]

    // Re del mese (più vittorie nel mese corrente)
    const now = new Date()
    const monthWins = {}
    for (const g of games) {
      const d = new Date(g.playedAt)
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        const w = g.players.find(p => p.isWinner)
        if (w) monthWins[w.user.username] = (monthWins[w.user.username] || 0) + 1
      }
    }
    const kingOfMonth = Object.entries(monthWins).sort((a, b) => b[1] - a[1])[0] || null

    // Tavolo più affollato
    const biggestTable = games.reduce((max, g) => g.players.length > max.players.length ? g : max, games[0])

    // Player con più vittorie / più partite / miglior winrate (min 5)
    const mostWins = [...playerStats].sort((a, b) => b.wins - a.wins)[0]
    const mostGames = [...playerStats].sort((a, b) => b.games - a.games)[0]
    const bestRate = [...playerStats].filter(p => p.games >= 5).sort((a, b) => b.winRate - a.winRate)[0]

    // Mazzo più vincente (min 3 partite, per winrate; tiebreak vittorie)
    const topDeck = [...deckStats].filter(d => d.games >= 3)
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0]

    // Piazzamenti: media e "primo eliminato" per giocatore
    const placeStats = {}
    for (const g of games) {
      if (!g.players.every(p => p.placement != null)) continue
      for (const p of g.players) {
        if (!placeStats[p.user.id]) placeStats[p.user.id] = { username: p.user.username, sum: 0, n: 0, firstOuts: 0 }
        const ps = placeStats[p.user.id]
        ps.sum += p.placement
        ps.n++
        if (p.placement === g.players.length) ps.firstOuts++
      }
    }
    const placeArr = Object.values(placeStats)
    const survivalKing = placeArr.filter(p => p.n >= 3)
      .map(p => ({ ...p, avg: p.sum / p.n }))
      .sort((a, b) => a.avg - b.avg)[0]
    const unluckiest = placeArr.filter(p => p.firstOuts > 0)
      .sort((a, b) => b.firstOuts - a.firstOuts)[0]

    // Kill tracking
    const killTally = {}, deathTally = {}
    for (const g of games) {
      for (const p of g.players) {
        if (!p.eliminatedById) continue
        deathTally[p.user.username] = (deathTally[p.user.username] || 0) + 1
        const killer = g.players.find(x => x.user.id === p.eliminatedById)
        if (killer) killTally[killer.user.username] = (killTally[killer.user.username] || 0) + 1
      }
    }
    const mostRuthless = Object.entries(killTally).sort((a, b) => b[1] - a[1])[0] || null
    const biggestTarget = Object.entries(deathTally).sort((a, b) => b[1] - a[1])[0] || null

    return { longestStreak, kingOfMonth, biggestTable, mostWins, mostGames, bestRate, topDeck, survivalKing, unluckiest, mostRuthless, biggestTarget }
  }, [games, playerStats, deckStats])

  // Meta colori: win rate per colore (su presenze nei pod)
  const colorMeta = useMemo(() => {
    const order = ['W', 'U', 'B', 'R', 'G']
    const tally = Object.fromEntries(order.map(c => [c, { games: 0, wins: 0 }]))
    for (const g of games) {
      for (const p of g.players) {
        const cols = (p.deck.colors || '').split('')
        for (const c of order) {
          if (cols.includes(c)) {
            tally[c].games++
            if (p.isWinner) tally[c].wins++
          }
        }
      }
    }
    return order.map(c => ({
      color: c,
      games: tally[c].games,
      winRate: tally[c].games ? Math.round(tally[c].wins / tally[c].games * 100) : 0,
    }))
  }, [games])

  // Attività: partite per mese (ultimi 8 mesi)
  const activity = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('it-IT', { month: 'short' }), count: 0 })
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]))
    for (const g of games) {
      const d = new Date(g.playedAt)
      const k = `${d.getFullYear()}-${d.getMonth()}`
      if (k in idx) months[idx[k]].count++
    }
    return months
  }, [games])

  const card = {
    background: t.bgSurface,
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    padding: '1rem 1.25rem',
    marginBottom: 10,
    boxShadow: t.shadow,
  }

  const tabBtn = (tab2) => ({
    padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: tab === tab2 ? t.primary : 'transparent',
    color: tab === tab2 ? t.primaryFg : t.textSub,
    boxShadow: tab === tab2 ? t.glow : 'none',
    transition: 'all 0.18s ease',
  })

  if (loading) return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={78} r={16} />)}
      </div>
      <Skeleton w={280} h={48} r={14} style={{ marginBottom: '1.25rem' }} />
      <SkeletonList rows={5} />
    </div>
  )
  if (error)   return <EmptyState icon="⚠️" title="Errore" message={error} />

  const totalGames = games.length
  const topPlayer  = playerStats[0]
  const topDeck    = deckStats[0]

  return (
    <div>
      {/* Metriche globali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        <MetricCard label="Partite totali"    value={totalGames}                    t={t} />
        <MetricCard label="Giocatori"         value={playerStats.length}            t={t} />
        <MetricCard label="Mazzi registrati"  value={deckStats.length}              t={t} />
        <MetricCard label="Top player"        value={topPlayer?.username || '—'}    t={t} />
      </div>

      {/* Tab selector */}
      <div
        className={isMobile ? 'ct-scroll-x' : undefined}
        style={{
          display: isMobile ? 'flex' : 'inline-flex',
          gap: 4, marginBottom: '1.25rem',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          background: t.bgSurface,
          backdropFilter: 'blur(14px) saturate(150%)',
          WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: 5,
          boxShadow: t.shadow,
          maxWidth: isMobile ? '100%' : undefined,
        }}
      >
        {['stagione', 'giocatori', 'mazzi', 'matchup', 'storico', 'primati'].map(t2 => (
          <button key={t2} style={{ ...tabBtn(t2), flexShrink: 0 }} onClick={() => setTab(t2)}>
            {t2.charAt(0).toUpperCase() + t2.slice(1)}
          </button>
        ))}
      </div>

      {/* STAGIONE */}
      {tab === 'stagione' && (
        <div>
          {seasons.length === 0 || !season ? (
            <EmptyState icon="🏆" title="Nessuna stagione ancora" message="Registrate qualche partita per far partire la classifica stagionale." />
          ) : (
            <>
              {/* Selettore stagione */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <select
                  value={seasonKey || ''}
                  onChange={e => setSeasonKey(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                >
                  {seasons.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span style={{ fontSize: 12, color: t.textMuted }}>{season.total} partite · qualificato da {season.threshold} partite</span>
              </div>

              {/* Campione / in testa */}
              {season.champion && (
                <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, borderColor: t.primaryBorder }}>
                  <div style={{ fontSize: 34 }}>🏆</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>In testa alla stagione</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>{season.champion.username}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: t.primary, lineHeight: 1 }}>{season.champion.points}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>punti</div>
                  </div>
                </div>
              )}

              {/* Legenda punteggio */}
              <div style={{ fontSize: 11.5, color: t.textMuted, margin: '4px 4px 10px' }}>
                Punteggio: 1° = 3 · 2° = 2 · 3° = 1 · +1 presenza a ogni partita
              </div>

              {/* Classifica */}
              {season.standings.map((s, i) => (
                <div
                  key={s.id}
                  className="ct-lift"
                  onClick={() => navigate(`/giocatore/${s.id}`)}
                  style={{ ...card, cursor: 'pointer', opacity: s.qualified ? 1 : 0.62 }}
                  title="Apri il profilo del giocatore"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 && s.qualified ? t.primary : t.textMuted, minWidth: 22 }}>{i + 1}°</span>
                      <PlayerAvatar username={s.username} avatarCardName={playerStats.find(p => p.id === s.id)?.avatarCardName} avatarScryfallId={playerStats.find(p => p.id === s.id)?.avatarScryfallId} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {s.username}
                          {!s.qualified && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, border: `1px solid ${t.border}`, borderRadius: 6, padding: '1px 5px' }}>non qualif.</span>}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSub }}>{s.games} partite · {s.wins} vittorie</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{s.points}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>punti</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* GIOCATORI */}
      {tab === 'giocatori' && (
        <div>
          {playerStats.length === 0 && (
            <EmptyState icon="🃏" title="Ancora nessuna partita" message="Registrate la prima partita dalla pagina '+ Partita' per vedere le classifiche dei giocatori." />
          )}
          {playerStats.map((p, i) => {
            const isOpen   = expandedPlayerId === p.id
            const myDecks  = deckStats.filter(d => d.ownerId === p.id).sort((a, b) => b.winRate - a.winRate)

            return (
              <div key={p.id} style={card}>
                {/* Header — cliccabile */}
                <div
                  onClick={() => setExpandedPlayerId(isOpen ? null : p.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: t.textMuted, minWidth: 20 }}>#{i + 1}</span>
                    <PlayerAvatar username={p.username} avatarCardName={p.avatarCardName} avatarScryfallId={p.avatarScryfallId} />
                    <div>
                      <div style={{ fontWeight: 500, color: t.text }}>{p.username}</div>
                      <div style={{ fontSize: 12, color: t.textSub }}>{p.wins}V / {p.games - p.wins}P · {p.games} partite</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: t.primary }}>{p.winRate}%</div>
                    <span style={{ fontSize: 12, color: t.textMuted }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                <WinBar pct={p.winRate} t={t} />

                {/* Sezione mazzi espandibile */}
                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: `0.5px solid ${t.border}`, paddingTop: 12 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/giocatore/${p.id}`) }}
                      style={{ marginBottom: 10, padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.primaryBorder}`, background: t.primaryBg, color: t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Vedi profilo completo →
                    </button>
                    {myDecks.length === 0 ? (
                      <div style={{ fontSize: 13, color: t.textMuted }}>Nessun mazzo con partite registrate</div>
                    ) : (
                      myDecks.map((deck, di) => (
                        <div
                          key={deck.id}
                          onClick={() => navigate(`/mazzo/${deck.id}`)}
                          title="Apri il profilo del mazzo"
                          style={{
                            padding: '8px 0',
                            borderBottom: di < myDecks.length - 1 ? `0.5px solid ${t.border}` : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <DeckThumb commander={deck.commander} w={42} preview={false} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{deck.name}</div>
                                {deck.commander && (
                                  <div style={{ fontSize: 11, color: t.textMuted }}>{deck.commander}</div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              <span style={{ fontSize: 11, color: t.textMuted }}>
                                {deck.wins}V · {deck.games - deck.wins}P
                              </span>
                              <span style={{
                                fontSize: 14, fontWeight: 600, minWidth: 38, textAlign: 'right',
                                color: deck.winRate >= 50 ? t.win : deck.winRate > 0 ? t.primary : t.textMuted
                              }}>
                                {deck.games > 0 ? `${deck.winRate}%` : 'n/a'}
                              </span>
                            </div>
                          </div>
                          {deck.games > 0 && <WinBar pct={deck.winRate} t={t} />}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MAZZI */}
      {tab === 'mazzi' && (
        <div>
          {/* Filtri */}
          <div style={{ background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '0.85rem 1rem', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>

            {/* Filtro colore */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Colore:</span>
              {['W','U','B','R','G'].map(c => {
                const bg = { W:'#f5f0e0', U:'#b8d4e8', B:'#c8b8d8', R:'#e8c0b0', G:'#b8d8b8' }[c]
                const active = colorFilter.includes(c)
                return (
                  <button key={c} onClick={() => toggleColor(c)} title={c} style={{
                    width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
                    background: bg, fontSize: 10, fontWeight: 700, color: '#444',
                    border: active ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                    outline: active ? `2px solid ${t.primaryBorder}` : 'none',
                    opacity: colorFilter.length > 0 && !active ? 0.45 : 1,
                    transition: 'all 0.12s'
                  }}>{c}</button>
                )
              })}
              {colorFilter.length > 0 && (
                <button onClick={() => setColorFilter([])} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                  ✕ reset
                </button>
              )}
            </div>

            {/* Filtro utente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Giocatore:</span>
              <select
                value={ownerFilter}
                onChange={e => setOwnerFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, cursor: 'pointer', outline: 'none' }}
              >
                <option value=''>Tutti</option>
                {deckOwners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Filtro bracket */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Livello:</span>
              <select
                value={bracketFilter}
                onChange={e => setBracketFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, cursor: 'pointer', outline: 'none' }}
              >
                <option value=''>Tutti</option>
                {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
              </select>
            </div>

            {/* Filtro archetipo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Archetipo:</span>
              <select
                value={archetypeFilter}
                onChange={e => setArchetypeFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, cursor: 'pointer', outline: 'none' }}
              >
                <option value=''>Tutti</option>
                {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Ricerca nome/commander */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
              <input
                value={deckSearch}
                onChange={e => setDeckSearch(e.target.value)}
                placeholder="🔍 Cerca mazzo o commander"
                style={{ padding: '5px 10px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', width: 200 }}
              />
              {deckSearch && (
                <button onClick={() => setDeckSearch('')} style={{ position: 'absolute', right: 6, fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              )}
            </div>

            {/* Ordinamento */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Win rate:</span>
              <button
                onClick={() => setDeckSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                style={{ padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.bgMuted, color: t.text, fontSize: 13, cursor: 'pointer' }}
              >
                {deckSortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
              </button>
            </div>
          </div>

          {/* Contatore risultati */}
          {(colorFilter.length > 0 || ownerFilter || deckSearch || bracketFilter || archetypeFilter) && (
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8, paddingLeft: 4 }}>
              {visibleDecks.length} mazzo{visibleDecks.length !== 1 ? 'i' : ''} trovato{visibleDecks.length !== 1 ? 'i' : ''}
            </div>
          )}

          {visibleDecks.length === 0 && (
            <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>
              {deckStats.length === 0 ? 'Nessun mazzo ha ancora giocato' : 'Nessun mazzo corrisponde ai filtri'}
            </div>
          )}

          {visibleDecks.map((d, i) => (
            <div key={d.id} className="ct-lift" style={{ ...card, cursor: 'pointer' }} onClick={() => navigate(`/mazzo/${d.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: t.textMuted, minWidth: 20 }}>#{i + 1}</span>
                  <DeckThumb commander={d.commander} w={56} preview={false} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: t.text, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {d.name}
                      {d.colors && (
                        <span style={{ display: 'inline-flex', gap: 2 }}>
                          {d.colors.split('').map(c => {
                            const bg = { W:'#f5f0e0', U:'#b8d4e8', B:'#c8b8d8', R:'#e8c0b0', G:'#b8d8b8' }[c] || '#eee'
                            return <span key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: bg, border: '1px solid rgba(0,0,0,0.15)', display: 'inline-block' }} title={c} />
                          })}
                        </span>
                      )}
                      <ArchetypeBadge archetype={d.archetype} />
                      <BracketBadge bracket={d.bracket} />
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      {d.owner}{d.commander ? ` · ${d.commander}` : ''} · {d.wins}V / {d.games - d.wins}P
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: d.winRate >= 50 ? t.win : d.winRate > 0 ? t.primary : t.textMuted }}>
                    {d.games > 0 ? `${d.winRate}%` : 'n/a'}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{d.games} partite</div>
                </div>
              </div>
              {d.games > 0 && <WinBar pct={d.winRate} t={t} />}
            </div>
          ))}
        </div>
      )}

      {/* MATCHUP */}
      {tab === 'matchup' && (
        <div>
          {myMatchupDecks.length === 0 ? (
            <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>
              Nessun matchup disponibile — gioca qualche partita prima!
            </div>
          ) : (
            <>
              {/* Selettore mio mazzo */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>Il tuo mazzo:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {myMatchupDecks.map(deck => (
                    <button
                      key={deck.id}
                      onClick={() => setSelectedMatchupDeckId(deck.id)}
                      style={{
                        padding: '7px 16px', borderRadius: 20, border: 'none',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                        background: selectedMatchupDeckId === deck.id ? t.primary : t.bgMuted,
                        color: selectedMatchupDeckId === deck.id ? t.primaryFg : t.textSub,
                      }}
                    >
                      {deck.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtri avversari */}
              {baseMatchups.length > 0 && (
                <div style={{ background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '0.85rem 1rem', marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>

                  {/* Per giocatore */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: t.textSub }}>Giocatore:</span>
                    <select
                      value={matchupOppOwner}
                      onChange={e => { setMatchupOppOwner(e.target.value); setMatchupOppDeck('') }}
                      style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, cursor: 'pointer', outline: 'none' }}
                    >
                      <option value=''>Tutti</option>
                      {oppPlayers.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Per mazzo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: t.textSub }}>Mazzo:</span>
                    <select
                      value={matchupOppDeck}
                      onChange={e => setMatchupOppDeck(e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, cursor: 'pointer', outline: 'none' }}
                    >
                      <option value=''>Tutti</option>
                      {oppDeckNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {(matchupOppOwner || matchupOppDeck) && (
                    <button
                      onClick={() => { setMatchupOppOwner(''); setMatchupOppDeck('') }}
                      style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ✕ reset
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                    <span style={{ fontSize: 12, color: t.textSub }}>Win rate:</span>
                    <button
                      onClick={() => setMatchupSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.bgMuted, color: t.text, fontSize: 13, cursor: 'pointer' }}
                    >
                      {matchupSortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
                    </button>
                  </div>
                </div>
              )}

              {/* Risultati */}
              {filteredMatchups.length === 0 ? (
                <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '1.5rem' }}>
                  Nessun dato per i filtri selezionati
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8, paddingLeft: 4 }}>
                    {filteredMatchups.length} avversar{filteredMatchups.length === 1 ? 'io' : 'i'}
                    {(matchupOppOwner || matchupOppDeck) && ' (filtrati)'}
                  </div>
                  {filteredMatchups.map((m, i) => (
                    <div key={i} className="ct-lift" style={{ ...card, cursor: 'pointer' }} onClick={() => navigate(`/mazzo/${m.deckB.id}`)} title="Apri il profilo del mazzo">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <DeckThumb commander={commanderById[m.deckB.id]} w={48} preview={false} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 14, color: t.text }}>{m.deckB.name}</div>
                            <div style={{ fontSize: 12, color: t.textSub }}>
                              di {m.deckB.owner} · {m.games} {m.games === 1 ? 'partita' : 'partite'} in comune
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 22, fontWeight: 600, color: m.winRate >= 50 ? t.win : m.winRate > 0 ? t.primary : t.textMuted }}>
                            {m.winRate}%
                          </div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>
                            {m.wins}V · {m.games - m.wins}P
                          </div>
                        </div>
                      </div>
                      <WinBar pct={m.winRate} t={t} />
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* STORICO */}
      {tab === 'storico' && (
        <div>
          {/* Filtri data */}
          <div style={{ background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '0.85rem 1rem', marginBottom: 12 }}>

            {/* Presets periodo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Periodo:</span>
              {[
                { key: 'all',  label: 'Tutto' },
                { key: '7d',   label: '7 giorni' },
                { key: '30d',  label: 'Mese' },
                { key: '90d',  label: '3 mesi' },
                { key: '180d', label: '6 mesi' },
              ].map(({ key, label }) => {
                const active = !historicFrom && !historicTo && historicPeriod === key
                return (
                  <button
                    key={key}
                    onClick={() => { setHistoricPeriod(key); setHistoricFrom(''); setHistoricTo('') }}
                    style={{
                      padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, transition: 'all 0.12s',
                      background: active ? t.primary : t.bgMuted,
                      color: active ? t.primaryFg : t.textSub,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Range personalizzato */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Da:</span>
              <input
                type='date'
                value={historicFrom}
                onChange={e => { setHistoricFrom(e.target.value); setHistoricPeriod('') }}
                style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: t.textSub }}>A:</span>
              <input
                type='date'
                value={historicTo}
                onChange={e => { setHistoricTo(e.target.value); setHistoricPeriod('') }}
                style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
              />
              {(historicFrom || historicTo) && (
                <button
                  onClick={() => { setHistoricFrom(''); setHistoricTo(''); setHistoricPeriod('all') }}
                  style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕ reset
                </button>
              )}
            </div>
          </div>

          {/* Contatore */}
          {(historicPeriod !== 'all' || historicFrom || historicTo) && (
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8, paddingLeft: 4 }}>
              {visibleGames.length} partita{visibleGames.length !== 1 ? 'e' : ''} nel periodo selezionato
            </div>
          )}

          {visibleGames.length === 0 && (
            games.length === 0
              ? <EmptyState icon="🃏" title="Storico vuoto" message="Nessuna partita registrata. Vai su '+ Partita' per aggiungerne una." />
              : <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>Nessuna partita nel periodo selezionato</div>
          )}

          {visibleGames.map(g => {
            const winner = g.players.find(p => p.isWinner)
            const date = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={g.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div
                    onClick={() => navigate(`/partita/${g.id}`)}
                    title="Apri la partita"
                    style={{ fontSize: 12, color: t.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}>{date}</span>
                    <span>· {g.players.length} giocatori</span>
                    <span style={{ color: t.primary, fontWeight: 700 }}>›</span>
                  </div>
                  {winner && (
                    <span style={{ fontSize: 12, background: t.winBg, color: t.win, padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                      {winner.user.username} · {winner.deck.name}
                    </span>
                  )}
                </div>
                {(() => {
                  const ranked = g.players.every(p => p.placement != null)
                  const ordered = ranked ? [...g.players].sort((a, b) => a.placement - b.placement) : g.players
                  return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ordered.map(p => (
                        <span
                          key={p.id}
                          onClick={() => navigate(`/mazzo/${p.deck.id}`)}
                          title="Apri il profilo del mazzo"
                          style={{
                            fontSize: 12, padding: '3px 10px 3px 4px', borderRadius: 20,
                            background: p.isWinner ? t.winBg : t.bgMuted,
                            color: p.isWinner ? t.win : t.textSub,
                            display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                          }}
                        >
                          <DeckThumb commander={p.deck.commander} w={20} round preview={false} />
                          {ranked && <span style={{ fontWeight: 800, opacity: 0.8 }}>{p.placement}°</span>}
                          {p.user.username} · {p.deck.name}
                        </span>
                      ))}
                    </div>
                  )
                })()}
                {(() => {
                  const kills = g.players.filter(p => p.eliminatedById)
                  if (kills.length === 0) return null
                  return (
                    <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                      {kills.map(p => {
                        const killer = g.players.find(x => x.user.id === p.eliminatedById)
                        return <span key={p.id}>⚔️ {killer?.user.username || '?'} → {p.user.username}</span>
                      })}
                    </div>
                  )
                })()}
                {g.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8, fontStyle: 'italic' }}>{g.notes}</div>}
                <GameSocial game={g} />
              </div>
            )
          })}
        </div>
      )}

      {/* PRIMATI */}
      {tab === 'primati' && (
        <div>
          {!records ? (
            <EmptyState icon="🏆" title="Nessun primato ancora" message="Servono partite registrate per calcolare record e statistiche del gruppo." />
          ) : (
            <>
              {/* Card record */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 18 }}>
                {[
                  { icon: '👑', label: 'Re del mese', value: records.kingOfMonth?.[0] || '—', sub: records.kingOfMonth ? `${records.kingOfMonth[1]} vittorie questo mese` : 'nessuna partita questo mese' },
                  { icon: '🔥', label: 'Streak record', value: records.longestStreak ? `${records.longestStreak.best} di fila` : '—', sub: records.longestStreak?.username || '' },
                  { icon: '🏅', label: 'Più vittorie', value: records.mostWins?.username || '—', sub: records.mostWins ? `${records.mostWins.wins} vittorie` : '' },
                  { icon: '📈', label: 'Miglior win rate', value: records.bestRate ? `${records.bestRate.winRate}%` : '—', sub: records.bestRate ? `${records.bestRate.username} · min 5 partite` : 'min 5 partite' },
                  { icon: '🎴', label: 'Mazzo più forte', value: records.topDeck?.name || '—', sub: records.topDeck ? `${records.topDeck.owner} · ${records.topDeck.winRate}%` : 'min 3 partite' },
                  { icon: '🎲', label: 'Più presenze', value: records.mostGames?.username || '—', sub: records.mostGames ? `${records.mostGames.games} partite` : '' },
                  { icon: '🪑', label: 'Tavolo più affollato', value: `${records.biggestTable.players.length} giocatori`, sub: new Date(records.biggestTable.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) },
                  { icon: '🛡️', label: 'Re della sopravvivenza', value: records.survivalKing?.username || '—', sub: records.survivalKing ? `piazz. medio ${records.survivalKing.avg.toFixed(1)}° · min 3 partite` : 'serve l\'ordine di uscita' },
                  { icon: '🪦', label: 'Sfortunato', value: records.unluckiest?.username || '—', sub: records.unluckiest ? `${records.unluckiest.firstOuts}× primo eliminato` : 'serve l\'ordine di uscita' },
                  { icon: '⚔️', label: 'Più spietato', value: records.mostRuthless?.[0] || '—', sub: records.mostRuthless ? `${records.mostRuthless[1]} eliminazioni` : 'serve il kill tracking' },
                  { icon: '🎯', label: 'Bersaglio', value: records.biggestTarget?.[0] || '—', sub: records.biggestTarget ? `eliminato ${records.biggestTarget[1]}× in totale` : 'serve il kill tracking' },
                ].map((r, i) => (
                  <div key={i} style={{ ...card, marginBottom: 0, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.gradient }} />
                    <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>
                      {r.icon} {r.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.text, lineHeight: 1.15 }}>{r.value}</div>
                    {r.sub && <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 4 }}>{r.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Meta colori */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>Meta colori · win rate per identità</div>
                {colorMeta.every(c => c.games === 0) ? (
                  <div style={{ fontSize: 13, color: t.textMuted }}>Nessun dato</div>
                ) : colorMeta.map(c => {
                  const COLOR_BG = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
                  const COLOR_LBL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }
                  return (
                    <div key={c.color} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: COLOR_BG[c.color], border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.color}</span>
                      <span style={{ fontSize: 12, color: t.textSub, width: 52, flexShrink: 0 }}>{COLOR_LBL[c.color]}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.bgMuted, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${c.winRate}%`, background: t.primary, borderRadius: 4, transition: 'width 0.4s' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text, width: 38, textAlign: 'right', flexShrink: 0 }}>{c.winRate}%</span>
                      <span style={{ fontSize: 11, color: t.textMuted, width: 60, textAlign: 'right', flexShrink: 0 }}>{c.games} pres.</span>
                    </div>
                  )
                })}
              </div>

              {/* Attività per mese */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>Attività · partite per mese</div>
                {(() => {
                  const max = Math.max(1, ...activity.map(m => m.count))
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 130 }}>
                      {activity.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: m.count ? t.text : t.textMuted }}>{m.count || ''}</div>
                          <div style={{
                            width: '100%', maxWidth: 38, height: `${(m.count / max) * 90}px`, minHeight: m.count ? 4 : 2,
                            background: m.count ? t.gradient : t.bgMuted,
                            borderRadius: 6, transition: 'height 0.4s',
                          }} />
                          <div style={{ fontSize: 10.5, color: t.textSub, textTransform: 'capitalize' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
