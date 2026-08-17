import { useState } from 'react'
import { useGroup } from '../hooks/useGroup'
import { useTheme } from '../hooks/useTheme'

// Form crea/unisciti a un gruppo, riusato sia nell'onboarding (primo gruppo,
// vedi OnboardingPage) sia dalla pagina Account per aggiungerne altri: un
// utente può far parte di più gruppi indipendenti (vedi useGroup/GroupSwitcher).
export default function GroupJoinCreateForm({ onSuccess, initialMode = 'create' }) {
  const { createGroup, joinGroup } = useGroup()
  const { t } = useTheme()
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusField, setFocusField] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const group = mode === 'create' ? await createGroup(name.trim()) : await joinGroup(inviteCode.trim())
      setName(''); setInviteCode('')
      onSuccess?.(group)
    } catch (err) {
      setError(err.error || 'Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field) => ({
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: `1px solid ${focusField === field ? t.primaryBorder : t.border}`,
    fontSize: 14, boxSizing: 'border-box',
    background: t.inputBg, color: t.text, outline: 'none',
    boxShadow: focusField === field ? t.glow : 'none',
    transition: 'all 0.18s ease',
  })

  const tabStyle = (active) => ({
    flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 10, cursor: 'pointer',
    fontSize: 13, fontWeight: 700, letterSpacing: '0.01em',
    background: active ? t.primary : 'transparent',
    color: active ? t.primaryFg : t.textSub,
    transition: 'all 0.18s ease',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, background: t.bgMuted, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        <div style={tabStyle(mode === 'create')} onClick={() => { setMode('create'); setError('') }}>Crea gruppo</div>
        <div style={tabStyle(mode === 'join')} onClick={() => { setMode('join'); setError('') }}>Unisciti</div>
      </div>

      <form onSubmit={submit}>
        {mode === 'create' ? (
          <div style={{ marginBottom: 14 }}>
            <input
              type="text" placeholder="Nome del gruppo (es. Amici del venerdì)" value={name}
              onChange={e => setName(e.target.value)} required maxLength={60}
              onFocus={() => setFocusField('name')} onBlur={() => setFocusField('')}
              style={inputStyle('name')}
            />
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
              Diventerai l'amministratore di questo gruppo
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <input
              type="text" placeholder="Codice invito" value={inviteCode}
              onChange={e => setInviteCode(e.target.value)} required
              onFocus={() => setFocusField('invite')} onBlur={() => setFocusField('')}
              style={{ ...inputStyle('invite'), textTransform: 'uppercase' }}
            />
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
              Chiedi il codice a un membro del gruppo che vuoi raggiungere
            </div>
          </div>
        )}
        {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '12px', background: t.primary, color: t.primaryFg,
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: t.glow, transition: 'all 0.18s ease', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : mode === 'create' ? 'Crea gruppo' : 'Unisciti al gruppo'}
        </button>
      </form>
    </div>
  )
}
