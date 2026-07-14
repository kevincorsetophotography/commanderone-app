import { useState, useRef, useEffect } from 'react'
import { autocompleteCardName } from '../lib/scryfall'
import { useTheme } from '../hooks/useTheme'

/**
 * Input con autocomplete dei nomi carta da Scryfall.
 * props: value, onChange(name), placeholder, style, onBlur
 */
export default function CommanderInput({ value, onChange, placeholder, style, onBlur }) {
  const { t } = useTheme()
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const debounceRef = useRef(null)
  const boxRef = useRef(null)

  // Chiudi cliccando fuori
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleChange = (text) => {
    onChange(text)
    setHighlight(-1)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const results = await autocompleteCardName(text)
      setSuggestions(results)
      setOpen(results.length > 0)
    }, 220)
  }

  const pick = (name) => {
    onChange(name)
    setOpen(false)
    setSuggestions([])
    setHighlight(-1)
  }

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); pick(suggestions[highlight]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const inputStyle = style || {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14,
    background: t.inputBg, color: t.text, outline: 'none',
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        onBlur={onBlur}
        style={inputStyle}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: t.bgSurface,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          boxShadow: t.shadow,
          maxHeight: 240, overflowY: 'auto',
        }}>
          {suggestions.map((name, i) => (
            <div
              key={name}
              onMouseDown={(e) => { e.preventDefault(); pick(name) }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                color: i === highlight ? t.primary : t.text,
                background: i === highlight ? t.primaryBg : 'transparent',
                borderBottom: i < suggestions.length - 1 ? `0.5px solid ${t.border}` : 'none',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
