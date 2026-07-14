import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useCountUp } from '../hooks/useCountUp'
import { SkeletonList, Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import BracketBadge from '../components/BracketBadge'
import GameSocial from '../components/GameSocial'
import { listSeasons, computeStandings, seasonOf } from '../lib/seasons'
import PlayerAvatar from '../components/PlayerAvatar'
import SeasonRecap from '../components/SeasonRecap'

// ─── piccoli helper ────────────────────────────────────────

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div className="ct-bar-fill" style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3 }} />
    </div>
  )
}


const METRIC_ICONS = {
  partite: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="4" width="8" height="14" rx="1.5" transform="rotate(-18 12 18)"/>
      <rect x="8" y="4" width="8" height="14" rx="1.5" transform="rotate(18 12 18)"/>
      <rect x="8" y="3" width="8" height="15" rx="1.5"/>
    </svg>
  ),
  giocatori: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  mazzi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="17"/>
      <line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>
    </svg>
  ),
  top: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
}

function MetricCard({ label, value, icon, t }) {
  const shown = useCountUp(value)
  return (
    <div style={{
      background: t.bgSurface,
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      borderRadius: 16, padding: '1rem 1.15rem',
      border: `1px solid ${t.border}`, boxShadow: t.shadow,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.gradient }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
        {icon && <span style={{ color: t.primary, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, lineHeight: 1 }}>{shown}</div>
    </div>
  )
}

function SectionHeader({ icon, title, collapsible, open, onToggle, t }) {
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, marginTop: 28,
        cursor: collapsible ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{title}</span>
      </div>
      {collapsible && (
        <span style={{ fontSize: 12, color: t.textMuted, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      )}
    </div>
  )
}

// ─── main ──────────────────────────────────────────────────

const TABS = [
  { key: 'stagione',  label: 'Stagione' },
  { key: 'giocatori', label: 'Giocatori' },
  { key: 'mazzi',     label: 'Mazzi' },
  { key: 'storico',   label: 'Storico' },
]

export default function GruppoPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const { activeGroup } = useGroup()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const qTab = searchParams.get('tab')
  const tab = TABS.some(x => x.key === qTab) ? qTab : 'stagione'
  const setTab = (next) => setSearchParams(next === 'stagione' ? {} : { tab: next }, { replace: true })

  const [games, setGames]             = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [deckStats, setDeckStats]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Sezioni collassabili (stagione tab)
  const [showPrimati, setShowPrimati] = useState(true)
  const [showMeta, setShowMeta]       = useState(false)
  const [showRecap, setShowRecap]     = useState(false)

  // Stagione
  const [seasonKey, setSeasonKey] = useState(null)

  // Storico filtri
  const [historicPeriod, setHistoricPeriod] = useState('all')
  const [historicFrom,   setHistoricFrom]   = useState('')
  const [historicTo,     setHistoricTo]     = useState('')

  useEffect(() => {
    Promise.all([api.getGames(), api.statsPlayers(), api.statsDecks()])
      .then(([g, p, d]) => { setGames(g); setPlayerStats(p); setDeckStats(d) })
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false))
  }, [])

  // ── Stagione ──
  const seasons = useMemo(() => listSeasons(games), [games])
  useEffect(() => { if (seasons.length > 0 && !seasonKey) setSeasonKey(seasons[0].key) }, [seasons])
  const season = useMemo(() => (seasonKey ? computeStandings(games, seasonKey) : null), [games, seasonKey])

  // ── Storico filtrato ──
  const visibleGames = useMemo(() => {
    const hasCustom = historicFrom || historicTo
    let from = null, to = null
    if (hasCustom) {
      if (historicFrom) from = new Date(historicFrom + 'T00:00:00')
      if (historicTo)   to   = new Date(historicTo + 'T23:59:59')
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

  // ── Primati ──
  const records = useMemo(() => {
    if (games.length === 0) return null
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
    const biggestTable = games.reduce((max, g) => g.players.length > max.players.length ? g : max, games[0])
    const mostWins  = [...playerStats].sort((a, b) => b.wins - a.wins)[0]
    const mostGames = [...playerStats].sort((a, b) => b.games - a.games)[0]
    const bestRate  = [...playerStats].filter(p => p.games >= 5).sort((a, b) => b.winRate - a.winRate)[0]
    const topDeck   = [...deckStats].filter(d => d.games >= 3).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0]
    const placeStats = {}
    for (const g of games) {
      if (!g.players.every(p => p.placement != null)) continue
      for (const p of g.players) {
        if (!placeStats[p.user.id]) placeStats[p.user.id] = { username: p.user.username, sum: 0, n: 0, firstOuts: 0 }
        const ps = placeStats[p.user.id]
        ps.sum += p.placement; ps.n++
        if (p.placement === g.players.length) ps.firstOuts++
      }
    }
    const placeArr = Object.values(placeStats)
    const survivalKing = placeArr.filter(p => p.n >= 3).map(p => ({ ...p, avg: p.sum / p.n })).sort((a, b) => a.avg - b.avg)[0]
    const unluckiest   = placeArr.filter(p => p.firstOuts > 0).sort((a, b) => b.firstOuts - a.firstOuts)[0]
    const killTally = {}, deathTally = {}
    for (const g of games) {
      for (const p of g.players) {
        if (!p.eliminatedById) continue
        deathTally[p.user.username] = (deathTally[p.user.username] || 0) + 1
        const killer = g.players.find(x => x.user.id === p.eliminatedById)
        if (killer) killTally[killer.user.username] = (killTally[killer.user.username] || 0) + 1
      }
    }
    const mostRuthless  = Object.entries(killTally).sort((a, b) => b[1] - a[1])[0] || null
    const biggestTarget = Object.entries(deathTally).sort((a, b) => b[1] - a[1])[0] || null
    return { longestStreak, kingOfMonth, biggestTable, mostWins, mostGames, bestRate, topDeck, survivalKing, unluckiest, mostRuthless, biggestTarget }
  }, [games, playerStats, deckStats])

  // ── Meta colori ──
  const colorMeta = useMemo(() => {
    const order = ['W', 'U', 'B', 'R', 'G']
    const tally = Object.fromEntries(order.map(c => [c, { games: 0, wins: 0 }]))
    for (const g of games) {
      for (const p of g.players) {
        const cols = (p.deck.colors || '').split('')
        for (const c of order) {
          if (cols.includes(c)) { tally[c].games++; if (p.isWinner) tally[c].wins++ }
        }
      }
    }
    return order.map(c => ({ color: c, games: tally[c].games, winRate: tally[c].games ? Math.round(tally[c].wins / tally[c].games * 100) : 0 }))
  }, [games])

  // ── Attività mensile ──
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
    borderRadius: 14, padding: '1rem 1.25rem',
    marginBottom: 10, boxShadow: t.shadow,
  }

  if (loading) return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={78} r={16} />)}
      </div>
      <SkeletonList rows={5} />
    </div>
  )
  if (error) return <EmptyState icon="⚠️" title="Errore" message={error} />

  const totalGames = games.length
  const topPlayer  = playerStats[0]

  return (
    <>
    <div>
      {/* Metriche globali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
        <MetricCard label="Partite totali"   value={totalGames}          icon={METRIC_ICONS.partite}   t={t} />
        <MetricCard label="Giocatori"        value={playerStats.length}  icon={METRIC_ICONS.giocatori} t={t} />
        <MetricCard label="Mazzi"            value={deckStats.length}    icon={METRIC_ICONS.mazzi}     t={t} />
        <MetricCard label="Top player"       value={topPlayer?.username || '—'} icon={METRIC_ICONS.top} t={t} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 14px',
                border: 'none', borderBottom: active ? `2px solid ${t.primary}` : '2px solid transparent',
                background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? t.primary : t.textSub,
                marginBottom: -1, borderRadius: 0,
                transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div key={tab} className="ct-fade-up">
      {/* ══════════ TAB: STAGIONE ══════════ */}
      {tab === 'stagione' && (
        <div>
          {seasons.length === 0 || !season ? (
            <EmptyState icon="🏆" title="Nessuna stagione ancora" message="Registrate qualche partita per far partire la classifica stagionale." />
          ) : (
            <>
              {(() => {
                const currentSeasonKey = seasonOf(new Date()).key
                const isCompleted = seasonKey !== currentSeasonKey
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <select
                      value={seasonKey || ''}
                      onChange={e => { setSeasonKey(e.target.value); setShowRecap(false) }}
                      style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                    >
                      {seasons.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: t.textMuted, flex: 1 }}>{season.total} partite · qualificato da {season.threshold}</span>
                    {isCompleted && (
                      <button
                        onClick={() => setShowRecap(true)}
                        className="ct-press"
                        style={{
                          padding: '6px 12px', borderRadius: 20, border: `1px solid ${t.primaryBorder}`,
                          background: t.primaryBg, color: t.primary,
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        🏅 Infografica
                      </button>
                    )}
                  </div>
                )
              })()}

              {season.champion && (
                <div className="ct-fade-up" style={{
                  ...card, display: 'flex', alignItems: 'center', gap: 14,
                  background: `linear-gradient(135deg, ${t.primaryBg} 0%, ${t.bgSurface} 60%)`,
                  borderColor: t.primaryBorder,
                  boxShadow: `${t.shadow}, 0 0 24px ${t.primary}22`,
                }}>
                  <div style={{ fontSize: 38, lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(52,240,143,0.4))' }}>🏆</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>In testa alla stagione</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: t.text, lineHeight: 1.1, marginTop: 2 }}>{season.champion.username}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: t.primary, lineHeight: 1, filter: `drop-shadow(0 0 8px ${t.primary}60)` }}>{season.champion.points}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: '0.04em' }}>punti</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11.5, color: t.textMuted, margin: '4px 4px 10px' }}>
                Punteggio: 1° = 3 · 2° = 2 · 3° = 1 · +1 presenza a ogni partita
              </div>

              {season.standings.map((s, i) => (
                <div key={s.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/giocatore/${s.id}`)} style={{ ...card, cursor: 'pointer', opacity: s.qualified ? 1 : 0.62, animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ minWidth: 28, textAlign: 'center', flexShrink: 0 }}>
                        {i < 3 && s.qualified
                          ? <span style={{ fontSize: 20, lineHeight: 1 }}>{['🥇', '🥈', '🥉'][i]}</span>
                          : <span style={{ fontSize: 13, fontWeight: 700, color: t.textMuted }}>{i + 1}°</span>
                        }
                      </div>
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

          {/* ── PRIMATI ── */}
          <SectionHeader icon="🥇" title="Primati" collapsible open={showPrimati} onToggle={() => setShowPrimati(v => !v)} t={t} />
          {showPrimati && (
            !records ? (
              <EmptyState icon="🏆" title="Nessun primato ancora" message="Servono partite registrate per calcolare record e statistiche del gruppo." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                {[
                  { icon: '👑', label: 'Re del mese',      value: records.kingOfMonth?.[0] || '—',                        sub: records.kingOfMonth ? `${records.kingOfMonth[1]} vittorie` : 'nessuna partita' },
                  { icon: '🔥', label: 'Streak record',     value: records.longestStreak ? `${records.longestStreak.best}×` : '—', sub: records.longestStreak?.username || '' },
                  { icon: '🏅', label: 'Più vittorie',      value: records.mostWins?.username || '—',                      sub: records.mostWins ? `${records.mostWins.wins} vinte` : '' },
                  { icon: '📈', label: 'Miglior win rate',  value: records.bestRate ? `${records.bestRate.winRate}%` : '—', sub: records.bestRate?.username || 'min 5 partite' },
                  { icon: '🎴', label: 'Mazzo più forte',   value: records.topDeck?.name || '—',                           sub: records.topDeck ? `${records.topDeck.winRate}%` : 'min 3 partite' },
                  { icon: '🎲', label: 'Più presenze',      value: records.mostGames?.username || '—',                     sub: records.mostGames ? `${records.mostGames.games} partite` : '' },
                  { icon: '🪑', label: 'Tavolo record',     value: `${records.biggestTable.players.length} giocatori`,     sub: new Date(records.biggestTable.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) },
                  { icon: '🛡️', label: 'Re sopravv.',       value: records.survivalKing?.username || '—',                  sub: records.survivalKing ? `avg ${records.survivalKing.avg.toFixed(1)}°` : 'serve ordine uscita' },
                  { icon: '🪦', label: 'Sfortunato',        value: records.unluckiest?.username || '—',                    sub: records.unluckiest ? `${records.unluckiest.firstOuts}× 1° elim.` : 'serve ordine uscita' },
                  { icon: '⚔️', label: 'Più spietato',      value: records.mostRuthless?.[0] || '—',                      sub: records.mostRuthless ? `${records.mostRuthless[1]} elim.` : 'serve kill tracking' },
                  { icon: '🎯', label: 'Bersaglio',         value: records.biggestTarget?.[0] || '—',                     sub: records.biggestTarget ? `eliminato ${records.biggestTarget[1]}×` : 'serve kill tracking' },
                ].map((r, i) => (
                  <div key={i} style={{ background: t.bgSurface, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${t.border}`, borderRadius: 12, padding: '0.6rem 0.75rem', boxShadow: t.shadow, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.gradient }} />
                    <div style={{ fontSize: 10, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 5 }}>{r.icon} {r.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: t.text, lineHeight: 1.2, wordBreak: 'break-word' }}>{r.value}</div>
                    {r.sub && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3 }}>{r.sub}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── META COLORI ── */}
          <SectionHeader icon="🎨" title="Meta colori" collapsible open={showMeta} onToggle={() => setShowMeta(v => !v)} t={t} />
          {showMeta && (
            <div style={card}>
              {colorMeta.every(c => c.games === 0) ? (
                <div style={{ fontSize: 13, color: t.textMuted }}>Nessun dato</div>
              ) : colorMeta.map(c => {
                const COLOR_BG  = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
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

              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Attivita · partite per mese</div>
                {(() => {
                  const max = Math.max(1, ...activity.map(m => m.count))
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 130 }}>
                      {activity.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: m.count ? t.text : t.textMuted }}>{m.count || ''}</div>
                          <div style={{ width: '100%', maxWidth: 38, height: `${(m.count / max) * 90}px`, minHeight: m.count ? 4 : 2, background: m.count ? t.gradient : t.bgMuted, borderRadius: 6, transition: 'height 0.4s' }} />
                          <div style={{ fontSize: 10.5, color: t.textSub, textTransform: 'capitalize' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: GIOCATORI ══════════ */}
      {tab === 'giocatori' && (
        <div>
          {playerStats.length === 0 ? (
            <EmptyState icon="👥" title="Nessun giocatore" message="Nessuna partita registrata ancora." />
          ) : (
            playerStats.map((p, i) => (
              <div key={p.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/giocatore/${p.id}`)} style={{ ...card, cursor: 'pointer', animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? t.primary : t.textMuted, minWidth: 22, textAlign: 'right' }}>{i + 1}°</span>
                  <PlayerAvatar username={p.username} avatarCardName={p.avatarCardName} avatarScryfallId={p.avatarScryfallId} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: t.text, fontSize: 15 }}>{p.username}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>{p.games} partite · {p.wins} vittorie</div>
                    <WinBar pct={p.winRate} t={t} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: p.winRate >= 30 ? t.win : t.text, lineHeight: 1 }}>{p.winRate}%</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>win rate</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════ TAB: MAZZI ══════════ */}
      {tab === 'mazzi' && (
        <div>
          {deckStats.length === 0 ? (
            <EmptyState icon="🃏" title="Nessun mazzo" message="Nessun mazzo registrato ancora." />
          ) : (
            [...deckStats].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins).map((d, i) => (
              <div key={d.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/mazzo/${d.id}`)} style={{ ...card, cursor: 'pointer', animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <DeckThumb commander={d.commander} w={38} round preview={false} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>{d.name}</span>
                      {d.bracket && <BracketBadge bracket={d.bracket} />}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>{d.owner} · {d.games} partite · {d.wins} vittorie</div>
                    <WinBar pct={d.winRate} t={t} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: d.winRate >= 30 ? t.win : t.text, lineHeight: 1 }}>{d.winRate}%</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>win rate</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════ TAB: STORICO ══════════ */}
      {tab === 'storico' && (
        <div>
          {/* Filtri data */}
          <div style={{ background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '0.85rem 1rem', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Periodo:</span>
              {[
                { key: 'all', label: 'Tutto' }, { key: '7d', label: '7 giorni' },
                { key: '30d', label: 'Mese' }, { key: '90d', label: '3 mesi' },
                { key: '180d', label: '6 mesi' },
              ].map(({ key, label }) => {
                const active = !historicFrom && !historicTo && historicPeriod === key
                return (
                  <button key={key} onClick={() => { setHistoricPeriod(key); setHistoricFrom(''); setHistoricTo('') }} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.12s', background: active ? t.primary : t.bgMuted, color: active ? t.primaryFg : t.textSub }}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: t.textSub }}>Da:</span>
              <input type='date' value={historicFrom} onChange={e => { setHistoricFrom(e.target.value); setHistoricPeriod('') }} style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: t.textSub }}>A:</span>
              <input type='date' value={historicTo}   onChange={e => { setHistoricTo(e.target.value); setHistoricPeriod('') }} style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }} />
              {(historicFrom || historicTo) && (
                <button onClick={() => { setHistoricFrom(''); setHistoricTo(''); setHistoricPeriod('all') }} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}>✕ reset</button>
              )}
            </div>
          </div>

          {(historicPeriod !== 'all' || historicFrom || historicTo) && (
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8, paddingLeft: 4 }}>
              {visibleGames.length} partita{visibleGames.length !== 1 ? 'e' : ''} nel periodo selezionato
            </div>
          )}

          {visibleGames.length === 0 && (
            games.length === 0
              ? <EmptyState icon="🃏" title="Storico vuoto" message="Nessuna partita registrata. Vai su Gioca per aggiungerne una." />
              : <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>Nessuna partita nel periodo selezionato</div>
          )}

          {visibleGames.map(g => {
            const winner = g.players.find(p => p.isWinner)
            const date   = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={g.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div onClick={() => navigate(`/partita/${g.id}`)} style={{ fontSize: 12, color: t.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
                  const ranked  = g.players.every(p => p.placement != null)
                  const ordered = ranked ? [...g.players].sort((a, b) => a.placement - b.placement) : g.players
                  return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ordered.map(p => (
                        <span key={p.id} onClick={() => navigate(`/mazzo/${p.deck.id}`)} style={{ fontSize: 12, padding: '3px 10px 3px 4px', borderRadius: 20, background: p.isWinner ? t.winBg : t.bgMuted, color: p.isWinner ? t.win : t.textSub, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
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
      </div>
    </div>
    {showRecap && season && (
      <SeasonRecap
        season={season}
        seasonKey={seasonKey}
        seasons={seasons}
        games={games}
        playerStats={playerStats}
        groupName={activeGroup?.name}
        onClose={() => setShowRecap(false)}
      />
    )}
    </>
  )
}
