import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import DeckThumb from '../components/DeckThumb'

function relativeDate(date) {
  const diffDays = Math.floor((Date.now() - new Date(date)) / 86400000)
  if (diffDays === 0) return 'Oggi'
  if (diffDays === 1) return 'Ieri'
  if (diffDays < 7) return `${diffDays} gg fa`
  return new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export default function GiocaPage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [decks, setDecks] = useState([])
  const [events, setEvents] = useState([])

  useEffect(() => {
    Promise.allSettled([api.getGames(), api.getDecks(), api.getEvents()])
      .then(([g, d, e]) => {
        if (g.status === 'fulfilled') setGames(g.value)
        if (d.status === 'fulfilled') setDecks(d.value)
        if (e.status === 'fulfilled') setEvents(e.value)
      })
  }, [])

  // Ultimi mazzi usati da me (dall'ordine delle partite)
  const recentDecks = (() => {
    const seen = new Set()
    const result = []
    for (const g of games) {
      const me = g.players.find(p => p.user.id === user?.id)
      if (me && !seen.has(me.deck.id)) {
        seen.add(me.deck.id)
        result.push(me.deck)
        if (result.length >= 3) break
      }
    }
    // fallback: i miei mazzi se non ho giocato
    if (result.length === 0) {
      decks.filter(d => d.userId === user?.id).slice(0, 3).forEach(d => result.push(d))
    }
    return result
  })()

  const lastGame = games.find(g => g.players.some(p => p.user.id === user?.id))

  const nextEvent = (() => {
    const now = Date.now()
    return events
      .filter(e => new Date(e.startsAt).getTime() + 5 * 3600000 > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null
  })()

  const eventCountdown = (startsAt) => {
    const diff = Math.ceil((new Date(startsAt) - Date.now()) / 86400000)
    if (diff <= 0) return 'Oggi'
    if (diff === 1) return 'Domani'
    return `tra ${diff} giorni`
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>

      {/* Hero CTA — Registra Partita */}
      <button
        className="ct-fade-up"
        onClick={() => navigate('/nuova-partita')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left', marginBottom: 10,
          background: t.primary, color: t.primaryFg,
          border: 'none', borderRadius: 20, padding: '1.5rem 1.75rem',
          cursor: 'pointer', boxShadow: t.glow,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Registra Partita</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Aggiungi il risultato di una partita appena finita</div>
        </div>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </button>

      {/* Judge Bot secondario */}
      <button
        className="ct-fade-up"
        onClick={() => navigate('/giudice')}
        style={{ animationDelay: '60ms',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left', marginBottom: 28,
          background: t.bgSurface, color: t.text,
          border: `1px solid ${t.border}`, borderRadius: 14, padding: '0.95rem 1.25rem',
          cursor: 'pointer', boxShadow: t.shadow,
          transition: 'border-color 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>⚖</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Judge Bot</div>
            <div style={{ fontSize: 12, color: t.textSub }}>Ruling Commander · Comprehensive Rules + Scryfall</div>
          </div>
        </div>
        <span style={{ color: t.primary, fontSize: 20, fontWeight: 700, flexShrink: 0 }}>›</span>
      </button>

      {/* Ultimi mazzi usati */}
      {recentDecks.length > 0 && (
        <div className="ct-fade-up" style={{ marginBottom: 24, animationDelay: '120ms' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Ultimi mazzi usati
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {recentDecks.map(deck => (
              <button
                key={deck.id}
                onClick={() => navigate('/mazzo/' + deck.id)}
                style={{
                  flex: 1, minWidth: 0, padding: 0, border: `1px solid ${t.border}`,
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                  background: t.bgSurface, boxShadow: t.shadow, textAlign: 'left',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = t.primaryBorder }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = t.border }}
              >
                <div style={{ height: 72, overflow: 'hidden', background: t.bgMuted }}>
                  <DeckThumb commander={deck.commander} w="100%" preview={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                </div>
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
                  {deck.commander && (
                    <div style={{ fontSize: 11, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {deck.commander.split('//')[0].trim()}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prossimo evento */}
      {nextEvent && (
        <div className="ct-fade-up" style={{ marginTop: 24, animationDelay: '180ms' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Prossimo evento
          </div>
          <button
            onClick={() => navigate(`/evento/${nextEvent.id}`)}
            style={{
              width: '100%', textAlign: 'left', padding: '0.9rem 1rem',
              background: t.primaryBg, border: `1px solid ${t.primaryBorder}`,
              borderRadius: 14, cursor: 'pointer', boxShadow: t.shadow,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nextEvent.title}
              </div>
              <div style={{ fontSize: 11, color: t.textSub, marginTop: 3 }}>
                {new Date(nextEvent.startsAt).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                {nextEvent.rsvps?.length > 0 ? ` · ${nextEvent.rsvps.length} iscritti` : ''}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.primary, flexShrink: 0,
              background: t.primaryBg, border: `1px solid ${t.primaryBorder}`,
              borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
              {eventCountdown(nextEvent.startsAt)}
            </span>
          </button>
        </div>
      )}

      {/* Ultima partita */}
      {lastGame && (() => {
        const winner = lastGame.players.find(p => p.isWinner)
        const me = lastGame.players.find(p => p.user.id === user?.id)
        const iWon = !!me?.isWinner
        return (
          <div className="ct-fade-up" style={{ marginTop: 24, animationDelay: '240ms' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Ultima partita
            </div>
            <button
              onClick={() => navigate('/partita/' + lastGame.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '0.9rem 1rem',
                background: iWon ? t.winBg : t.bgSurface,
                border: `1px solid ${iWon ? t.win + '55' : t.border}`,
                borderLeft: `3px solid ${iWon ? t.win : t.primary}`,
                borderRadius: 12, cursor: 'pointer', boxShadow: t.shadow,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: iWon ? t.win : t.text }}>
                  🏆 {winner?.user?.username}{winner?.deck?.commander ? ` · ${winner.deck.commander.split('//')[0].trim()}` : winner?.deck?.name ? ` · ${winner.deck.name}` : ''}
                </div>
                <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
                  {lastGame.players.length} giocatori · {relativeDate(lastGame.playedAt)}
                </div>
              </div>
              <span style={{ color: t.primary, fontSize: 18, flexShrink: 0 }}>›</span>
            </button>
          </div>
        )
      })()}
    </div>
  )
}
