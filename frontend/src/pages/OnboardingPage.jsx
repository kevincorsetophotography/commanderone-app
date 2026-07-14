import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useTheme } from '../hooks/useTheme'

export default function OnboardingPage() {
  const { logout } = useAuth()
  const { createGroup, joinGroup } = useGroup()
  const { t, dark } = useTheme()
  const [mode, setMode] = useState('create')
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
      if (mode === 'create') await createGroup(name.trim())
      else await joinGroup(inviteCode.trim())
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
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 'clamp(2rem, 10vh, 5rem)', paddingBottom: '2rem', paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box' }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="ct-fade-up">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Benvenuto!</div>
          <div style={{ fontSize: 13, color: t.textSub }}>
            Crea il tuo gruppo di gioco o unisciti a uno esistente con un codice invito
          </div>
        </div>

        <div style={{
          background: t.bgSurface,
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          border: `1px solid ${t.border}`,
          borderRadius: 20,
          padding: '1.5rem',
          width: '100%',
          boxSizing: 'border-box',
          color: t.text,
          boxShadow: t.shadow,
        }}>
          <div style={{ display: 'flex', gap: 6, background: t.bgMuted, borderRadius: 12, padding: 4, marginBottom: 20 }}>
            <div style={tabStyle(mode === 'create')} onClick={() => { setMode('create'); setError('') }}>Crea gruppo</div>
            <div style={tabStyle(mode === 'join')} onClick={() => { setMode('join'); setError('') }}>Unisciti</div>
          </div>

          <form onSubmit={submit}>
            {mode === 'create' ? (
              <div style={{ marginBottom: 18 }}>
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
              <div style={{ marginBottom: 18 }}>
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

        <div
          onClick={logout}
          style={{ marginTop: 20, fontSize: 13, color: t.textSub, cursor: 'pointer' }}
        >
          Esci
        </div>

        <div style={{ marginTop: 22, fontSize: 10, color: t.textMuted, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>
          CommanderOne è Fan Content non ufficiale, permesso dalla Fan Content Policy di Wizards of the Coast. Non approvato/sostenuto da Wizards.
        </div>
      </div>
    </div>
  )
}
