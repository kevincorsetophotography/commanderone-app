import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

// Impostazioni account: email + stato verifica, cambio password, logout.
export default function AccountPage() {
  const { logout, updateToken } = useAuth()
  const { t } = useTheme()
  const [me, setMe] = useState(null)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const [resendState, setResendState] = useState('') // '' | sending | sent | error

  useEffect(() => {
    api.me().then(setMe).catch(() => {})
  }, [])

  const card = {
    background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 16,
    padding: '1.25rem', marginBottom: 16, boxSizing: 'border-box',
  }
  const inputStyle = {
    width: '100%', padding: '11px 13px', borderRadius: 11,
    border: `1px solid ${t.border}`, fontSize: 14, boxSizing: 'border-box',
    background: t.inputBg, color: t.text, outline: 'none', marginBottom: 10,
  }
  const label = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.textMuted, textTransform: 'uppercase', marginBottom: 8 }

  const changePw = async (e) => {
    e.preventDefault()
    setPwError(''); setPwOk(false)
    if (next !== confirm) { setPwError('Le nuove password non coincidono'); return }
    setPwLoading(true)
    try {
      const res = await api.changePassword(current, next)
      // Il cambio invalida i vecchi JWT: adottiamo quello nuovo per restare loggati
      updateToken(res.token)
      setPwOk(true)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setPwError(err.error || 'Errore di connessione')
    } finally {
      setPwLoading(false)
    }
  }

  const resend = async () => {
    setResendState('sending')
    try {
      await api.resendVerification()
      setResendState('sent')
    } catch {
      setResendState('error')
    }
  }

  return (
    <div className="ct-fade-up" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Account</h2>

      <div style={card}>
        <div style={label}>Profilo</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{me?.username || '…'}</div>
        <div style={{ fontSize: 13, color: t.textSub, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{me?.email || 'Nessuna email associata'}</span>
          {me?.email && (me.emailVerifiedAt ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: t.win, background: t.winBg, padding: '2px 8px', borderRadius: 999 }}>✓ verificata</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: t.danger, background: t.dangerBg || 'transparent', padding: '2px 8px', borderRadius: 999, border: `1px solid ${t.border}` }}>da verificare</span>
          ))}
        </div>
        {me?.email && !me.emailVerifiedAt && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {resendState === 'sent' ? (
              <span style={{ color: t.textSub }}>📬 Email inviata, controlla la casella (anche lo spam).</span>
            ) : resendState === 'error' ? (
              <span style={{ color: t.danger }}>Invio fallito, riprova più tardi.</span>
            ) : (
              <button onClick={resend} disabled={resendState === 'sending'} style={{
                padding: '8px 14px', borderRadius: 10, border: `1px solid ${t.border}`,
                background: t.bgSurfaceAlt, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {resendState === 'sending' ? 'Invio…' : 'Rimanda email di verifica'}
              </button>
            )}
          </div>
        )}
        {me?.createdAt && (
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 10 }}>
            Membro dal {new Date(me.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={label}>Cambia password</div>
        <form onSubmit={changePw}>
          <input type="password" placeholder="Password attuale" value={current}
            onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" style={inputStyle} />
          <input type="password" placeholder="Nuova password (min 8 caratteri)" value={next}
            onChange={e => setNext(e.target.value)} required autoComplete="new-password" style={inputStyle} />
          <input type="password" placeholder="Ripeti la nuova password" value={confirm}
            onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={inputStyle} />
          {pwError && <div style={{ color: t.danger, fontSize: 13, marginBottom: 10 }}>{pwError}</div>}
          {pwOk && <div style={{ color: t.win, fontSize: 13, marginBottom: 10 }}>✓ Password aggiornata. Le altre sessioni sono state disconnesse.</div>}
          <button type="submit" disabled={pwLoading} style={{
            padding: '10px 18px', background: t.primary, color: t.primaryFg, border: 'none',
            borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: pwLoading ? 0.7 : 1,
          }}>
            {pwLoading ? '...' : 'Aggiorna password'}
          </button>
        </form>
      </div>

      <div style={card}>
        <div style={label}>Sessione</div>
        <button onClick={logout} style={{
          padding: '10px 18px', borderRadius: 11, border: `1px solid ${t.border}`,
          background: t.bgSurfaceAlt, color: t.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          Esci dall'account
        </button>
      </div>
    </div>
  )
}
