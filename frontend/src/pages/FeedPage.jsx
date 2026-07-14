import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { seasonOf, computeStandings } from '../lib/seasons'
import { Skeleton, SkeletonList } from '../components/Skeleton'
import PlayerAvatar from '../components/PlayerAvatar'

// ─── helpers ──────────────────────────────────────────────

function relativeDate(date) {
  const now = new Date()
  const d = new Date(date)
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Oggi'
  if (diffDays === 1) return 'Ieri'
  if (diffDays < 7) return `${diffDays} gg fa`
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function ordinal(n) {
  return `${n}°`
}

const artUrl = name =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

// ─── sub-components ────────────────────────────────────────

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 8 }}>
      <div className="ct-bar-fill" style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3 }} />
    </div>
  )
}

function SnapshotCard({ snapshot, t, user, navigate }) {
  if (!snapshot) return null
  const { total, wins, streak, myStanding, myRank, seasonLabel } = snapshot
  const winPct = total ? Math.round(wins / total * 100) : 0

  return (
    <div
      onClick={() => navigate('/gruppo')}
      className="ct-fade-up"
      style={{
        background: t.bgSurface,
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: '1.25rem 1.4rem',
        boxShadow: t.shadow,
        marginBottom: 16,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Ciao, {user?.username}</div>
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>{seasonLabel}</div>
        </div>
        {myRank && (
          <button
            onClick={e => { e.stopPropagation(); navigate(`/giocatore/${user?.id}`) }}
            style={{
              background: t.primaryBg, border: `1px solid ${t.primaryBorder}`,
              borderRadius: 12, padding: '6px 14px', cursor: 'pointer',
              fontSize: 18, fontWeight: 800, color: t.primary,
              lineHeight: 1,
            }}
          >
            {ordinal(myRank)}
          </button>
        )}
      </div>

      {total > 0 ? (
        <>
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 8 }}>
            {myStanding ? `${myStanding.points} pt · ` : ''}
            {wins} {wins === 1 ? 'vittoria' : 'vittorie'} su {total}
            {streak >= 2 && (
              <span style={{ marginLeft: 10, color: t.primary, fontWeight: 700 }}>
                Streak {streak}
              </span>
            )}
          </div>
          <WinBar pct={winPct} t={t} />
        </>
      ) : (
        <div style={{ fontSize: 13, color: t.textMuted, marginTop: 8 }}>
          Ancora nessuna partita questa stagione.
        </div>
      )}
    </div>
  )
}

function EventBanner({ event, t, navigate }) {
  const dateStr = new Date(event.startsAt).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const rsvpCount = event.rsvps?.length || 0

  return (
    <div
      onClick={() => navigate(`/evento/${event.id}`)}
      className="ct-fade-up"
      style={{
        background: t.primaryBg,
        border: `1px solid ${t.primaryBorder}`,
        borderRadius: 14,
        padding: '1rem 1.25rem',
        marginBottom: 16,
        cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        animationDelay: '60ms',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
          Prossimo evento
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
          {dateStr}{rsvpCount > 0 ? ` · ${rsvpCount} iscritti` : ''}
        </div>
      </div>
      <span style={{ fontSize: 20, color: t.primary, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>›</span>
    </div>
  )
}

// ─── NUOVI COMPONENTI ──────────────────────────────────────

function MiniClassifica({ standings, t, navigate }) {
  if (!standings.length) return null
  const maxPts = standings[0]?.points || 1
  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div
      className="ct-fade-up"
      style={{
        borderRadius: 18, marginBottom: 16, overflow: 'hidden',
        background: t.bgSurface, border: `1px solid ${t.border}`,
        boxShadow: t.shadow,
        animationDelay: '80ms',
      }}
    >
      {/* Header ambra */}
      <div style={{
        background: `linear-gradient(135deg, rgba(245,197,24,0.14) 0%, ${t.bgSurface} 100%)`,
        padding: '0.6rem 1rem',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#f5c518', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          🏆 Stagione corrente
        </span>
        <button
          onClick={() => navigate('/gruppo')}
          style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}
        >
          Vedi classifica ›
        </button>
      </div>

      {/* Righe giocatori */}
      <div>
        {standings.map((s, i) => (
          <div
            key={s.id}
            onClick={() => navigate(`/giocatore/${s.id}`)}
            className="ct-lift"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.6rem 1rem', cursor: 'pointer',
              borderBottom: i < standings.length - 1 ? `0.5px solid ${t.border}` : 'none',
            }}
          >
            <span style={{ fontSize: 20, minWidth: 26, textAlign: 'center', flexShrink: 0 }}>{MEDALS[i]}</span>
            <PlayerAvatar username={s.username} avatarCardName={s.avatarCardName} avatarScryfallId={s.avatarScryfallId} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{s.username}</div>
              <div style={{ height: 3, borderRadius: 2, background: t.bgMuted, marginTop: 5, overflow: 'hidden' }}>
                <div
                  className="ct-bar-fill"
                  style={{
                    height: '100%',
                    width: `${Math.round(s.points / maxPts * 100)}%`,
                    background: i === 0 ? '#f5c518' : t.primary,
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? '#f5c518' : t.text, lineHeight: 1 }}>{s.points}</div>
              <div style={{ fontSize: 10, color: t.textMuted }}>pt</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DeckSpotlight({ spotlight, t, navigate }) {
  if (!spotlight) return null

  return (
    <div
      className="ct-fade-up ct-lift"
      onClick={() => navigate(`/mazzo/${spotlight.id}`)}
      style={{
        position: 'relative', height: 168, borderRadius: 20,
        overflow: 'hidden', marginBottom: 16, cursor: 'pointer',
        background: '#0f1225',
        boxShadow: `${t.shadow}, 0 8px 32px rgba(0,0,0,0.35)`,
        animationDelay: '140ms',
      }}
    >
      {/* Art background */}
      {spotlight.commander && (
        <img
          src={artUrl(spotlight.commander)}
          alt=""
          onError={e => { e.currentTarget.style.display = 'none' }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 22%',
          }}
        />
      )}

      {/* Overlay sfumato — più scuro a destra dove c'è il % */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(105deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.68) 100%)',
      }} />

      {/* Contenuto */}
      <div style={{ position: 'absolute', inset: 0, padding: '0.9rem 1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

        {/* Label in alto */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)',
            textTransform: 'uppercase', letterSpacing: '0.14em',
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            padding: '3px 10px', borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.18)',
          }}>
            ✦ Deck Spotlight
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            ultimi 10 giorni
          </span>
        </div>

        {/* Basso: nome + stats */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 21, fontWeight: 900, color: '#fff', lineHeight: 1.1,
              textShadow: '0 2px 10px rgba(0,0,0,0.9)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {spotlight.name}
            </div>
            {spotlight.commander && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {spotlight.commander.split('//')[0].trim()}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              di {spotlight.owner} · {spotlight.recentGames} partite (10 gg)
            </div>
          </div>

          {/* Win rate */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 44, fontWeight: 900, lineHeight: 1,
              color: spotlight.recentWinRate >= 50 ? '#34F08F' : '#fff',
              textShadow: '0 2px 12px rgba(0,0,0,0.9)',
              filter: spotlight.recentWinRate >= 50 ? 'drop-shadow(0 0 14px rgba(52,240,143,0.55))' : 'none',
            }}>
              {spotlight.recentWinRate}%
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1, letterSpacing: '0.04em' }}>
              win rate
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WeeklyActivity({ activity, t }) {
  if (activity.count === 0 && activity.lastWeekCount === 0) return null
  const diff = activity.count - activity.lastWeekCount
  const trendColor = diff > 0 ? t.win : diff < 0 ? t.danger || '#f87171' : t.textSub
  const trendLabel = diff > 0 ? `↑ +${diff} vs scorsa` : diff < 0 ? `↓ ${diff} vs scorsa` : '→ come la scorsa'

  return (
    <div
      className="ct-fade-up"
      style={{
        background: t.bgSurface, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: '0.85rem 1rem', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: t.shadow, animationDelay: '200ms',
      }}
    >
      {/* Metrica */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
          ⚡ Settimana
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: t.text, lineHeight: 1 }}>{activity.count}</span>
          <span style={{ fontSize: 12, color: t.textSub, lineHeight: 1 }}>partite</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: trendColor, marginTop: 3 }}>{trendLabel}</div>
      </div>

      {/* Sparkline */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}>
        {activity.days.map((count, i) => {
          const pct = activity.maxDay > 0 ? count / activity.maxDay : 0
          const isToday = i === 6
          const barH = count > 0 ? Math.max(pct * 38, 6) : 2
          return (
            <div
              key={i}
              style={{
                flex: 1, borderRadius: '3px 3px 2px 2px',
                height: `${barH}px`,
                alignSelf: 'flex-end',
                background: count === 0
                  ? t.bgMuted
                  : isToday
                    ? t.primary
                    : `${t.primary}70`,
                transition: 'height 0.4s ease',
              }}
            />
          )
        })}
      </div>

      {/* Labels giorni (ieri/oggi) */}
      <div style={{ flexShrink: 0, textAlign: 'center', fontSize: 10, color: t.textMuted, lineHeight: 1.8 }}>
        <div>ieri</div>
        <div style={{ color: t.primary, fontWeight: 700 }}>oggi</div>
      </div>
    </div>
  )
}

// ─── Feed items ────────────────────────────────────────────

function GameFeedItem({ game, user, t, navigate }) {
  const me = game.players.find(p => p.user.id === user?.id)
  const winner = game.players.find(p => p.isWinner)
  const iWon = !!me?.isWinner
  const iPlayed = !!me

  const others = game.players
    .filter(p => p.user.id !== user?.id)
    .map(p => p.user.username)
    .join(', ')
  const allPlayers = game.players.map(p => p.user.username).join(', ')

  const winnerDeck = winner?.deck?.name || null
  const winnerCommander = winner?.deck?.commander
    ? winner.deck.commander.split('//')[0].trim()
    : null

  const accentColor = iWon ? t.win : iPlayed ? t.primary : t.border

  return (
    <div
      onClick={() => navigate(`/partita/${game.id}`)}
      className="ct-lift"
      style={{
        background: iWon ? t.winBg : t.bgSurface,
        border: `1px solid ${iWon ? t.win + '55' : t.border}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 12,
        padding: '0.8rem 1rem 0.8rem 0.9rem',
        marginBottom: 8,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 11,
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <PlayerAvatar
          username={winner?.user?.username}
          avatarCardName={winner?.user?.avatarCardName} avatarScryfallId={winner?.user?.avatarScryfallId}
          size={42}
          highlight={iWon}
        />
        {iWon && (
          <span style={{
            position: 'absolute', bottom: -3, right: -4,
            fontSize: 13, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
          }}>🏆</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
          {iWon
            ? <span style={{ color: t.win }}>Hai vinto!</span>
            : <>
                <span style={{ color: iPlayed ? t.primary : t.text }}>
                  {winner?.user?.username || '?'}
                </span>
                <span style={{ color: t.textSub, fontWeight: 400 }}> ha vinto</span>
              </>
          }
        </div>
        {winnerDeck && (
          <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🎴 {winnerCommander || winnerDeck}
          </div>
        )}
        <div style={{ fontSize: 11, color: t.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {iWon
            ? (others ? `Con ${others}` : '')
            : iPlayed
              ? (others ? `Con ${others}` : '')
              : allPlayers
          }
        </div>
      </div>

      <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
        {relativeDate(game.playedAt)}
      </span>
    </div>
  )
}

function parseUsernameFromTitle(notif) {
  try {
    if (notif.type === 'comment') return notif.title.split(' ha commentato')[0].replace(/^💬\s*/, '')
    if (notif.type === 'reaction') return notif.title.split(' ')[1]
  } catch { /* ignore */ }
  return null
}

const NOTIF_TYPE_COLOR = {
  reaction:    'rgba(251,146,60,0.85)',
  comment:     'rgba(96,165,250,0.85)',
  achievement: 'rgba(250,204,21,0.85)',
}

function NotifFeedItem({ notif, t, navigate }) {
  const isUnread = !notif.read
  const isSocial = notif.type === 'comment' || notif.type === 'reaction'
  const avatarUser = notif.fromUser || (isSocial ? { username: parseUsernameFromTitle(notif), avatarCardName: null, avatarScryfallId: null } : null)
  const badgeEmoji = notif.type === 'comment' ? '💬' : notif.type === 'reaction' ? notif.title.split(' ')[0] : null
  const fallbackIcon = notif.type === 'achievement' ? '🏅' : notif.type === 'event' ? '📅' : '📢'
  const typeColor = NOTIF_TYPE_COLOR[notif.type]

  return (
    <div
      onClick={() => notif.link && navigate(notif.link)}
      style={{
        background: isUnread ? t.primaryBg : t.bgSurface,
        border: `1px solid ${isUnread ? t.primaryBorder : t.border}`,
        borderLeft: typeColor ? `3px solid ${typeColor}` : undefined,
        borderRadius: 12,
        padding: '0.75rem 1rem',
        marginBottom: 8,
        cursor: notif.link ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      {avatarUser ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <PlayerAvatar
            username={avatarUser.username}
            avatarCardName={avatarUser.avatarCardName} avatarScryfallId={avatarUser.avatarScryfallId}
            size={36}
          />
          {badgeEmoji && (
            <span style={{
              position: 'absolute', bottom: -2, right: -4,
              fontSize: 12, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
            }}>
              {badgeEmoji}
            </span>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 22, lineHeight: '36px', flexShrink: 0, width: 36, textAlign: 'center' }}>
          {fallbackIcon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: t.text,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {notif.title}
        </div>
        {notif.body && (
          <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {notif.body}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
        {relativeDate(notif.createdAt)}
      </span>
    </div>
  )
}

// ─── main ──────────────────────────────────────────────────

export default function FeedPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [games, setGames]               = useState([])
  const [events, setEvents]             = useState([])
  const [notifications, setNotifications] = useState([])
  const [playerStats, setPlayerStats]   = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.allSettled([
      api.getGames(),
      api.getEvents(),
      api.getNotifications(),
      api.statsPlayers(),
    ])
      .then(([g, e, n, ps]) => {
        if (g.status  === 'fulfilled') setGames(g.value)
        if (e.status  === 'fulfilled') setEvents(e.value)
        if (n.status  === 'fulfilled') setNotifications(n.value)
        if (ps.status === 'fulfilled') setPlayerStats(ps.value)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── snapshot personale ──
  const snapshot = useMemo(() => {
    if (!user) return null
    const myGames = games
      .filter(g => g.players.some(p => p.user.id === user.id))
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))

    const total = myGames.length
    const wins = myGames.filter(g => g.players.find(p => p.user.id === user.id)?.isWinner).length

    let streak = 0
    for (const g of myGames) {
      if (g.players.find(p => p.user.id === user.id)?.isWinner) streak++
      else break
    }

    const currentSeasonKey = seasonOf(new Date()).key
    const { standings } = computeStandings(games, currentSeasonKey)
    const myStanding = standings.find(s => s.id === user.id)
    const myRank = myStanding ? standings.indexOf(myStanding) + 1 : null
    const seasonLabel = seasonOf(new Date()).label

    return { total, wins, streak, myStanding, myRank, seasonLabel }
  }, [games, user])

  // ── prossimo evento ──
  const nextEvent = useMemo(() => {
    const now = Date.now()
    return events
      .filter(e => {
        const eventDate = new Date(e.startsAt)
        const parts = new Intl.DateTimeFormat('en', {
          timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(eventDate)
        const y = +parts.find(p => p.type === 'year').value
        const mo = +parts.find(p => p.type === 'month').value
        const d = +parts.find(p => p.type === 'day').value
        const probe = new Date(Date.UTC(y, mo - 1, d + 1, 5, 0, 0))
        const romeHour = +new Intl.DateTimeFormat('en', {
          timeZone: 'Europe/Rome', hour: 'numeric', hour12: false,
        }).format(probe)
        return probe.getTime() - (romeHour - 5) * 3600000 > now
      })
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null
  }, [events])

  // ── mini classifica (top 3 qualificati stagione corrente) ──
  const topStandings = useMemo(() => {
    if (!games.length) return []
    const key = seasonOf(new Date()).key
    const { standings } = computeStandings(games, key)
    return standings
      .filter(s => s.qualified)
      .slice(0, 3)
      .map(s => ({
        ...s,
        avatarCardName:   playerStats.find(p => p.id === s.id)?.avatarCardName || null,
        avatarScryfallId: playerStats.find(p => p.id === s.id)?.avatarScryfallId || null,
      }))
  }, [games, playerStats])

  // ── deck spotlight (miglior deck ultime 4 sett., min 3 partite) ──
  const spotlight = useMemo(() => {
    if (!games.length) return null
    const cutoff = Date.now() - 10 * 86400000
    const map = {}
    for (const g of games) {
      if (new Date(g.playedAt) < cutoff) continue
      for (const p of g.players) {
        if (!map[p.deck.id]) map[p.deck.id] = {
          id: p.deck.id, name: p.deck.name, commander: p.deck.commander,
          owner: p.user.username, games: 0, wins: 0,
        }
        map[p.deck.id].games++
        if (p.isWinner) map[p.deck.id].wins++
      }
    }
    const candidates = Object.values(map).filter(d => d.games >= 3)
    if (!candidates.length) return null
    candidates.sort((a, b) =>
      (b.wins / b.games) - (a.wins / a.games) || b.games - a.games
    )
    const best = candidates[0]
    return {
      ...best,
      recentGames: best.games,
      recentWins: best.wins,
      recentWinRate: Math.round(best.wins / best.games * 100),
    }
  }, [games])

  // ── attività settimanale ──
  const weeklyActivity = useMemo(() => {
    const now = Date.now()
    const oneWeek = 7 * 86400000
    const thisWeek  = games.filter(g => now - new Date(g.playedAt) < oneWeek)
    const lastWeek  = games.filter(g => {
      const age = now - new Date(g.playedAt)
      return age >= oneWeek && age < oneWeek * 2
    })
    const days = Array(7).fill(0)
    for (const g of thisWeek) {
      const idx = Math.floor((now - new Date(g.playedAt)) / 86400000)
      if (idx < 7) days[6 - idx]++
    }
    const maxDay = Math.max(...days, 1)
    return { count: thisWeek.length, lastWeekCount: lastWeek.length, days, maxDay }
  }, [games])

  // ── feed items ──
  const feedItems = useMemo(() => {
    const items = []
    for (const g of games.slice(0, 25)) {
      items.push({ type: 'game', data: g, date: new Date(g.playedAt) })
    }
    for (const n of notifications) {
      if (n.type === 'event') continue
      items.push({ type: 'notif', data: n, date: new Date(n.createdAt) })
    }
    return items.sort((a, b) => b.date - a.date).slice(0, 30)
  }, [games, notifications])

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 18, padding: '1.25rem 1.4rem', marginBottom: 16, boxShadow: t.shadow }}>
          <Skeleton w={160} h={22} r={6} />
          <Skeleton w={120} h={12} r={6} style={{ marginTop: 8 }} />
          <Skeleton w="100%" h={5} r={3} style={{ marginTop: 16 }} />
        </div>
        <Skeleton w="100%" h={168} r={20} style={{ marginBottom: 16 }} />
        <SkeletonList rows={5} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* 1 — Snapshot personale */}
      <SnapshotCard snapshot={snapshot} t={t} user={user} navigate={navigate} />

      {/* 2 — Prossimo evento */}
      {nextEvent && <EventBanner event={nextEvent} t={t} navigate={navigate} />}

      {/* 3 — Mini classifica stagionale */}
      <MiniClassifica standings={topStandings} t={t} navigate={navigate} />

      {/* 4 — Deck Spotlight */}
      <DeckSpotlight spotlight={spotlight} t={t} navigate={navigate} />

      {/* 5 — Attività settimanale */}
      <WeeklyActivity activity={weeklyActivity} t={t} />

      {/* 6 — Feed attività recente */}
      {feedItems.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, marginTop: 4 }}>
            Attività recente
          </div>
          {feedItems.map((item, index) => (
            <div
              key={item.type === 'game' ? `g-${item.data.id}` : `n-${item.data.id}`}
              className="ct-fade-up"
              style={{ animationDelay: `${(Math.min(index, 8) * 40) + 240}ms` }}
            >
              {item.type === 'game'
                ? <GameFeedItem game={item.data} user={user} t={t} navigate={navigate} />
                : <NotifFeedItem notif={item.data} t={t} navigate={navigate} />
              }
            </div>
          ))}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: t.textMuted, fontSize: 14 }}>
          Ancora nessuna attività. Registra la prima partita!
        </div>
      )}
    </div>
  )
}
