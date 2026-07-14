import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useFeedback } from '../hooks/useFeedback'
import { fireConfetti } from '../lib/confetti'
import PlayerAvatar from '../components/PlayerAvatar'

const EMPTY_SLOT = { userId: '', deckId: '' }

// Data locale YYYY-MM-DD (niente shift di fuso come con toISOString)
const toLocalDate = (d) => {
  const x = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

export default function NewGamePage() {
  const navigate = useNavigate()
  const { t } = useTheme()
  const { toast } = useFeedback()
  // Contesto pod torneo: giocatori bloccati + collegamento al tavolo dopo il salvataggio
  const podCtx = useLocation().state?.podContext || null
  const [allDecks, setAllDecks] = useState([])   // tutti i mazzi di tutti i giocatori
  const [slots, setSlots] = useState(() => podCtx
    ? podCtx.players.map(p => ({ userId: String(p.userId), deckId: '' }))
    : [{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }])
  const [winnerId, setWinnerId] = useState(null)   // { userId, deckId }
  const [notes, setNotes] = useState('')
  // Per i pod torneo la data è quella dell'EVENTO (non oggi), così la partita
  // finisce nella stagione/storico giusti.
  const [playedAt, setPlayedAt] = useState(() => toLocalDate(podCtx?.date || new Date()))
  const [elimOrder, setElimOrder] = useState([])  // chiavi "userId-deckId" in ordine di uscita (primo eliminato per primo)
  const [elimBy, setElimBy] = useState({})        // { "userId-deckId" → userId del killer }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getDecks().then(setAllDecks).catch(() => setError('Errore caricamento mazzi'))
  }, [])

  // Raggruppa mazzi per utente
  const byUser = allDecks.reduce((acc, d) => {
    if (!acc[d.userId]) acc[d.userId] = { username: d.user.username, avatarCardName: d.user.avatarCardName || null, avatarScryfallId: d.user.avatarScryfallId || null, decks: [] }
    acc[d.userId].decks.push(d)
    return acc
  }, {})

  const users = Object.entries(byUser).map(([id, v]) => ({ id: parseInt(id), ...v }))

  const updateSlot = (i, field, value) => {
    setSlots(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      // Reset mazzo se cambia giocatore
      if (field === 'userId') next[i].deckId = ''
      return next
    })
    setWinnerId(null)
  }

  const addSlot = () => {
    if (slots.length >= 5) return
    setSlots(prev => [...prev, { ...EMPTY_SLOT }])
  }

  const removeSlot = (i) => {
    if (slots.length <= 3) return
    setSlots(prev => prev.filter((_, idx) => idx !== i))
    setWinnerId(null)
  }

  const filledSlots = slots.filter(s => s.userId && s.deckId)

  // Reset ordine di uscita ed eliminazioni se cambia il vincitore o il tavolo
  useEffect(() => { setElimOrder([]); setElimBy({}) }, [winnerId, slots.length])

  const slotKey = (s) => `${parseInt(s.userId)}-${parseInt(s.deckId)}`

  const isWinner = (s) =>
    winnerId && winnerId.userId === parseInt(s.userId) && winnerId.deckId === parseInt(s.deckId)

  // Perdenti = giocatori completi non vincitori
  const losers = filledSlots.filter(s => !isWinner(s))

  const toggleElim = (key) => {
    setElimOrder(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  // placement: vincitore = 1; primo eliminato = N; ultimo eliminato (runner-up) = 2
  const computePlacements = () => {
    if (elimOrder.length !== losers.length || losers.length === 0) return null
    const n = filledSlots.length
    const map = {}
    map[`${winnerId.userId}-${winnerId.deckId}`] = 1
    elimOrder.forEach((key, i) => { map[key] = n - i })
    return map
  }

  const getDeckName = (deckId) => allDecks.find(d => d.id === parseInt(deckId))?.name || ''
  const getUserName = (userId) => users.find(u => u.id === parseInt(userId))?.username || ''

  const submit = async () => {
    if (filledSlots.length < 3) { setError('Servono almeno 3 giocatori completi'); return }
    if (!winnerId) { setError('Seleziona il vincitore'); return }

    // Controlla duplicati giocatore
    const uids = filledSlots.map(s => s.userId)
    if (new Set(uids).size !== uids.length) { setError('Lo stesso giocatore non può essere al tavolo due volte'); return }

    setSaving(true)
    setError('')
    try {
      const placements = computePlacements()
      const game = await api.createGame({
        players: filledSlots.map(s => ({
          userId: parseInt(s.userId),
          deckId: parseInt(s.deckId),
          ...(placements ? { placement: placements[slotKey(s)] } : {}),
          ...(elimBy[slotKey(s)] ? { eliminatedById: parseInt(elimBy[slotKey(s)]) } : {})
        })),
        winnerId: winnerId.userId,
        winnerDeckId: winnerId.deckId,
        notes: notes.trim() || undefined,
        playedAt: playedAt || undefined
      })
      // Pod torneo: collega la partita al tavolo e torna all'evento
      if (podCtx) {
        await api.submitTableResult(podCtx.eventId, podCtx.tableId, { gameId: game.id })
        fireConfetti()
        toast('Risultato del pod registrato', 'success')
        setTimeout(() => navigate(`/evento/${podCtx.eventId}`), 700)
        return
      }
      fireConfetti()
      toast('Partita registrata', 'success')
      setTimeout(() => navigate('/'), 700)
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const card = {
    background: t.bgSurface,
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    padding: '1.15rem 1.35rem',
    marginBottom: 12,
    boxShadow: t.shadow,
  }
  const sel = { padding: '11px 12px', borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14, background: t.inputBg, color: t.text, outline: 'none', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: '1.25rem', color: t.text }}>{podCtx ? 'Risultato del pod' : 'Nuova partita'}</div>
      {podCtx && (
        <div style={{ ...card, fontSize: 13, color: t.textSub }}>
          Giocatori del tavolo bloccati. Scegli il mazzo di ognuno, il vincitore e (se vuoi) ordine di uscita ed eliminazioni. La partita verrà collegata al torneo e conterà nelle statistiche.
        </div>
      )}

      {allDecks.length === 0 && !error && (
        <div style={{ ...card, color: t.textSub, fontSize: 14 }}>
          Nessun mazzo trovato. Prima aggiungete i mazzi dalla pagina <strong>Mazzi</strong>.
        </div>
      )}

      {/* Data partita */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: t.text }}>Data partita</div>
        <input
          type="date"
          value={playedAt}
          max={podCtx ? undefined : toLocalDate(new Date())}
          onChange={e => setPlayedAt(e.target.value)}
          style={{ ...sel, minWidth: 180 }}
        />
        {podCtx && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>Pre-impostata alla data dell'evento.</div>}
      </div>

      {/* Slot giocatori */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.text }}>Giocatori al tavolo</div>
        {slots.map((slot, i) => {
          const userDecks = slot.userId ? (byUser[slot.userId]?.decks || []) : []
          const avatarEl = slot.userId && byUser[slot.userId] ? (
            <PlayerAvatar
              username={byUser[slot.userId].username}
              avatarCardName={byUser[slot.userId].avatarCardName} avatarScryfallId={byUser[slot.userId].avatarScryfallId}
              size={32}
            />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.primaryBg, color: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, border: `1px solid ${t.primaryBorder}` }}>
              {i + 1}
            </div>
          )
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <div style={{ paddingTop: 10, flexShrink: 0 }}>{avatarEl}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <select style={{ ...sel, opacity: podCtx ? 0.7 : 1 }} value={slot.userId} onChange={e => updateSlot(i, 'userId', e.target.value)} disabled={!!podCtx}>
                  <option value="">Giocatore...</option>
                  {(podCtx ? podCtx.players.map(p => ({ id: p.userId, username: p.username })) : users).map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <select style={sel} value={slot.deckId} onChange={e => updateSlot(i, 'deckId', e.target.value)} disabled={!slot.userId}>
                  <option value="">Mazzo...</option>
                  {userDecks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {i >= 3 && !podCtx && (
                <button onClick={() => removeSlot(i)} style={{ marginTop: 10, padding: '8px 11px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.bgMuted, cursor: 'pointer', fontSize: 14, color: t.textSub, flexShrink: 0 }}>×</button>
              )}
            </div>
          )
        })}
        {slots.length < 5 && !podCtx && (
          <button onClick={addSlot} style={{ marginTop: 4, padding: '8px 14px', border: `1px solid ${t.border}`, borderRadius: 10, background: t.bgMuted, cursor: 'pointer', fontSize: 13, color: t.textSub, fontWeight: 500 }}>
            + Aggiungi giocatore
          </button>
        )}
      </div>

      {/* Selezione vincitore */}
      {filledSlots.length >= 2 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.text }}>Chi ha vinto?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filledSlots.map((s, i) => {
              const active = isWinner(s)
              return (
                <button
                  key={i}
                  onClick={() => setWinnerId({ userId: parseInt(s.userId), deckId: parseInt(s.deckId) })}
                  style={{
                    padding: '8px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: active ? t.winBg : t.bgMuted,
                    color: active ? t.win : t.textSub,
                    border: active ? `1px solid ${t.win}` : `1px solid ${t.border}`,
                    boxShadow: active ? t.glow : 'none',
                    transition: 'all 0.18s ease'
                  }}
                >
                  {getUserName(s.userId)} · {getDeckName(s.deckId)}
                  {active && ' ✓'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Ordine di eliminazione (opzionale) */}
      {winnerId && losers.length >= 2 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: t.text }}>
            Ordine di uscita <span style={{ fontWeight: 400, color: t.textMuted }}>(opzionale)</span>
          </div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 12 }}>
            Clicca i giocatori nell'ordine in cui sono stati eliminati, dal primo all'ultimo. Il vincitore è automaticamente 1°.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: elimOrder.length ? 14 : 0 }}>
            {losers.map((s, i) => {
              const key = slotKey(s)
              const pos = elimOrder.indexOf(key)
              const picked = pos !== -1
              return (
                <button
                  key={i}
                  onClick={() => toggleElim(key)}
                  style={{
                    padding: '8px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: picked ? t.primaryBg : t.bgMuted,
                    color: picked ? t.primary : t.textSub,
                    border: picked ? `1px solid ${t.primaryBorder}` : `1px solid ${t.border}`,
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {picked && <span style={{ fontSize: 11, fontWeight: 800 }}>{filledSlots.length - pos}°</span>}
                  {getUserName(s.userId)} · {getDeckName(s.deckId)}
                </button>
              )
            })}
          </div>

          {elimOrder.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: elimOrder.length === losers.length ? t.win : t.textMuted }}>
                {elimOrder.length === losers.length
                  ? '✓ Classifica completa'
                  : `${elimOrder.length}/${losers.length} ordinati`}
              </span>
              <button onClick={() => setElimOrder([])} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
                ✕ azzera ordine
              </button>
            </div>
          )}
        </div>
      )}

      {/* Eliminazioni: chi ha eliminato chi (opzionale) */}
      {winnerId && losers.length >= 1 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: t.text }}>
            Eliminazioni <span style={{ fontWeight: 400, color: t.textMuted }}>(opzionale)</span>
          </div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 12 }}>
            Per ogni giocatore eliminato, indica chi l'ha buttato fuori. Sblocca arcinemico, preda preferita e kill count.
          </div>
          {losers.map((s, i) => {
            const key = slotKey(s)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: t.text, minWidth: 160 }}>{getUserName(s.userId)} · {getDeckName(s.deckId)}</span>
                <span style={{ fontSize: 12, color: t.textMuted }}>eliminato da</span>
                <select
                  value={elimBy[key] || ''}
                  onChange={e => setElimBy(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ ...sel, minWidth: 150 }}
                >
                  <option value="">— sconosciuto</option>
                  {filledSlots.filter(o => slotKey(o) !== key).map((o, oi) => (
                    <option key={oi} value={parseInt(o.userId)}>{getUserName(o.userId)}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}

      {/* Note */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: t.text }}>Note (opzionale)</div>
        <input
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text }}
          placeholder="es. combo al turno 9, partita lunga..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button
        onClick={submit}
        disabled={saving}
        style={{ padding: '12px 30px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: t.glow, transition: 'all 0.18s ease' }}
      >
        {saving ? 'Salvataggio...' : 'Salva partita'}
      </button>
    </div>
  )
}
