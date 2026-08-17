import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

// Pagina pubblica doppia:
// - senza ?token → chiedi l'email per ricevere il link di reset
// - con ?token   → imposta la nuova password
export default function ResetPasswordPage() {
  const { t, dark } = useTheme()
  const { adoptSession } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: `1px solid ${t.border}`, fontSize: 14, boxSizing: 'border-box',
    background: t.inputBg, color: t.text, outline: 'none',
  }

  const submitRequest = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await api.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.error || 'Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Le password non coincidono'); return }
    setLoading(true)
    try {
      const res = await api.resetPassword(token, password)
      // Il backend apre direttamente una nuova sessione
      adoptSession(res.token, res.user)
      navigate('/')
    } catch (err) {
      setError(err.error || 'Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'clamp(2rem, 12vh, 6rem)', paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box' }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }} className="ct-fade-up">
        <div style={{
          background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 20,
          padding: '2rem', color: t.text, boxShadow: t.shadow, boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {token ? 'Nuova password' : 'Recupera password'}
          </div>
          <div style={{ fontSize: 13, color: t.textSub, marginBottom: 20 }}>
            {token
              ? 'Scegli la nuova password per il tuo account.'
              : 'Inserisci la tua email: ti mandiamo un link per reimpostare la password.'}
          </div>

          {!token && sent ? (
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              📬 Se l'indirizzo è associato a un account, riceverai un'email con il link di reset entro pochi minuti. Controlla anche lo spam.
            </div>
          ) : token ? (
            <form onSubmit={submitReset}>
              <div style={{ marginBottom: 12 }}>
                <input type="password" placeholder="Nuova password (min 8 caratteri)" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="new-password" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <input type="password" placeholder="Ripeti la nuova password" value={confirm}
                  onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={inputStyle} />
              </div>
              {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 12, background: t.primary, color: t.primaryFg, border: 'none',
                borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? '...' : 'Imposta password'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitRequest}>
              <div style={{ marginBottom: 18 }}>
                <input type="email" placeholder="Email" value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
              </div>
              {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 12, background: t.primary, color: t.primaryFg, border: 'none',
                borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? '...' : 'Invia link di reset'}
              </button>
            </form>
          )}

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13 }}>
            <Link to="/login" style={{ color: t.primary, textDecoration: 'none', fontWeight: 600 }}>← Torna al login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
