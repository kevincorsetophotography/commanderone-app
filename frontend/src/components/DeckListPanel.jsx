import { useState } from 'react'
import { parseDecklist, validateAndFetchDecklist, fetchCommanderCard, fetchCommanderColors } from '../lib/scryfall'
import { resolveDecklistCards } from '../lib/cardCache'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import CommanderInput from './CommanderInput'

const COLOR_MAP   = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
const COLOR_LABEL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }

export default function DeckListPanel({ decklist, commander, name, onSave }) {
  const { t } = useTheme()
  const [open, setOpen]                     = useState(false)
  const [mode, setMode]                     = useState('view')
  const [nameInput, setNameInput]           = useState(name || '')
  const [commanderInput, setCommanderInput] = useState('')
  const [detectedColors, setDetectedColors] = useState(null)
  const [detectingColors, setDetectingColors] = useState(false)
  const [editText, setEditText]             = useState('')
  const [saving, setSaving]                 = useState(false)
  const [errors, setErrors]                 = useState([])
  const [cards, setCards]                   = useState([])
  const [loadingCards, setLoadingCards]     = useState(false)
  const [selectedCard, setSelectedCard]     = useState(null)
  const [importUrl, setImportUrl]           = useState('')
  const [importing, setImporting]           = useState(false)

  const hasList = !!decklist

  const btnSecondary = { padding: '5px 12px', background: t.bgSurface, color: t.textSub, border: `0.5px solid ${t.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }
  const btnPrimary   = { padding: '9px 20px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
  const inputSt      = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `0.5px solid ${t.border}`, fontSize: 13, background: t.inputBg, color: t.text, outline: 'none' }

  const openPanel = async () => {
    setOpen(true)
    setSelectedCard(null)
    if (decklist) {
      setMode('view')
      setLoadingCards(true)
      try { setCards(await resolveDecklistCards(decklist)) }
      finally { setLoadingCards(false) }
    } else {
      enterEditMode()
    }
  }

  const handleCommanderBlur = async () => {
    const cmdName = commanderInput.trim()
    if (!cmdName) return
    setDetectingColors(true)
    try {
      const colors = await fetchCommanderColors(cmdName)
      setDetectedColors(colors)
    } finally {
      setDetectingColors(false)
    }
  }

  const enterEditMode = () => {
    setNameInput(name || '')
    setCommanderInput(commander || '')
    setDetectedColors(null)
    if (decklist) {
      // Estrai le 99 carte (tutto tranne la riga del commander)
      const lines = decklist.split('\n').map(l => l.trim()).filter(Boolean)
      let removed = false
      const others = lines.filter(line => {
        if (removed) return true
        const m = line.match(/^\d+x?\s+(.+)$/)
        if (m && commander) {
          const entered = m[1].toLowerCase()
          const stored = commander.toLowerCase()
          const isDfc = entered.startsWith(stored + ' //') || stored.startsWith(entered + ' //')
          if (entered === stored || isDfc) { removed = true; return false }
        }
        return true
      })
      setEditText(others.join('\n'))
    } else {
      setEditText('')
    }
    setErrors([])
    setSelectedCard(null)
    setMode('edit')
  }

  const cancel = () => {
    setErrors([])
    if (decklist) setMode('view')
    else setOpen(false)
  }

  const save = async () => {
    setSaving(true)
    setErrors([])

    if (!nameInput.trim()) {
      setErrors(['Il nome del mazzo è obbligatorio'])
      setSaving(false)
      return
    }

    if (!commanderInput.trim()) {
      setErrors(['Inserisci il nome del commander'])
      setSaving(false)
      return
    }

    try {
      // 1. Valida il commander su Scryfall → ottieni nome esatto
      const commanderCard = await fetchCommanderCard(commanderInput.trim())
      if (!commanderCard) {
        setErrors([`Commander non trovato su Scryfall: "${commanderInput.trim()}"`])
        return
      }

      // 2. Costruisci la lista completa: 1 commander + 99 carte
      const fullList = `1 ${commanderCard.name}\n${editText.trim()}`

      // 3. Valida le 100 carte (esistenza + conteggio)
      const result = await validateAndFetchDecklist(fullList)
      if (!result.valid) {
        setErrors(result.errors)
        return
      }

      // 4. Salva — passa nome esatto commander + colori rilevati + nome mazzo
      const colorsToSave = detectedColors ? detectedColors.join('') : null
      await onSave(fullList, commanderCard.name, colorsToSave, nameInput.trim())
      setCards(result.cards)
      setSelectedCard(null)
      setDetectedColors(null)
      setMode('view')
    } catch (e) {
      setErrors([e?.error || 'Errore nel salvataggio'])
    } finally {
      setSaving(false)
    }
  }

  const doImport = async () => {
    const url = importUrl.trim()
    if (!url) return
    setImporting(true)
    setErrors([])
    try {
      const res = await api.importDeck(url)
      if (res.commander) setCommanderInput(res.commander)
      // togli la riga del commander dalla lista (resta nel campo dedicato)
      const lines = (res.decklist || '').split('\n')
      const rest = res.commander
        ? lines.filter(l => l.trim().toLowerCase() !== `1 ${res.commander.toLowerCase()}`)
        : lines
      setEditText(rest.join('\n').trim())
      setDetectedColors(null)
      setImportUrl('')
    } catch (e) {
      setErrors([e?.error || 'Errore durante l\'import'])
    } finally {
      setImporting(false)
    }
  }

  const toggleCard = (card) => setSelectedCard(prev => prev?.name === card.name ? null : card)
  const totalCount = hasList ? parseDecklist(decklist).totalCount : 0

  return (
    <>
      <button
        style={{ ...btnSecondary, color: hasList ? t.primary : t.textSub, borderColor: hasList ? t.primaryBorder : t.border }}
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        {open ? 'Chiudi' : hasList ? 'Lista ✓' : 'Lista'}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>

          {/* ── VIEWER ── */}
          {mode === 'view' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: t.textSub }}>{totalCount} carte</div>
                <button style={btnSecondary} onClick={enterEditMode}>Modifica mazzo</button>
              </div>

              {loadingCards ? (
                <div style={{ fontSize: 13, color: t.textSub, padding: '0.5rem 0' }}>Caricamento carte...</div>
              ) : (
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220, maxHeight: 480, overflowY: 'auto', borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.bgSurface }}>
                    {cards.map((card, i) => {
                      const active = selectedCard?.name === card.name
                      return (
                        <div
                          key={i}
                          onClick={() => toggleCard(card)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 12px', cursor: 'pointer',
                            background: active ? t.primaryBg : i % 2 === 0 ? t.bgSurface : t.bgMuted,
                            borderBottom: `0.5px solid ${t.border}`,
                            userSelect: 'none'
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, minWidth: 26, textAlign: 'right' }}>{card.count}×</span>
                          <span style={{ fontSize: 14, color: active ? t.primary : t.text, fontWeight: active ? 500 : 400 }}>{card.name}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ flexShrink: 0, width: 200 }}>
                    {selectedCard ? (
                      selectedCard.imageUri
                        ? <img src={selectedCard.imageUri} alt={selectedCard.name} style={{ width: 200, borderRadius: 12, display: 'block', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }} />
                        : <div style={{ width: 200, height: 279, background: t.bgMuted, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: t.textSub, textAlign: 'center', padding: 12 }}>{selectedCard.name}</div>
                    ) : (
                      <div style={{ width: 200, height: 279, border: `2px dashed ${t.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: t.textMuted, textAlign: 'center', padding: 12 }}>
                        Clicca su una carta per vedere l'immagine
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── EDITOR ── */}
          {mode === 'edit' && (
            <>
              {/* Nome mazzo */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4, fontWeight: 500 }}>Nome mazzo</div>
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Nome mazzo"
                  style={inputSt}
                />
              </div>

              {/* Import da URL */}
              <div style={{ marginBottom: 12, padding: '10px 12px', background: t.bgMuted, borderRadius: 10, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 6, fontWeight: 500 }}>Importa da Archidekt o Moxfield</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    placeholder="https://archidekt.com/decks/... oppure moxfield.com/decks/..."
                    style={{ ...inputSt, flex: 1 }}
                  />
                  <button type="button" style={{ ...btnPrimary, padding: '8px 16px', whiteSpace: 'nowrap' }} onClick={doImport} disabled={importing}>
                    {importing ? 'Import...' : 'Importa'}
                  </button>
                </div>
              </div>

              {/* Campo commander */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: t.textSub, fontWeight: 500 }}>Commander</span>
                  {detectingColors && (
                    <span style={{ fontSize: 11, color: t.primary }}>rilevamento colori...</span>
                  )}
                  {!detectingColors && detectedColors !== null && (
                    <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {detectedColors.length === 0
                        ? <span style={{ fontSize: 11, color: t.textMuted }}>Incolore</span>
                        : detectedColors.map(c => (
                            <span key={c} title={c} style={{
                              display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                              background: COLOR_MAP[c], border: '1px solid rgba(0,0,0,0.2)',
                              fontSize: 9, lineHeight: '14px', textAlign: 'center', fontWeight: 700, color: '#444'
                            }}>{c}</span>
                          ))
                      }
                    </span>
                  )}
                </div>
                <CommanderInput
                  value={commanderInput}
                  onChange={(name) => { setCommanderInput(name); setDetectedColors(null) }}
                  onBlur={handleCommanderBlur}
                  placeholder="es. Atraxa, Praetors' Voice"
                  style={inputSt}
                />
              </div>

              {/* 99 carte rimanenti */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>
                  99 carte rimanenti · formato "1 Nome Carta"
                </div>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  placeholder={'1 Sol Ring\n1 Command Tower\n...'}
                  rows={12}
                  style={{ ...inputSt, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>

              {errors.length > 0 && (
                <div style={{ marginBottom: 8, padding: '8px 12px', background: t.dangerBg, borderRadius: 8, border: `0.5px solid ${t.dangerBorder}` }}>
                  {errors.map((err, i) => <div key={i} style={{ color: t.danger, fontSize: 13 }}>{err}</div>)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnPrimary} onClick={save} disabled={saving}>
                  {saving ? 'Validazione in corso...' : 'Salva lista'}
                </button>
                <button style={btnSecondary} onClick={cancel}>Annulla</button>
              </div>
            </>
          )}

        </div>
      )}
    </>
  )
}
