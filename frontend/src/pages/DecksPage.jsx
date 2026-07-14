import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useIsMobile } from '../hooks/useIsMobile'
import { fetchCommanderColors } from '../lib/scryfall'
import { useFeedback } from '../hooks/useFeedback'
import DeckListPanel from '../components/DeckListPanel'
import CommanderInput from '../components/CommanderInput'
import { SkeletonList } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import BracketBadge from '../components/BracketBadge'
import { BRACKETS, BRACKET_OPTIONS } from '../lib/brackets'
import ArchetypeBadge from '../components/ArchetypeBadge'
import { ARCHETYPE_OPTIONS } from '../lib/archetypes'

const COLOR_MAP   = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
const COLOR_LABEL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }

function ColorPip({ c }) {
  return (
    <span title={COLOR_LABEL[c]} style={{
      display: 'inline-block', width: 18, height: 18, borderRadius: '50%',
      background: COLOR_MAP[c] || '#eee', border: '1px solid rgba(0,0,0,0.15)',
      fontSize: 10, lineHeight: '18px', textAlign: 'center', fontWeight: 600, color: '#444'
    }}>{c}</span>
  )
}

const commanderArtUrl = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

export default function DecksPage() {
  const { t } = useTheme()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const [decks, setDecks]                     = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState('')
  const [form, setForm]                       = useState({ name: '', commander: '', colors: [], bracket: '', archetype: '' })
  const [saving, setSaving]                   = useState(false)
  const [formError, setFormError]             = useState('')
  const [detectingColors, setDetectingColors] = useState(false)

  const loadDecks = async () => {
    try { setDecks(await api.getMyDecks()) }
    catch { setError('Errore nel caricamento mazzi') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadDecks() }, [])

  const toggleColor = (c) =>
    setForm(f => ({ ...f, colors: f.colors.includes(c) ? f.colors.filter(x => x !== c) : [...f.colors, c] }))

  const handleCommanderBlur = async () => {
    const name = form.commander.trim()
    if (!name) return
    setDetectingColors(true)
    try {
      const colors = await fetchCommanderColors(name)
      if (colors !== null) setForm(f => ({ ...f, colors }))
    } finally { setDetectingColors(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Il nome è obbligatorio'); return }
    setSaving(true); setFormError('')
    try {
      await api.createDeck({ name: form.name.trim(), commander: form.commander.trim() || null, colors: form.colors.join('') || null, bracket: form.bracket || null, archetype: form.archetype || null })
      setForm({ name: '', commander: '', colors: [], bracket: '', archetype: '' })
      await loadDecks()
      toast('Mazzo aggiunto', 'success')
    } catch (err) {
      setFormError(err.error || 'Errore nel salvataggio')
    } finally { setSaving(false) }
  }

  const updateBracket = async (id, bracket) => {
    try {
      await api.updateDeck(id, { bracket: bracket || null })
      await loadDecks()
      toast('Livello aggiornato', 'success')
    } catch (err) {
      toast(err.error || 'Errore aggiornamento livello', 'error')
    }
  }

  const updateArchetype = async (id, archetype) => {
    try {
      await api.updateDeck(id, { archetype: archetype || null })
      await loadDecks()
      toast('Archetipo aggiornato', 'success')
    } catch (err) {
      toast(err.error || 'Errore aggiornamento archetipo', 'error')
    }
  }

  const deleteDeck = async (id, name) => {
    const ok = await confirm({
      title: 'Eliminare il mazzo?',
      message: `"${name}" verrà eliminato definitivamente.`,
      confirmLabel: 'Elimina',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deleteDeck(id)
      await loadDecks()
      toast('Mazzo eliminato', 'success')
    } catch (err) {
      toast(err.error || 'Errore nella cancellazione', 'error')
    }
  }

  const glass = {
    background: t.bgSurface,
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`,
    boxShadow: t.shadow,
  }
  const formCard = { ...glass, borderRadius: 16, padding: '1.15rem 1.35rem', marginBottom: 14 }
  const deckCard = { ...glass, borderRadius: 16, marginBottom: 12, overflow: 'hidden' }
  const inputSt  = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text }
  const btnPrimary  = { padding: '9px 20px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
  const btnDanger   = { padding: '5px 12px', background: t.dangerBg, color: t.danger, border: `0.5px solid ${t.dangerBorder}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1.25rem', color: t.text }}>I miei mazzi</div>

      {/* Form aggiungi */}
      <div style={formCard}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: t.text }}>Aggiungi mazzo</div>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input style={inputSt} placeholder="Nome mazzo *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <CommanderInput
              style={inputSt}
              placeholder="Commander (opzionale)"
              value={form.commander}
              onChange={(name) => setForm(f => ({ ...f, commander: name }))}
              onBlur={handleCommanderBlur}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: t.textSub }}>
              Colori:{detectingColors && <span style={{ marginLeft: 6, fontSize: 11, color: t.primary }}>rilevamento...</span>}
            </span>
            {['W', 'U', 'B', 'R', 'G'].map(c => (
              <button key={c} type="button" onClick={() => toggleColor(c)} style={{
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: '#444', background: COLOR_MAP[c],
                border: form.colors.includes(c) ? `2px solid ${t.primary}` : '1px solid #ccc',
                outline: form.colors.includes(c) ? `2px solid ${t.primaryBorder}` : 'none'
              }}>{c}</button>
            ))}
            <span style={{ fontSize: 13, color: t.textSub, marginLeft: 8 }}>Livello:</span>
            <select
              style={{ ...inputSt, width: 'auto', padding: '6px 10px' }}
              value={form.bracket}
              onChange={e => setForm(f => ({ ...f, bracket: e.target.value }))}
            >
              <option value="">—</option>
              {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
            </select>
            <span style={{ fontSize: 13, color: t.textSub }}>Archetipo:</span>
            <select
              style={{ ...inputSt, width: 'auto', padding: '6px 10px' }}
              value={form.archetype}
              onChange={e => setForm(f => ({ ...f, archetype: e.target.value }))}
            >
              <option value="">—</option>
              {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {formError && <div style={{ color: t.danger, fontSize: 13, marginBottom: 8 }}>{formError}</div>}
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? 'Salvataggio...' : '+ Aggiungi mazzo'}</button>
        </form>
      </div>

      {loading && <SkeletonList rows={3} />}
      {error   && <div style={{ color: t.danger, fontSize: 14 }}>{error}</div>}
      {!loading && decks.length === 0 && (
        <EmptyState icon="🎴" title="Nessun mazzo" message="Aggiungi il tuo primo mazzo dal modulo qui sopra: bastano nome e commander." />
      )}

      {decks.map(deck => (
        <div key={deck.id} className="ct-lift ct-fade-up" style={deckCard}>
          {deck.commander ? (
            <div
              onClick={() => navigate(`/mazzo/${deck.id}`)}
              title="Apri il profilo del mazzo"
              style={{ position: 'relative', height: 96, background: '#1a1640', overflow: 'hidden', cursor: 'pointer' }}
            >
              <img
                src={commanderArtUrl(deck.commander)} alt=""
                onError={e => { e.currentTarget.style.display = 'none' }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{deck.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{deck.commander}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {deck.archetype && <ArchetypeBadge archetype={deck.archetype} />}
                    {deck.bracket && <BracketBadge bracket={deck.bracket} />}
                  </div>
                  {deck.colors && <div style={{ display: 'flex', gap: 3 }}>{deck.colors.split('').map(c => <ColorPip key={c} c={c} />)}</div>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div onClick={() => navigate(`/mazzo/${deck.id}`)} title="Apri il profilo del mazzo" style={{ fontWeight: 600, fontSize: 15, color: t.text, cursor: 'pointer' }}>{deck.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {deck.archetype && <ArchetypeBadge archetype={deck.archetype} />}
                {deck.bracket && <BracketBadge bracket={deck.bracket} />}
                {deck.colors && <div style={{ display: 'flex', gap: 3 }}>{deck.colors.split('').map(c => <ColorPip key={c} c={c} />)}</div>}
              </div>
            </div>
          )}

          <div style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={deck.archetype || ''}
              onChange={e => updateArchetype(deck.id, e.target.value)}
              title="Archetipo"
              style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, cursor: 'pointer', outline: 'none', flex: 1, minWidth: 0 }}
            >
              <option value="">— archetipo</option>
              {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              value={deck.bracket || ''}
              onChange={e => updateBracket(deck.id, e.target.value)}
              title="Livello"
              style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, cursor: 'pointer', outline: 'none' }}
            >
              <option value="">— livello</option>
              {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
            </select>
            <DeckListPanel
              decklist={deck.decklist}
              commander={deck.commander}
              name={deck.name}
              onSave={async (newList, newCommander, newColors, newName) => {
                await api.updateDeck(deck.id, {
                  name: newName,
                  decklist: newList,
                  commander: newCommander,
                  colors: newColors || undefined,
                })
                await loadDecks()
                toast('Mazzo aggiornato', 'success')
              }}
            />
            <button style={btnDanger} onClick={() => deleteDeck(deck.id, deck.name)}>Elimina</button>
          </div>
        </div>
      ))}
    </div>
  )
}
