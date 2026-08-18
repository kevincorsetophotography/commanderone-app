import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import DeckListPanel from '../components/DeckListPanel'
import { useTheme } from '../hooks/useTheme'
import { useGroup } from '../hooks/useGroup'
import { fetchCommanderColors } from '../lib/scryfall'
import { useFeedback } from '../hooks/useFeedback'
import { useIsMobile } from '../hooks/useIsMobile'
import CommanderInput from '../components/CommanderInput'
import BracketBadge from '../components/BracketBadge'
import { BRACKETS, BRACKET_OPTIONS, bracketLabel } from '../lib/brackets'
import ArchetypeBadge from '../components/ArchetypeBadge'
import { ARCHETYPE_OPTIONS } from '../lib/archetypes'
import { ordinal } from '../lib/ordinal'

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

function InviteCodePanel({ t, tr, buttonSecondary, toast }) {
  const { activeGroup, refresh } = useGroup()
  const [regenerating, setRegenerating] = useState(false)

  const regenerate = async () => {
    if (!activeGroup) return
    setRegenerating(true)
    try {
      await api.regenerateInviteCode(activeGroup.slug)
      await refresh()
      toast(tr('adminPage.regenerateSuccess'), 'success')
    } catch (err) {
      toast(err.error || tr('adminPage.regenerateError'), 'error')
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
        {regenerating ? '...' : tr('adminPage.regenerateButton')}
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
  const { t: tr, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'it-IT'
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
      setError(err.error || tr('adminPage.loadError'))
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
      toast(tr('adminPage.roleChanged', { username: member.username, role: nextRole === 'ADMIN' ? tr('account.groups.admin') : tr('account.groups.player') }), 'success')
    } catch (err) {
      toast(err.error || tr('adminPage.roleUpdateError'), 'error')
    }
  }

  const removeMember = async (member) => {
    const ok = await confirm({ title: tr('adminPage.confirmRemoveMemberTitle'), message: tr('adminPage.confirmRemoveMemberMessage', { username: member.username }), confirmLabel: tr('adminPage.confirmRemoveMemberConfirm'), danger: true })
    if (!ok) return

    try {
      await api.removeMember(member.userId)
      await loadData()
      toast(tr('adminPage.memberRemoved'), 'success')
    } catch (err) {
      toast(err.error || tr('adminPage.memberRemoveError'), 'error')
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
      toast(tr('adminPage.deckCreated'), 'success')
    } catch (err) {
      setError(err.error || tr('adminPage.deckSaveError'))
      toast(err.error || tr('adminPage.deckSaveError'), 'error')
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
      toast(tr('adminPage.deckUpdated'), 'success')
    } catch (err) {
      setError(err.error || tr('adminPage.deckUpdateError'))
      toast(err.error || tr('adminPage.deckUpdateError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeDeck = async (deckId) => {
    const ok = await confirm({ title: tr('adminPage.confirmDeleteDeckTitle'), message: tr('adminPage.confirmDeleteDeckMessage'), confirmLabel: tr('common.delete'), danger: true })
    if (!ok) return

    try {
      await api.deleteDeck(deckId)
      await loadData()
      toast(tr('adminPage.deckDeleted'), 'success')
    } catch (err) {
      toast(err.error || tr('adminPage.deckDeleteError'), 'error')
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
      toast(tr('adminPage.gameUpdated'), 'success')
    } catch (err) {
      setError(err.error || tr('adminPage.gameUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  const removeGame = async (gameId) => {
    const ok = await confirm({ title: tr('adminPage.confirmDeleteGameTitle'), message: tr('adminPage.confirmDeleteGameMessage'), confirmLabel: tr('common.delete'), danger: true })
    if (!ok) return

    try {
      await api.deleteGame(gameId)
      if (gameForm.id === gameId) {
        setGameForm(EMPTY_GAME_FORM)
      }
      await loadData()
      toast(tr('adminPage.gameDeleted'), 'success')
    } catch (err) {
      toast(err.error || tr('adminPage.gameDeleteError'), 'error')
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
      toast(tr('adminPage.backupDownloaded'), 'success')
    } catch (err) {
      toast(err.error || tr('adminPage.exportError'), 'error')
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
    return <div style={{ color: t.textSub, fontSize: 14, padding: '2rem' }}>{tr('adminPage.loadingAdmin')}</div>
  }

  const TAB_LABEL_KEY = { utenti: 'tabUsers', mazzi: 'tabDecks', partite: 'tabGames' }

  return (
    <div style={{ color: t.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{tr('adminPage.title')}</div>
        <button onClick={exportData} style={{ ...buttonSecondary, fontWeight: 600 }}>{tr('adminPage.exportBackup')}</button>
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
            {tr(`adminPage.${TAB_LABEL_KEY[item]}`)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === 'utenti' && (
        <div>
          <SectionCard t={t}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{tr('adminPage.inviteNewMembers')}</div>
            <div style={{ fontSize: 13, color: t.textSub, marginBottom: 12 }}>
              {tr('adminPage.inviteHint')}
            </div>
            <InviteCodePanel t={t} tr={tr} buttonSecondary={buttonSecondary} toast={toast} />
          </SectionCard>

          {members.map((member) => (
            <SectionCard key={member.userId} t={t}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, color: t.text }}>{member.username} <span style={{ color: t.textSub, fontWeight: 500 }}>· {member.role === 'ADMIN' ? tr('account.groups.admin') : tr('account.groups.player')}</span></div>
                  <div style={{ fontSize: 12, color: t.textSub }}>
                    {tr('adminPage.memberStats', { decks: member.decks, games: member.games })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={buttonSecondary} onClick={() => toggleMemberRole(member)}>
                    {member.role === 'ADMIN' ? tr('adminPage.makePlayer') : tr('adminPage.makeAdmin')}
                  </button>
                  <button style={buttonDanger} onClick={() => removeMember(member)}>{tr('adminPage.removeFromGroup')}</button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {tab === 'mazzi' && (
        <div>
          <SectionCard t={t}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{tr('adminPage.createDeck')}</div>
            <form onSubmit={submitDeck} style={{ display: 'grid', gridTemplateColumns: cols('1fr 2fr 2fr 1fr 1fr 1fr auto'), gap: 8 }}>
              <select style={inputStyle} value={deckForm.userId} onChange={(event) => setDeckForm((current) => ({ ...current, userId: event.target.value }))}>
                <option value="">{tr('adminPage.ownerPlaceholder')}</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{member.username}</option>)}
              </select>
              <input style={inputStyle} placeholder={tr('deckList.deckName')} value={deckForm.name} onChange={(event) => setDeckForm((current) => ({ ...current, name: event.target.value }))} />
              <CommanderInput
                style={inputStyle}
                placeholder={tr('deckList.commander')}
                value={deckForm.commander}
                onChange={(name) => setDeckForm((current) => ({ ...current, commander: name }))}
                onBlur={handleDeckCommanderBlur}
              />
              <input
                style={{ ...inputStyle, color: detectingDeckColors ? t.primary : t.text }}
                placeholder={detectingDeckColors ? tr('decksPage.detecting') : tr('adminPage.colorsPlaceholder')}
                value={deckForm.colors}
                onChange={(event) => setDeckForm((current) => ({ ...current, colors: event.target.value }))}
                readOnly={detectingDeckColors}
              />
              <select style={inputStyle} value={deckForm.bracket} onChange={(event) => setDeckForm((current) => ({ ...current, bracket: event.target.value }))}>
                <option value="">{tr('adminPage.levelPlaceholder')}</option>
                {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {bracketLabel(b, tr)}</option>)}
              </select>
              <select style={inputStyle} value={deckForm.archetype} onChange={(event) => setDeckForm((current) => ({ ...current, archetype: event.target.value }))}>
                <option value="">{tr('adminPage.archetypePlaceholder')}</option>
                {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button type="submit" style={buttonPrimary} disabled={saving}>{tr('adminPage.createButton')}</button>
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
                    placeholder={detectingEditColors ? tr('decksPage.detecting') : ''}
                    value={editingDeckForm.colors}
                    onChange={(event) => setEditingDeckForm((current) => ({ ...current, colors: event.target.value }))}
                    readOnly={detectingEditColors}
                  />
                  <select style={inputStyle} value={editingDeckForm.bracket} onChange={(event) => setEditingDeckForm((current) => ({ ...current, bracket: event.target.value }))}>
                    <option value="">{tr('adminPage.levelPlaceholder')}</option>
                    {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b}</option>)}
                  </select>
                  <select style={inputStyle} value={editingDeckForm.archetype} onChange={(event) => setEditingDeckForm((current) => ({ ...current, archetype: event.target.value }))}>
                    <option value="">{tr('adminPage.archetypePlaceholder')}</option>
                    {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button style={buttonPrimary} onClick={() => saveDeckEdit(deck.id)}>{tr('common.save')}</button>
                  <button style={buttonSecondary} onClick={() => setEditingDeckId(null)}>{tr('common.cancel')}</button>
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
                      <span onClick={() => navigate(`/mazzo/${deck.id}`)} title={tr('decksPage.openDeckProfile')} style={{ cursor: 'pointer' }}>{deck.name}</span>
                      <ArchetypeBadge archetype={deck.archetype} />
                      <BracketBadge bracket={deck.bracket} />
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      {deck.user.username} · {deck.commander || tr('deckProfilePage.noCommander')} · {deck.colors || tr('adminPage.deckNoColors')}
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
                        toast(tr('adminPage.listSaved'), 'success')
                      }}
                    />
                    <button style={buttonSecondary} onClick={() => startDeckEdit(deck)}>{tr('common.edit')}</button>
                    <button style={buttonDanger} onClick={() => removeDeck(deck.id)}>{tr('common.delete')}</button>
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
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{tr('adminPage.manageGames')}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{tr('adminPage.manageGamesHint')}</div>
          </SectionCard>

          {gameForm.id && (
            <SectionCard t={t}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{tr('adminPage.editGameTitle', { id: gameForm.id })}</div>
              <form onSubmit={submitGameEdit}>
                {gameForm.slots.map((slot, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: cols('40px 1fr 1fr auto'), gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', color: t.textSub }}>{index + 1}</div>
                    <select style={inputStyle} value={slot.userId} onChange={(event) => updateGameSlot(index, 'userId', event.target.value)}>
                      <option value="">{tr('adminPage.playerPlaceholder')}</option>
                      {members.map((member) => <option key={member.userId} value={member.userId}>{member.username}</option>)}
                    </select>
                    <select style={inputStyle} value={slot.deckId} onChange={(event) => updateGameSlot(index, 'deckId', event.target.value)} disabled={!slot.userId}>
                      <option value="">{tr('adminPage.deckPlaceholderPlain')}</option>
                      {(decksByUser[slot.userId] || []).map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
                    </select>
                    {index >= 3 ? <button type="button" style={buttonSecondary} onClick={() => removeGameSlot(index)}>{tr('adminPage.removeButton')}</button> : <div />}
                  </div>
                ))}

                <div style={{ marginBottom: 12 }}>
                  <button type="button" style={buttonSecondary} onClick={addGameSlot}>{tr('adminPage.addPlayerButton')}</button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{tr('newGamePage.gameDateLabel')}</div>
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
                        {tr('adminPage.eliminationOrderAdminHint')}
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
                              {picked && <span style={{ fontWeight: 800 }}>{ordinal(total - pos, locale)}</span>}
                              {user?.username} · {deck?.name}
                            </button>
                          )
                        })}
                      </div>
                      {gameForm.elimOrder.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: gameForm.elimOrder.length === losers.length ? t.win : t.textMuted }}>
                          {gameForm.elimOrder.length === losers.length ? tr('newGamePage.rankingComplete') : tr('newGamePage.orderedCount', { done: gameForm.elimOrder.length, total: losers.length })}
                          <button type="button" onClick={() => setGameForm((c) => ({ ...c, elimOrder: [] }))} style={{ marginLeft: 10, fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}>{tr('adminPage.resetShort')}</button>
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
                      <div style={{ fontSize: 12, color: t.textSub, marginBottom: 6 }}>{tr('adminPage.eliminationsAdminHint')}</div>
                      {losers.map((slot, index) => {
                        const key = `${slot.userId}-${slot.deckId}`
                        const user = usersById.get(Number.parseInt(slot.userId, 10))
                        const deck = decks.find((c) => c.id === Number.parseInt(slot.deckId, 10))
                        return (
                          <div key={`${key}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, color: t.text, minWidth: 150 }}>{user?.username} · {deck?.name}</span>
                            <span style={{ fontSize: 12, color: t.textMuted }}>{tr('newGamePage.eliminatedBy')}</span>
                            <select
                              style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
                              value={gameForm.elimBy[key] || ''}
                              onChange={(event) => setGameForm((current) => ({ ...current, elimBy: { ...current.elimBy, [key]: event.target.value } }))}
                            >
                              <option value="">{tr('newGamePage.unknownEliminator')}</option>
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
                  placeholder={tr('adminPage.notesPlaceholderPlain')}
                  value={gameForm.notes}
                  onChange={(event) => setGameForm((current) => ({ ...current, notes: event.target.value }))}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={buttonPrimary} disabled={saving}>{tr('newGamePage.saveGame')}</button>
                  <button type="button" style={buttonSecondary} onClick={() => setGameForm(EMPTY_GAME_FORM)}>{tr('adminPage.closeEdit')}</button>
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
                    <div style={{ fontWeight: 600, color: t.text }}>{tr('adminPage.gameNumberLabel', { id: game.id })}</div>
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      {tr('adminPage.createdByLine', { username: game.createdBy?.username || tr('adminPage.unknownCreator') })} {winner ? tr('adminPage.winnerLine', { username: winner.user.username, deck: winner.deck.name }) : tr('adminPage.noWinner')}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>
                      {game.players.map((player) => `${player.user.username} · ${player.deck.name}`).join(' | ')}
                    </div>
                    {game.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{game.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={buttonSecondary} onClick={() => startGameEdit(game)}>{tr('common.edit')}</button>
                    <button style={buttonDanger} onClick={() => removeGame(game.id)}>{tr('common.delete')}</button>
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
