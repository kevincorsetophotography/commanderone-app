import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import GameSocial from '../components/GameSocial'
import PlayerAvatar from '../components/PlayerAvatar'

export default function GamePage() {
  const { id } = useParams()
  const gid = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()

  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    api.getGame(gid)
      .then(g => { if (alive) setGame(g) })
      .catch(err => { if (alive) setError(err.error || 'Partita non trovata') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [gid])

  const back = (
    <button onClick={() => navigate(-1)} style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>← Indietro</button>
  )

  if (loading) return (<div>{back}<Skeleton h={200} r={16} /></div>)
  if (error || !game) return (<div>{back}<EmptyState icon="🔍" title="Partita non trovata" message={error || 'Questa partita non esiste.'} /></div>)

  const card = {
    background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 16,
    padding: '1.15rem 1.35rem', marginBottom: 14, boxShadow: t.shadow,
  }

  const date = new Date(game.playedAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const winner = game.players.find(p => p.isWinner)
  const ranked = game.players.every(p => p.placement != null)
  const ordered = ranked ? [...game.players].sort((a, b) => a.placement - b.placement) : game.players
  const kills = game.players.filter(p => p.eliminatedById)

  const medal = (placement) => placement === 1 ? '🥇' : placement === 2 ? '🥈' : placement === 3 ? '🥉' : `${placement}°`

  return (
    <div>
      {back}

      <div className="ct-fade-up" style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, textTransform: 'capitalize' }}>{date}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{game.players.length} giocatori{game.createdBy ? ` · registrata da ${game.createdBy.username}` : ''}</div>
          </div>
          {winner && (
            <span style={{ fontSize: 13, background: t.winBg, color: t.win, padding: '5px 12px', borderRadius: 20, fontWeight: 600 }}>
              🏆 {winner.user.username} · {winner.deck.name}
            </span>
          )}
        </div>

        {/* Giocatori al tavolo (in ordine di piazzamento se disponibile) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ordered.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/mazzo/${p.deck.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
                background: p.isWinner ? t.winBg : t.bgMuted,
                border: `1px solid ${p.isWinner ? t.win + '55' : t.border}`,
                boxShadow: p.isWinner ? `0 0 0 1px ${t.win}30` : 'none',
              }}
            >
              {ranked && (
                <span style={{ fontSize: 16, minWidth: 24, textAlign: 'center', flexShrink: 0 }}>
                  {medal(p.placement)}
                </span>
              )}
              <PlayerAvatar username={p.user.username} avatarCardName={p.user.avatarCardName} avatarScryfallId={p.user.avatarScryfallId} size={36} highlight={p.isWinner} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: p.isWinner ? 800 : 600, color: p.isWinner ? t.win : t.text }}>{p.user.username}</div>
                <div style={{ fontSize: 11, color: t.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.deck.commander ? p.deck.commander.split('//')[0].trim() : p.deck.name}
                </div>
              </div>
              <DeckThumb commander={p.deck.commander} w={38} preview={false} style={{ borderRadius: 6, flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* Eliminazioni */}
        {kills.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>Eliminazioni</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {kills.map(p => {
                const killer = game.players.find(x => x.user.id === p.eliminatedById)
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <PlayerAvatar username={killer?.user.username || '?'} avatarCardName={killer?.user.avatarCardName} avatarScryfallId={killer?.user.avatarScryfallId} size={20} />
                    <span style={{ color: t.textSub, fontWeight: 600 }}>{killer?.user.username || '?'}</span>
                    <span style={{ color: t.danger || '#f44336', fontSize: 11 }}>⚔</span>
                    <PlayerAvatar username={p.user.username} avatarCardName={p.user.avatarCardName} avatarScryfallId={p.user.avatarScryfallId} size={20} />
                    <span style={{ color: t.textMuted }}>{p.user.username}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Note */}
        {game.notes && (
          <div style={{ marginTop: 12, fontSize: 13, color: t.textMuted, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{game.notes}</div>
        )}

        {/* Reazioni + commenti (aperti) */}
        <GameSocial game={game} defaultOpen />
      </div>
    </div>
  )
}
