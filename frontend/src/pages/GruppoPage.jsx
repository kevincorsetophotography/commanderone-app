import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { listSeasons, computeStandings, seasonOf, seasonLabel } from '../lib/seasons'
import { ordinal } from '../lib/ordinal'
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

const TAB_KEYS = ['stagione', 'giocatori', 'mazzi', 'storico']
const TAB_LABEL_KEY = { stagione: 'season', giocatori: 'players', mazzi: 'decks', storico: 'history' }

export default function GruppoPage() {
  const { t } = useTheme()
  const { t: tr, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'it-IT'
  const { user } = useAuth()
  const { activeGroup } = useGroup()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const qTab = searchParams.get('tab')
  const tab = TAB_KEYS.includes(qTab) ? qTab : 'stagione'
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
      .catch(() => setError(tr('gruppoPage.loadError')))
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
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(locale, { month: 'short' }), count: 0 })
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]))
    for (const g of games) {
      const d = new Date(g.playedAt)
      const k = `${d.getFullYear()}-${d.getMonth()}`
      if (k in idx) months[idx[k]].count++
    }
    return months
  }, [games, locale])

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
  if (error) return <EmptyState icon="⚠️" title={tr('gruppoPage.errorTitle')} message={error} />

  const totalGames = games.length
  const topPlayer  = playerStats[0]

  return (
    <>
    <div>
      {/* Metriche globali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
        <MetricCard label={tr('gruppoPage.metrics.totalGames')} value={totalGames}          icon={METRIC_ICONS.partite}   t={t} />
        <MetricCard label={tr('gruppoPage.metrics.players')}    value={playerStats.length}  icon={METRIC_ICONS.giocatori} t={t} />
        <MetricCard label={tr('gruppoPage.metrics.decks')}      value={deckStats.length}     icon={METRIC_ICONS.mazzi}     t={t} />
        <MetricCard label={tr('gruppoPage.metrics.topPlayer')}  value={topPlayer?.username || '—'} icon={METRIC_ICONS.top} t={t} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
        {TAB_KEYS.map(key => {
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
              {tr(`gruppoPage.tabs.${TAB_LABEL_KEY[key]}`)}
            </button>
          )
        })}
      </div>

      <div key={tab} className="ct-fade-up">
      {/* ══════════ TAB: STAGIONE ══════════ */}
      {tab === 'stagione' && (
        <div>
          {seasons.length === 0 || !season ? (
            <EmptyState icon="🏆" title={tr('gruppoPage.noSeasonTitle')} message={tr('gruppoPage.noSeasonMessage')} />
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
                      {seasons.map(s => <option key={s.key} value={s.key}>{seasonLabel(s.key, tr)}</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: t.textMuted, flex: 1 }}>{tr('gruppoPage.seasonSummary', { total: season.total, threshold: season.threshold })}</span>
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
                        {tr('gruppoPage.infographic')}
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
                    <div style={{ fontSize: 10, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>{tr('gruppoPage.seasonLeader')}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: t.text, lineHeight: 1.1, marginTop: 2 }}>{season.champion.username}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: t.primary, lineHeight: 1, filter: `drop-shadow(0 0 8px ${t.primary}60)` }}>{season.champion.points}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: '0.04em' }}>{tr('gruppoPage.points')}</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11.5, color: t.textMuted, margin: '4px 4px 10px' }}>
                {tr('gruppoPage.scoringExplanation')}
              </div>

              {season.standings.map((s, i) => (
                <div key={s.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/giocatore/${s.id}`)} style={{ ...card, cursor: 'pointer', opacity: s.qualified ? 1 : 0.62, animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ minWidth: 28, textAlign: 'center', flexShrink: 0 }}>
                        {i < 3 && s.qualified
                          ? <span style={{ fontSize: 20, lineHeight: 1 }}>{['🥇', '🥈', '🥉'][i]}</span>
                          : <span style={{ fontSize: 13, fontWeight: 700, color: t.textMuted }}>{ordinal(i + 1, locale)}</span>
                        }
                      </div>
                      <PlayerAvatar username={s.username} avatarCardName={playerStats.find(p => p.id === s.id)?.avatarCardName} avatarScryfallId={playerStats.find(p => p.id === s.id)?.avatarScryfallId} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {s.username}
                          {!s.qualified && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, border: `1px solid ${t.border}`, borderRadius: 6, padding: '1px 5px' }}>{tr('gruppoPage.notQualified')}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSub }}>{tr('gruppoPage.gamesCount', { count: s.games })} · {tr('gruppoPage.winsCount', { count: s.wins })}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{s.points}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{tr('gruppoPage.points')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── PRIMATI ── */}
          <SectionHeader icon="🥇" title={tr('gruppoPage.records.sectionTitle')} collapsible open={showPrimati} onToggle={() => setShowPrimati(v => !v)} t={t} />
          {showPrimati && (
            !records ? (
              <EmptyState icon="🏆" title={tr('gruppoPage.records.emptyTitle')} message={tr('gruppoPage.records.emptyMessage')} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                {[
                  { icon: '👑', label: tr('gruppoPage.records.kingOfMonthLabel'), value: records.kingOfMonth?.[0] || '—',                        sub: records.kingOfMonth ? tr('gruppoPage.winsCount', { count: records.kingOfMonth[1] }) : tr('gruppoPage.records.kingOfMonthNone') },
                  { icon: '🔥', label: tr('gruppoPage.records.streakLabel'),     value: records.longestStreak ? `${records.longestStreak.best}×` : '—', sub: records.longestStreak?.username || '' },
                  { icon: '🏅', label: tr('gruppoPage.records.mostWinsLabel'),      value: records.mostWins?.username || '—',                      sub: records.mostWins ? tr('gruppoPage.records.mostWinsSub', { count: records.mostWins.wins }) : '' },
                  { icon: '📈', label: tr('gruppoPage.records.bestRateLabel'),  value: records.bestRate ? `${records.bestRate.winRate}%` : '—', sub: records.bestRate?.username || tr('gruppoPage.records.bestRateFallback') },
                  { icon: '🎴', label: tr('gruppoPage.records.topDeckLabel'),   value: records.topDeck?.name || '—',                           sub: records.topDeck ? `${records.topDeck.winRate}%` : tr('gruppoPage.records.topDeckFallback') },
                  { icon: '🎲', label: tr('gruppoPage.records.mostGamesLabel'),      value: records.mostGames?.username || '—',                     sub: records.mostGames ? tr('gruppoPage.gamesCount', { count: records.mostGames.games }) : '' },
                  { icon: '🪑', label: tr('gruppoPage.records.biggestTableLabel'),     value: tr('gamePage.playersCount', { count: records.biggestTable.players.length }),     sub: new Date(records.biggestTable.playedAt).toLocaleDateString(locale, { day: '2-digit', month: 'short' }) },
                  { icon: '🛡️', label: tr('gruppoPage.records.survivalKingLabel'),       value: records.survivalKing?.username || '—',                  sub: records.survivalKing ? tr('gruppoPage.records.survivalKingSub', { value: records.survivalKing.avg.toFixed(1) }) : tr('gruppoPage.records.noOrderData') },
                  { icon: '🪦', label: tr('gruppoPage.records.unluckiestLabel'),        value: records.unluckiest?.username || '—',                    sub: records.unluckiest ? tr('gruppoPage.records.unluckiestSub', { count: records.unluckiest.firstOuts, ord: ordinal(1, locale) }) : tr('gruppoPage.records.noOrderData') },
                  { icon: '⚔️', label: tr('gruppoPage.records.mostRuthlessLabel'),      value: records.mostRuthless?.[0] || '—',                      sub: records.mostRuthless ? tr('gruppoPage.records.mostRuthlessSub', { count: records.mostRuthless[1] }) : tr('gruppoPage.records.noKillTracking') },
                  { icon: '🎯', label: tr('gruppoPage.records.biggestTargetLabel'),         value: records.biggestTarget?.[0] || '—',                     sub: records.biggestTarget ? tr('gruppoPage.records.biggestTargetSub', { count: records.biggestTarget[1] }) : tr('gruppoPage.records.noKillTracking') },
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
          <SectionHeader icon="🎨" title={tr('gruppoPage.colorMetaTitle')} collapsible open={showMeta} onToggle={() => setShowMeta(v => !v)} t={t} />
          {showMeta && (
            <div style={card}>
              {colorMeta.every(c => c.games === 0) ? (
                <div style={{ fontSize: 13, color: t.textMuted }}>{tr('gruppoPage.noData')}</div>
              ) : colorMeta.map(c => {
                const COLOR_BG = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
                return (
                  <div key={c.color} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: COLOR_BG[c.color], border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.color}</span>
                    <span style={{ fontSize: 12, color: t.textSub, width: 52, flexShrink: 0 }}>{tr(`colors.${c.color}`)}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.bgMuted, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.winRate}%`, background: t.primary, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text, width: 38, textAlign: 'right', flexShrink: 0 }}>{c.winRate}%</span>
                    <span style={{ fontSize: 11, color: t.textMuted, width: 60, textAlign: 'right', flexShrink: 0 }}>{tr('gruppoPage.appearancesCount', { count: c.games })}</span>
                  </div>
                )
              })}

              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>{tr('gruppoPage.monthlyActivity')}</div>
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
            <EmptyState icon="👥" title={tr('gruppoPage.noPlayersTitle')} message={tr('gruppoPage.noPlayersMessage')} />
          ) : (
            playerStats.map((p, i) => (
              <div key={p.id} className="ct-lift ct-fade-up" onClick={() => navigate(`/giocatore/${p.id}`)} style={{ ...card, cursor: 'pointer', animationDelay: `${Math.min(i, 7) * 45}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? t.primary : t.textMuted, minWidth: 22, textAlign: 'right' }}>{ordinal(i + 1, locale)}</span>
                  <PlayerAvatar username={p.username} avatarCardName={p.avatarCardName} avatarScryfallId={p.avatarScryfallId} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: t.text, fontSize: 15 }}>{p.username}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>{tr('gruppoPage.gamesCount', { count: p.games })} · {tr('gruppoPage.winsCount', { count: p.wins })}</div>
                    <WinBar pct={p.winRate} t={t} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: p.winRate >= 30 ? t.win : t.text, lineHeight: 1 }}>{p.winRate}%</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{tr('feed.winRate')}</div>
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
            <EmptyState icon="🃏" title={tr('gruppoPage.noDecksTitle')} message={tr('gruppoPage.noDecksMessage')} />
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
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>{d.owner} · {tr('gruppoPage.gamesCount', { count: d.games })} · {tr('gruppoPage.winsCount', { count: d.wins })}</div>
                    <WinBar pct={d.winRate} t={t} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: d.winRate >= 30 ? t.win : t.text, lineHeight: 1 }}>{d.winRate}%</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{tr('feed.winRate')}</div>
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
              <span style={{ fontSize: 12, color: t.textSub }}>{tr('gruppoPage.periodLabel')}</span>
              {[
                { key: 'all', labelKey: 'all' }, { key: '7d', labelKey: '7d' },
                { key: '30d', labelKey: '30d' }, { key: '90d', labelKey: '90d' },
                { key: '180d', labelKey: '180d' },
              ].map(({ key, labelKey }) => {
                const active = !historicFrom && !historicTo && historicPeriod === key
                return (
                  <button key={key} onClick={() => { setHistoricPeriod(key); setHistoricFrom(''); setHistoricTo('') }} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.12s', background: active ? t.primary : t.bgMuted, color: active ? t.primaryFg : t.textSub }}>
                    {tr(`gruppoPage.periods.${labelKey}`)}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: t.textSub }}>{tr('gruppoPage.fromLabel')}</span>
              <input type='date' value={historicFrom} onChange={e => { setHistoricFrom(e.target.value); setHistoricPeriod('') }} style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: t.textSub }}>{tr('gruppoPage.toLabel')}</span>
              <input type='date' value={historicTo}   onChange={e => { setHistoricTo(e.target.value); setHistoricPeriod('') }} style={{ padding: '4px 8px', borderRadius: 6, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none', cursor: 'pointer' }} />
              {(historicFrom || historicTo) && (
                <button onClick={() => { setHistoricFrom(''); setHistoricTo(''); setHistoricPeriod('all') }} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}>{tr('gruppoPage.resetFilter')}</button>
              )}
            </div>
          </div>

          {(historicPeriod !== 'all' || historicFrom || historicTo) && (
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8, paddingLeft: 4 }}>
              {tr('gruppoPage.gamesInPeriod', { count: visibleGames.length })}
            </div>
          )}

          {visibleGames.length === 0 && (
            games.length === 0
              ? <EmptyState icon="🃏" title={tr('gruppoPage.emptyHistoryTitle')} message={tr('gruppoPage.emptyHistoryMessage')} />
              : <div style={{ ...card, color: t.textSub, fontSize: 14, textAlign: 'center', padding: '2rem' }}>{tr('gruppoPage.noGamesInPeriod')}</div>
          )}

          {visibleGames.map(g => {
            const winner = g.players.find(p => p.isWinner)
            const date   = new Date(g.playedAt).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={g.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div onClick={() => navigate(`/partita/${g.id}`)} style={{ fontSize: 12, color: t.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}>{date}</span>
                    <span>· {tr('gamePage.playersCount', { count: g.players.length })}</span>
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
                          {ranked && <span style={{ fontWeight: 800, opacity: 0.8 }}>{ordinal(p.placement, locale)}</span>}
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
