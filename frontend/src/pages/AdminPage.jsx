import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import DeckListPanel from '../components/DeckListPanel'
import { useTheme } from '../hooks/useTheme'
import { useGroup } from '../hooks/useGroup'
import { fetchCommanderColors } from '../lib/scryfall'
import { useFeedback } from '../hooks/useFeedback'
import { useIsMobile } from '../hooks/useIsMobile'
import CommanderInput from '../components/CommanderInput'
import BracketBadge from '../components/BracketBadge'
import { BRACKETS, BRACKET_OPTIONS } from '../lib/brackets'
import ArchetypeBadge from '../components/ArchetypeBadge'
import { ARCHETYPE_OPTIONS } from '../lib/archetypes'

const EMPTY_DECK_FORM = { userId: '', name: '', commander: '', colors: '', bracket: '', archetype: '' }
const EMPTY_GAME_FORM = {
  id: null,
  slots: [
    { userId: '', deckId: '' },
    { userId: '', deckId: '' },
    { userId: '', deckId: '' }
  ],
  winnerId: '',
  winnerDeckId: '',
  notes: '',
  playedAt: '',
  elimOrder: [],
  elimBy: {}
}

function SectionCard({ children, t }) {
  return (
    <div style={{
      background: t.bgSurface,
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      border: `1px solid ${t.border}`,
      borderRadius: 14,
      padding: '1rem 1.25rem',
      marginBottom: 12,
      boxShadow: t.shadow,
    }}>
      {children}
    </div>
  )
}

function InviteCodePanel({ t, buttonSecondary, toast }) {
  const { activeGroup, refresh } = useGroup()
  const [regenerating, setRegenerating] = useState(false)

  const regenerate = async () => {
    if (!activeGroup) return
    setRegenerating(true)
    try {
      await api.regenerateInviteCode(activeGroup.slug)
      await refresh()
      toast('Codice invito rigenerato', 'success')
    } catch (err) {
      toast(err.error || 'Errore nella rigenerazione del codice', 'error')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{
        fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.08em',
        padding: '8px 14px', borderRadius: 8, background: t.bgMuted, color: t.primary,
      }}>
        {activeGroup?.inviteCode || '····'}
      </div>
      <button style={buttonSecondary} onClick={regenerate} disabled={regenerating}>
        {regenerating ? '...' : 'Rigenera codice'}
      </button>
    </div>
  )
}

function formatGameForEdit(game) {
  // Ricostruisci l'ordine di uscita dai piazzamenti esistenti (se presenti)
  const allHavePlacement = game.players.every((p) => p.placement != null)
  let elimOrder = []
  if (allHavePlacement) {
    elimOrder = game.players
      .filter((p) => !p.isWinner)
      .sort((a, b) => b.placement - a.placement) // placement più alto = primo eliminato
      .map((p) => `${p.user.id}-${p.deck.id}`)
  }
  const elimBy = {}
  game.players.forEach((p) => {
    if (p.eliminatedById) elimBy[`${p.user.id}-${p.deck.id}`] = String(p.eliminatedById)
  })
  return {
    id: game.id,
    slots: game.players.map((player) => ({
      userId: String(player.user.id),
      deckId: String(player.deck.id)
    })),
    winnerId: String(game.players.find((player) => player.isWinner)?.user.id || ''),
    winnerDeckId: String(game.players.find((player) => player.isWinner)?.deck.id || ''),
    notes: game.notes || '',
    playedAt: game.playedAt ? new Date(game.playedAt).toISOString().slice(0, 10) : '',
    elimOrder,
    elimBy
  }
}

export default function AdminPage() {
  const { t } = useTheme()
  const { activeGroup } = useGroup()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const isMobile = useIsMobile()
  const cols = (desktop) => (isMobile ? '1fr' : desktop)
  const [tab, setTab] = useState('utenti')
  const [detectingDeckColors, setDetectingDeckColors]       = useState(false)
  const [detectingEditColors, setDetectingEditColors]       = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [members, setMembers] = useState([])
  const [decks, setDecks] = useState([])
  const [games, setGames] = useState([])

  const [deckForm, setDeckForm] = useState(EMPTY_DECK_FORM)
  const [editingDeckId, setEditingDeckId] = useState(null)
  const [editingDeckForm, setEditingDeckForm] = useState(EMPTY_DECK_FORM)

  const [gameForm, setGameForm] = useState(EMPTY_GAME_FORM)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [membersData, decksData, gamesData] = await Promise.all([
        api.adminMembers(),
        api.getDecks(),
        api.getGames()
      ])

      setMembers(membersData)
      setDecks(decksData)
      setGames(gamesData)
    } catch (err) {
      setError(err.error || 'Errore nel caricamento area admin')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const usersById = useMemo(() => {
    return new Map(members.map((member) => [member.userId, member]))
  }, [members])

  const decksByUser = useMemo(() => {
    return decks.reduce((acc, deck) => {
      const key = String(deck.userId)
      if (!acc[key]) acc[key] = []
      acc[key].push(deck)
      return acc
    }, {})
  }, [decks])

  const gameCandidates = gameForm.slots.filter((slot) => slot.userId && slot.deckId)

  const toggleMemberRole = async (member) => {
    const nextRole = member.role === 'ADMIN' ? 'PLAYER' : 'ADMIN'
    try {
      await api.updateMember(member.userId, { role: nextRole })
      await loadData()
      toast(`${member.username} ora è ${nextRole}`, 'success')
    } catch (err) {
      toast(err.error || 'Errore nell\'aggiornamento del ruolo', 'error')
    }
  }

  const removeMember = async (member) => {
    const ok = await confirm({ title: 'Rimuovere dal gruppo?', message: `${member.username} perderà l'accesso a questo gruppo. Le sue partite e mazzi restano nello storico.`, confirmLabel: 'Rimuovi', danger: true })
    if (!ok) return

    try {
      await api.removeMember(member.userId)
      await loadData()
      toast('Membro rimosso dal gruppo', 'success')
    } catch (err) {
      toast(err.error || 'Errore nella rimozione del membro', 'error')
    }
  }

  const startDeckEdit = (deck) => {
    setEditingDeckId(deck.id)
    setEditingDeckForm({
      userId: String(deck.userId),
      name: deck.name,
      commander: deck.commander || '',
      colors: deck.colors || '',
      bracket: deck.bracket ? String(deck.bracket) : '',
      archetype: deck.archetype || ''
    })
  }

  const startGameEdit = (game) => {
    setGameForm(formatGameForEdit(game))
    setTab('partite')
  }

  const updateGameSlot = (index, field, value) => {
    setGameForm((current) => {
      const nextSlots = [...current.slots]
      nextSlots[index] = { ...nextSlots[index], [field]: value }

      if (field === 'userId') {
        nextSlots[index].deckId = ''
      }

      return {
        ...current,
        slots: nextSlots,
        winnerId: '',
        winnerDeckId: '',
        elimOrder: [],
        elimBy: {}
      }
    })
  }

  const addGameSlot = () => {
    setGameForm((current) => {
      if (current.slots.length >= 5) return current
      return {
        ...current,
        slots: [...current.slots, { userId: '', deckId: '' }],
        elimOrder: [],
        elimBy: {}
      }
    })
  }

  const removeGameSlot = (index) => {
    setGameForm((current) => {
      if (current.slots.length <= 3) return current
      return {
        ...current,
        slots: current.slots.filter((_, currentIndex) => currentIndex !== index),
        winnerId: '',
        winnerDeckId: '',
        elimOrder: [],
        elimBy: {}
      }
    })
  }

  const submitDeck = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      await api.createDeck({
        ...deckForm,
        userId: Number.parseInt(deckForm.userId, 10),
        commander: deckForm.commander.trim() || null,
        colors: deckForm.colors.trim().toUpperCase() || null,
        bracket: deckForm.bracket || null,
        archetype: deckForm.archetype || null
      })
      setDeckForm(EMPTY_DECK_FORM)
      await loadData()
      toast('Mazzo creato', 'success')
    } catch (err) {
      setError(err.error || 'Errore nel salvataggio mazzo')
      toast(err.error || 'Errore nel salvataggio mazzo', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveDeckEdit = async (deckId) => {
    setSaving(true)

    try {
      await api.updateDeck(deckId, {
        ...editingDeckForm,
        userId: Number.parseInt(editingDeckForm.userId, 10),
        commander: editingDeckForm.commander.trim() || null,
        colors: editingDeckForm.colors.trim().toUpperCase() || null,
        bracket: editingDeckForm.bracket || null,
        archetype: editingDeckForm.archetype || null
      })
      setEditingDeckId(null)
      setEditingDeckForm(EMPTY_DECK_FORM)
      await loadData()
      toast('Mazzo aggiornato', 'success')
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento mazzo')
      toast(err.error || 'Errore nell\'aggiornamento mazzo', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeDeck = async (deckId) => {
    const ok = await confirm({ title: 'Eliminare mazzo?', message: 'Il mazzo verrà eliminato definitivamente.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return

    try {
      await api.deleteDeck(deckId)
      await loadData()
      toast('Mazzo eliminato', 'success')
    } catch (err) {
      toast(err.error || 'Errore nell\'eliminazione mazzo', 'error')
    }
  }

  const submitGameEdit = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      const filled = gameForm.slots.filter((slot) => slot.userId && slot.deckId)
      const losers = filled.filter((s) => !(s.userId === gameForm.winnerId && s.deckId === gameForm.winnerDeckId))
      // placement completo solo se l'ordine copre tutti i perdenti
      const placements = gameForm.elimOrder.length === losers.length && losers.length > 0
        ? (() => {
            const n = filled.length
            const map = { [`${gameForm.winnerId}-${gameForm.winnerDeckId}`]: 1 }
            gameForm.elimOrder.forEach((key, i) => { map[key] = n - i })
            return map
          })()
        : null

      const payload = {
        players: filled.map((slot) => ({
          userId: Number.parseInt(slot.userId, 10),
          deckId: Number.parseInt(slot.deckId, 10),
          ...(placements ? { placement: placements[`${slot.userId}-${slot.deckId}`] } : {}),
          ...(gameForm.elimBy[`${slot.userId}-${slot.deckId}`] ? { eliminatedById: Number.parseInt(gameForm.elimBy[`${slot.userId}-${slot.deckId}`], 10) } : {})
        })),
        winnerId: Number.parseInt(gameForm.winnerId, 10),
        winnerDeckId: Number.parseInt(gameForm.winnerDeckId, 10),
        notes: gameForm.notes.trim() || undefined,
        playedAt: gameForm.playedAt || undefined
      }

      await api.updateGame(gameForm.id, payload)
      setGameForm(EMPTY_GAME_FORM)
      await loadData()
      toast('Partita aggiornata', 'success')
    } catch (err) {
      setError(err.error || 'Errore nell\'aggiornamento partita')
    } finally {
      setSaving(false)
    }
  }

  const removeGame = async (gameId) => {
    const ok = await confirm({ title: 'Eliminare partita?', message: 'La partita verrà eliminata definitivamente.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return

    try {
      await api.deleteGame(gameId)
      if (gameForm.id === gameId) {
        setGameForm(EMPTY_GAME_FORM)
      }
      await loadData()
      toast('Partita eliminata', 'success')
    } catch (err) {
      toast(err.error || 'Errore nell\'eliminazione partita', 'error')
    }
  }

  const handleDeckCommanderBlur = async () => {
    const name = deckForm.commander.trim()
    if (!name) return
    setDetectingDeckColors(true)
    try {
      const colors = await fetchCommanderColors(name)
      if (colors !== null) setDeckForm(f => ({ ...f, colors: colors.join('') }))
    } finally {
      setDetectingDeckColors(false)
    }
  }

  const handleEditCommanderBlur = async () => {
    const name = editingDeckForm.commander.trim()
    if (!name) return
    setDetectingEditColors(true)
    try {
      const colors = await fetchCommanderColors(name)
      if (colors !== null) setEditingDeckForm(f => ({ ...f, colors: colors.join('') }))
    } finally {
      setDetectingEditColors(false)
    }
  }

  const exportData = async () => {
    try {
      const data = await api.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeGroup?.slug || 'gruppo'}-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('Backup scaricato', 'success')
    } catch (err) {
      toast(err.error || 'Errore durante l\'export', 'error')
    }
  }

  const inputStyle = {
    padding: '9px 12px',
    borderRadius: 8,
    border: `0.5px solid ${t.border}`,
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    background: t.inputBg,
    color: t.text,
  }

  const buttonPrimary = {
    padding: '9px 16px',
    background: t.primary,
    color: t.primaryFg,
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer'
  }

  const buttonSecondary = {
    padding: '8px 12px',
    background: t.bgSurface,
    color: t.textSub,
    border: `0.5px solid ${t.border}`,
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer'
  }

  const buttonDanger = {
    padding: '8px 12px',
    background: t.dangerBg,
    color: t.danger,
    border: `0.5px solid ${t.dangerBorder}`,
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer'
  }

  if (loading) {
    return <div style={{ color: t.textSub, fontSize: 14, padding: '2rem' }}>Caricamento area admin...</div>
  }

  return (
    <div style={{ color: t.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Amministrazione</div>
        <button onClick={exportData} style={{ ...buttonSecondary, fontWeight: 600 }}>⬇ Esporta backup (JSON)</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['utenti', 'mazzi', 'partite'].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            style={{
              ...buttonSecondary,
              background: tab === item ? t.primary : t.bgSurface,
              color: tab === item ? t.primaryFg : t.textSub,
              borderColor: tab === item ? t.primary : t.border
            }}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === 'utenti' && (
        <div>
          <SectionCard t={t}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Invita nuovi membri</div>
            <div style={{ fontSize: 13, color: t.textSub, marginBottom: 12 }}>
              Chi vuole unirsi crea un account e poi inserisce il codice invito del gruppo. Nuovi utenti non si creano più da qui.
            </div>
            <InviteCodePanel t={t} buttonSecondary={buttonSecondary} toast={toast} />
          </SectionCard>

          {members.map((member) => (
            <SectionCard key={member.userId} t={t}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, color: t.text }}>{member.username} <span style={{ color: t.textSub, fontWeight: 500 }}>· {member.role}</span></div>
                  <div style={{ fontSize: 12, color: t.textSub }}>
                    Mazzi: {member.decks} · Presenze: {member.games}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={buttonSecondary} onClick={() => toggleMemberRole(member)}>
                    {member.role === 'ADMIN' ? 'Rendi PLAYER' : 'Rendi ADMIN'}
                  </button>
                  <button style={buttonDanger} onClick={() => removeMember(member)}>Rimuovi dal gruppo</button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {tab === 'mazzi' && (
        <div>
          <SectionCard t={t}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Crea mazzo</div>
            <form onSubmit={submitDeck} style={{ display: 'grid', gridTemplateColumns: cols('1fr 2fr 2fr 1fr 1fr 1fr auto'), gap: 8 }}>
              <select style={inputStyle} value={deckForm.userId} onChange={(event) => setDeckForm((current) => ({ ...current, userId: event.target.value }))}>
                <option value="">Owner</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{member.username}</option>)}
              </select>
              <input style={inputStyle} placeholder="Nome mazzo" value={deckForm.name} onChange={(event) => setDeckForm((current) => ({ ...current, name: event.target.value }))} />
              <CommanderInput
                style={inputStyle}
                placeholder="Commander"
                value={deckForm.commander}
                onChange={(name) => setDeckForm((current) => ({ ...current, commander: name }))}
                onBlur={handleDeckCommanderBlur}
              />
              <input
                style={{ ...inputStyle, color: detectingDeckColors ? t.primary : t.text }}
                placeholder={detectingDeckColors ? 'rilevamento...' : 'Colori es. WUG'}
                value={deckForm.colors}
                onChange={(event) => setDeckForm((current) => ({ ...current, colors: event.target.value }))}
                readOnly={detectingDeckColors}
              />
              <select style={inputStyle} value={deckForm.bracket} onChange={(event) => setDeckForm((current) => ({ ...current, bracket: event.target.value }))}>
                <option value="">Livello</option>
                {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
              </select>
              <select style={inputStyle} value={deckForm.archetype} onChange={(event) => setDeckForm((current) => ({ ...current, archetype: event.target.value }))}>
                <option value="">Archetipo</option>
                {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button type="submit" style={buttonPrimary} disabled={saving}>Crea</button>
            </form>
          </SectionCard>

          {decks.map((deck) => (
            <SectionCard key={deck.id} t={t}>
              {editingDeckId === deck.id ? (
                <div style={{ display: 'grid', gridTemplateColumns: cols('1fr 2fr 2fr 1fr 1fr 1fr auto auto'), gap: 8 }}>
                  <select style={inputStyle} value={editingDeckForm.userId} onChange={(event) => setEditingDeckForm((current) => ({ ...current, userId: event.target.value }))}>
                    {members.map((member) => <option key={member.userId} value={member.userId}>{member.username}</option>)}
                  </select>
                  <input style={inputStyle} value={editingDeckForm.name} onChange={(event) => setEditingDeckForm((current) => ({ ...current, name: event.target.value }))} />
                  <CommanderInput
                    style={inputStyle}
                    value={editingDeckForm.commander}
                    onChange={(name) => setEditingDeckForm((current) => ({ ...current, commander: name }))}
                    onBlur={handleEditCommanderBlur}
                  />
                  <input
                    style={{ ...inputStyle, color: detectingEditColors ? t.primary : t.text }}
                    placeholder={detectingEditColors ? 'rilevamento...' : ''}
                    value={editingDeckForm.colors}
                    onChange={(event) => setEditingDeckForm((current) => ({ ...current, colors: event.target.value }))}
                    readOnly={detectingEditColors}
                  />
                  <select style={inputStyle} value={editingDeckForm.bracket} onChange={(event) => setEditingDeckForm((current) => ({ ...current, bracket: event.target.value }))}>
                    <option value="">Livello</option>
                    {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b}</option>)}
                  </select>
                  <select style={inputStyle} value={editingDeckForm.archetype} onChange={(event) => setEditingDeckForm((current) => ({ ...current, archetype: event.target.value }))}>
                    <option value="">Archetipo</option>
                    {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button style={buttonPrimary} onClick={() => saveDeckEdit(deck.id)}>Salva</button>
                  <button style={buttonSecondary} onClick={() => setEditingDeckId(null)}>Annulla</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {deck.commander && (
                    <img
                      src={`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(deck.commander)}&format=image&version=art_crop`}
                      alt=""
                      onError={e => { e.currentTarget.style.display = 'none' }}
                      style={{ width: 72, height: 52, objectFit: 'cover', objectPosition: 'center top', borderRadius: 6, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span onClick={() => navigate(`/mazzo/${deck.id}`)} title="Apri il profilo del mazzo" style={{ cursor: 'pointer' }}>{deck.name}</span>
                      <ArchetypeBadge archetype={deck.archetype} />
                      <BracketBadge bracket={deck.bracket} />
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      {deck.user.username} · {deck.commander || 'Nessun commander'} · {deck.colors || 'Senza colori'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <DeckListPanel
                      decklist={deck.decklist}
                      commander={deck.commander}
                      onSave={async (newList, newCommander, newColors) => {
                        await api.updateDeck(deck.id, {
                          decklist: newList,
                          commander: newCommander,
                          colors: newColors || undefined
                        })
                        await loadData()
                        toast('Lista salvata', 'success')
                      }}
                    />
                    <button style={buttonSecondary} onClick={() => startDeckEdit(deck)}>Modifica</button>
                    <button style={buttonDanger} onClick={() => removeDeck(deck.id)}>Elimina</button>
                  </div>
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      {tab === 'partite' && (
        <div>
          <SectionCard t={t}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Gestione partite</div>
            <div style={{ fontSize: 13, color: '#888' }}>Per creare nuove partite puoi continuare a usare la pagina "+ Partita". Qui puoi modificare o eliminare le partite esistenti.</div>
          </SectionCard>

          {gameForm.id && (
            <SectionCard t={t}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Modifica partita #{gameForm.id}</div>
              <form onSubmit={submitGameEdit}>
                {gameForm.slots.map((slot, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: cols('40px 1fr 1fr auto'), gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', color: t.textSub }}>{index + 1}</div>
                    <select style={inputStyle} value={slot.userId} onChange={(event) => updateGameSlot(index, 'userId', event.target.value)}>
                      <option value="">Giocatore</option>
                      {members.map((member) => <option key={member.userId} value={member.userId}>{member.username}</option>)}
                    </select>
                    <select style={inputStyle} value={slot.deckId} onChange={(event) => updateGameSlot(index, 'deckId', event.target.value)} disabled={!slot.userId}>
                      <option value="">Mazzo</option>
                      {(decksByUser[slot.userId] || []).map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
                    </select>
                    {index >= 3 ? <button type="button" style={buttonSecondary} onClick={() => removeGameSlot(index)}>Rimuovi</button> : <div />}
                  </div>
                ))}

                <div style={{ marginBottom: 12 }}>
                  <button type="button" style={buttonSecondary} onClick={addGameSlot}>Aggiungi giocatore</button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>Data partita</div>
                  <input
                    type="date"
                    style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
                    value={gameForm.playedAt}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setGameForm((current) => ({ ...current, playedAt: event.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {gameCandidates.map((slot, index) => {
                    const active = gameForm.winnerId === slot.userId && gameForm.winnerDeckId === slot.deckId
                    const user = usersById.get(Number.parseInt(slot.userId, 10))
                    const deck = decks.find((candidate) => candidate.id === Number.parseInt(slot.deckId, 10))

                    return (
                      <button
                        key={`${slot.userId}-${slot.deckId}-${index}`}
                        type="button"
                        onClick={() => setGameForm((current) => ({ ...current, winnerId: slot.userId, winnerDeckId: slot.deckId, elimOrder: [], elimBy: {} }))}
                        style={{
                          ...buttonSecondary,
                          background: active ? t.winBg : t.bgSurface,
                          color: active ? t.win : t.textSub,
                          borderColor: active ? t.win : t.border
                        }}
                      >
                        {user?.username} · {deck?.name}
                      </button>
                    )
                  })}
                </div>

                {/* Ordine di uscita (opzionale) */}
                {gameForm.winnerId && (() => {
                  const losers = gameCandidates.filter((s) => !(s.userId === gameForm.winnerId && s.deckId === gameForm.winnerDeckId))
                  if (losers.length < 2) return null
                  const total = gameCandidates.length
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: t.textSub, marginBottom: 6 }}>
                        Ordine di uscita (opzionale) — clicca dal primo eliminato all'ultimo
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {losers.map((slot, index) => {
                          const key = `${slot.userId}-${slot.deckId}`
                          const pos = gameForm.elimOrder.indexOf(key)
                          const picked = pos !== -1
                          const user = usersById.get(Number.parseInt(slot.userId, 10))
                          const deck = decks.find((c) => c.id === Number.parseInt(slot.deckId, 10))
                          return (
                            <button
                              key={`${key}-${index}`}
                              type="button"
                              onClick={() => setGameForm((current) => ({
                                ...current,
                                elimOrder: current.elimOrder.includes(key)
                                  ? current.elimOrder.filter((k) => k !== key)
                                  : [...current.elimOrder, key]
                              }))}
                              style={{
                                ...buttonSecondary,
                                background: picked ? t.primaryBg : t.bgSurface,
                                color: picked ? t.primary : t.textSub,
                                borderColor: picked ? t.primaryBorder : t.border,
                                display: 'flex', alignItems: 'center', gap: 6,
                              }}
                            >
                              {picked && <span style={{ fontWeight: 800 }}>{total - pos}°</span>}
                              {user?.username} · {deck?.name}
                            </button>
                          )
                        })}
                      </div>
                      {gameForm.elimOrder.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: gameForm.elimOrder.length === losers.length ? t.win : t.textMuted }}>
                          {gameForm.elimOrder.length === losers.length ? '✓ Classifica completa' : `${gameForm.elimOrder.length}/${losers.length} ordinati`}
                          <button type="button" onClick={() => setGameForm((c) => ({ ...c, elimOrder: [] }))} style={{ marginLeft: 10, fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}>✕ azzera</button>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Eliminazioni: chi ha eliminato chi (opzionale) */}
                {gameForm.winnerId && (() => {
                  const losers = gameCandidates.filter((s) => !(s.userId === gameForm.winnerId && s.deckId === gameForm.winnerDeckId))
                  if (losers.length < 1) return null
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: t.textSub, marginBottom: 6 }}>Eliminazioni (opzionale) — chi ha eliminato chi</div>
                      {losers.map((slot, index) => {
                        const key = `${slot.userId}-${slot.deckId}`
                        const user = usersById.get(Number.parseInt(slot.userId, 10))
                        const deck = decks.find((c) => c.id === Number.parseInt(slot.deckId, 10))
                        return (
                          <div key={`${key}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, color: t.text, minWidth: 150 }}>{user?.username} · {deck?.name}</span>
                            <span style={{ fontSize: 12, color: t.textMuted }}>eliminato da</span>
                            <select
                              style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
                              value={gameForm.elimBy[key] || ''}
                              onChange={(event) => setGameForm((current) => ({ ...current, elimBy: { ...current.elimBy, [key]: event.target.value } }))}
                            >
                              <option value="">— sconosciuto</option>
                              {gameCandidates.filter((o) => `${o.userId}-${o.deckId}` !== key).map((o, oi) => {
                                const ou = usersById.get(Number.parseInt(o.userId, 10))
                                return <option key={oi} value={o.userId}>{ou?.username}</option>
                              })}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                <input
                  style={{ ...inputStyle, marginBottom: 12 }}
                  placeholder="Note"
                  value={gameForm.notes}
                  onChange={(event) => setGameForm((current) => ({ ...current, notes: event.target.value }))}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={buttonPrimary} disabled={saving}>Salva partita</button>
                  <button type="button" style={buttonSecondary} onClick={() => setGameForm(EMPTY_GAME_FORM)}>Chiudi modifica</button>
                </div>
              </form>
            </SectionCard>
          )}

          {games.map((game) => {
            const winner = game.players.find((player) => player.isWinner)
            return (
              <SectionCard key={game.id} t={t}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: t.text }}>Partita #{game.id}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      Creata da {game.createdBy?.username || 'sconosciuto'} · {winner ? `${winner.user.username} vince con ${winner.deck.name}` : 'Nessun vincitore'}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>
                      {game.players.map((player) => `${player.user.username} · ${player.deck.name}`).join(' | ')}
                    </div>
                    {game.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{game.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={buttonSecondary} onClick={() => startGameEdit(game)}>Modifica</button>
                    <button style={buttonDanger} onClick={() => removeGame(game.id)}>Elimina</button>
                  </div>
                </div>
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
