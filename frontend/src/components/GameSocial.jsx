import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useFeedback } from '../hooks/useFeedback'
import PlayerAvatar from './PlayerAvatar'

// Emoji consentite per le reazioni (deve combaciare col backend)
export const REACTION_EMOJI = ['👍', '🔥', '😂', '😮', '💀', '🎉', '🐸']

// "ora", "5m fa", "3h fa", "2g fa", oppure la data
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ora'
  if (m < 60) return `${m}m fa`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h fa`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}g fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}


export default function GameSocial({ game, defaultOpen = false }) {
  const { t } = useTheme()
  const { user } = useAuth()
  const { activeGroup } = useGroup()
  const { toast, confirm } = useFeedback()

  const [reactions, setReactions]     = useState(game.reactions || [])
  const [busyEmoji, setBusyEmoji]     = useState(null)
  const [open, setOpen]               = useState(defaultOpen)
  const [loaded, setLoaded]           = useState(false)
  const [loading, setLoading]         = useState(false)
  const [comments, setComments]       = useState([])
  const [count, setCount]             = useState(game._count?.comments ?? 0)
  const [text, setText]               = useState('')
  const [sending, setSending]         = useState(false)

  const loadComments = async () => {
    setLoading(true)
    try {
      const list = await api.getComments(game.id)
      setComments(list)
      setCount(list.length)
      setLoaded(true)
    } catch (err) {
      toast(err.error || 'Errore caricamento commenti', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Sul dettaglio partita i commenti partono aperti
  useEffect(() => { if (defaultOpen && !loaded) loadComments() }, [])

  const toggleReaction = async (emoji) => {
    if (busyEmoji) return
    setBusyEmoji(emoji)
    try {
      const { reactions: next } = await api.toggleReaction(game.id, emoji)
      setReactions(next)
    } catch (err) {
      toast(err.error || 'Errore reazione', 'error')
    } finally {
      setBusyEmoji(null)
    }
  }

  const openThread = async () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) await loadComments()
  }

  const send = async (e) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const created = await api.addComment(game.id, body)
      setComments(prev => [...prev, created])
      setCount(c => c + 1)
      setText('')
    } catch (err) {
      toast(err.error || 'Errore invio commento', 'error')
    } finally {
      setSending(false)
    }
  }

  const remove = async (comment) => {
    const ok = await confirm({
      title: 'Eliminare il commento?',
      message: 'Il commento verrà rimosso definitivamente.',
      confirmLabel: 'Elimina',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deleteComment(game.id, comment.id)
      setComments(prev => prev.filter(c => c.id !== comment.id))
      setCount(c => Math.max(0, c - 1))
    } catch (err) {
      toast(err.error || 'Errore eliminazione', 'error')
    }
  }

  const chip = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
    border: `1px solid ${t.border}`, lineHeight: 1.6, userSelect: 'none',
  }

  return (
    <div style={{ marginTop: 10, borderTop: `0.5px solid ${t.border}`, paddingTop: 10 }}>
      {/* Barra reazioni */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {REACTION_EMOJI.map(emoji => {
          const mine = reactions.some(r => r.emoji === emoji && r.userId === user?.id)
          const who  = reactions.filter(r => r.emoji === emoji)
          const n    = who.length
          const title = n ? who.map(r => r.user?.username || '—').join(', ') : 'Reagisci'
          return (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              disabled={busyEmoji === emoji}
              title={title}
              style={{
                ...chip,
                background: mine ? t.primary : (n ? t.bgMuted : 'transparent'),
                color: mine ? t.primaryFg : t.textSub,
                borderColor: mine ? t.primary : t.border,
                opacity: n || mine ? 1 : 0.6,
              }}
            >
              <span style={{ fontSize: 14 }}>{emoji}</span>
              {n > 0 && <span style={{ fontWeight: 600 }}>{n}</span>}
            </button>
          )
        })}

        <button
          onClick={openThread}
          style={{ ...chip, marginLeft: 'auto', background: open ? t.bgMuted : 'transparent', color: t.textSub }}
        >
          💬 {count > 0 ? `${count} comm${count === 1 ? 'ento' : 'enti'}` : 'Commenta'}
        </button>
      </div>

      {/* Thread commenti */}
      {open && (
        <div style={{ marginTop: 10 }}>
          {loading && <div style={{ fontSize: 12, color: t.textSub }}>Caricamento commenti…</div>}

          {!loading && comments.length === 0 && (
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>Nessun commento. Scrivi il primo!</div>
          )}

          {comments.map(c => {
            const canDelete = user?.id === c.user.id || activeGroup?.role === 'ADMIN'
            return (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0' }}>
                <PlayerAvatar username={c.user.username} avatarCardName={c.user.avatarCardName} avatarScryfallId={c.user.avatarScryfallId} size={22} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, color: t.textSub }}>
                    <span style={{ fontWeight: 600, color: t.text }}>{c.user.username}</span>
                    <span style={{ color: t.textMuted }}> · {timeAgo(c.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: t.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove(c)}
                    title="Elimina commento"
                    style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 13, flexShrink: 0, padding: 2 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}

          {/* Casella nuovo commento */}
          <form onSubmit={send} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Scrivi un commento…"
              maxLength={1000}
              style={{ flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none' }}
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 13, fontWeight: 500, cursor: text.trim() ? 'pointer' : 'default', opacity: text.trim() ? 1 : 0.5, flexShrink: 0 }}
            >
              Invia
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
