import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useTheme } from '../hooks/useTheme'
import GroupJoinCreateForm from '../components/GroupJoinCreateForm'
import { KOFI_URL } from '../lib/links'
import { translateApiError } from '../lib/apiError'

const LANGUAGES = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
]

// Impostazioni account: email + stato verifica, cambio password, gruppi, logout.
export default function AccountPage() {
  const { logout, updateToken } = useAuth()
  const { groups, activeGroup, selectGroup } = useGroup()
  const { t } = useTheme()
  const { t: tr, i18n } = useTranslation()
  const [me, setMe] = useState(null)
  const [addingGroup, setAddingGroup] = useState(false)
  const [joinedMsg, setJoinedMsg] = useState('')

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const [resendState, setResendState] = useState('') // '' | sending | sent | error

  const [showDelete, setShowDelete] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

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
    if (next !== confirm) { setPwError(tr('account.password.mismatch')); return }
    setPwLoading(true)
    try {
      const res = await api.changePassword(current, next)
      // Il cambio invalida i vecchi JWT: adottiamo quello nuovo per restare loggati
      updateToken(res.token)
      setPwOk(true)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setPwError(translateApiError(err, tr))
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

  const deleteAccount = async (e) => {
    e.preventDefault()
    setDeleteError('')
    setDeleteLoading(true)
    try {
      await api.deleteAccount(deletePw)
      logout()
    } catch (err) {
      setDeleteError(translateApiError(err, tr))
      setDeleteLoading(false)
    }
  }

  const dateLocale = i18n.language === 'en' ? 'en-US' : 'it-IT'

  return (
    <div className="ct-fade-up" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>{tr('account.title')}</h2>

      <div style={card}>
        <div style={label}>{tr('account.profile.label')}</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{me?.username || '…'}</div>
        <div style={{ fontSize: 13, color: t.textSub, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{me?.email || tr('account.profile.noEmail')}</span>
          {me?.email && (me.emailVerifiedAt ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: t.win, background: t.winBg, padding: '2px 8px', borderRadius: 999 }}>✓ {tr('account.profile.verified')}</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: t.danger, background: t.dangerBg || 'transparent', padding: '2px 8px', borderRadius: 999, border: `1px solid ${t.border}` }}>{tr('account.profile.unverified')}</span>
          ))}
        </div>
        {me?.email && !me.emailVerifiedAt && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {resendState === 'sent' ? (
              <span style={{ color: t.textSub }}>{tr('account.profile.emailSent')}</span>
            ) : resendState === 'error' ? (
              <span style={{ color: t.danger }}>{tr('account.profile.sendFailed')}</span>
            ) : (
              <button onClick={resend} disabled={resendState === 'sending'} style={{
                padding: '8px 14px', borderRadius: 10, border: `1px solid ${t.border}`,
                background: t.bgSurfaceAlt, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {resendState === 'sending' ? tr('account.profile.resending') : tr('account.profile.resend')}
              </button>
            )}
          </div>
        )}
        {me?.createdAt && (
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 10 }}>
            {tr('account.profile.memberSince', { date: new Date(me.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={label}>{tr('account.language.label')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              style={{
                padding: '8px 16px', borderRadius: 10,
                border: `1px solid ${i18n.language === lang.code ? t.primary : t.border}`,
                background: i18n.language === lang.code ? t.primaryBg : t.bgSurfaceAlt,
                color: i18n.language === lang.code ? t.primary : t.text,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={label}>{tr('account.groups.label')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: addingGroup ? 16 : 0 }}>
          {(groups || []).map(g => {
            const isActive = g.slug === activeGroup?.slug
            return (
              <div key={g.slug} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '10px 12px', borderRadius: 12,
                border: `1px solid ${isActive ? t.primaryBorder : t.border}`,
                background: isActive ? t.primaryBg : t.bgSurfaceAlt,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{g.role === 'ADMIN' ? tr('account.groups.admin') : tr('account.groups.player')}</div>
                </div>
                {isActive ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.primary, flexShrink: 0 }}>{tr('account.groups.active')}</span>
                ) : (
                  <button onClick={() => selectGroup(g.slug)} style={{
                    padding: '6px 12px', borderRadius: 9, border: `1px solid ${t.border}`,
                    background: t.bgSurface, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}>
                    {tr('account.groups.switchTo')}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {joinedMsg && <div style={{ color: t.win, fontSize: 13, marginTop: 12 }}>✓ {joinedMsg}</div>}

        {addingGroup ? (
          <div style={{ marginTop: 16 }}>
            <GroupJoinCreateForm
              initialMode="join"
              onSuccess={(group) => {
                setAddingGroup(false)
                setJoinedMsg(tr('account.groups.joinedMessage', { name: group.name }))
              }}
            />
            <div
              onClick={() => setAddingGroup(false)}
              style={{ marginTop: 10, fontSize: 12, color: t.textSub, cursor: 'pointer', textAlign: 'center' }}
            >
              {tr('account.groups.cancel')}
            </div>
          </div>
        ) : (
          <button onClick={() => { setAddingGroup(true); setJoinedMsg('') }} style={{
            marginTop: 12, width: '100%', padding: '10px 14px', borderRadius: 11,
            border: `1px dashed ${t.border}`, background: 'transparent', color: t.textSub,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {tr('account.groups.addAnother')}
          </button>
        )}
      </div>

      <div style={card}>
        <div style={label}>{tr('account.password.label')}</div>
        <form onSubmit={changePw}>
          <input type="password" placeholder={tr('account.password.current')} value={current}
            onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" style={inputStyle} />
          <input type="password" placeholder={tr('account.password.new')} value={next}
            onChange={e => setNext(e.target.value)} required autoComplete="new-password" style={inputStyle} />
          <input type="password" placeholder={tr('account.password.confirm')} value={confirm}
            onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={inputStyle} />
          {pwError && <div style={{ color: t.danger, fontSize: 13, marginBottom: 10 }}>{pwError}</div>}
          {pwOk && <div style={{ color: t.win, fontSize: 13, marginBottom: 10 }}>{tr('account.password.success')}</div>}
          <button type="submit" disabled={pwLoading} style={{
            padding: '10px 18px', background: t.primary, color: t.primaryFg, border: 'none',
            borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: pwLoading ? 0.7 : 1,
          }}>
            {pwLoading ? '...' : tr('account.password.submit')}
          </button>
        </form>
      </div>

      <div style={card}>
        <div style={label}>{tr('account.session.label')}</div>
        <button onClick={logout} style={{
          padding: '10px 18px', borderRadius: 11, border: `1px solid ${t.border}`,
          background: t.bgSurfaceAlt, color: t.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          {tr('account.session.logout')}
        </button>
      </div>

      <div style={card}>
        <div style={label}>{tr('account.support.label')}</div>
        <div style={{ fontSize: 13, color: t.textSub, marginBottom: 12, lineHeight: 1.5 }}>
          {tr('account.support.body')}
        </div>
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', padding: '10px 18px', borderRadius: 11,
          background: t.accent, color: '#1a1206', fontSize: 14, fontWeight: 700,
          textDecoration: 'none',
        }}>
          {tr('account.support.cta')}
        </a>
      </div>

      <div style={{ ...card, border: `1px solid ${t.dangerBorder || t.danger}` }}>
        <div style={{ ...label, color: t.danger }}>{tr('account.danger.label')}</div>
        {!showDelete ? (
          <>
            <div style={{ fontSize: 13, color: t.textSub, marginBottom: 12, lineHeight: 1.5 }}>
              {tr('account.danger.body')}
            </div>
            <button onClick={() => setShowDelete(true)} style={{
              padding: '10px 18px', borderRadius: 11, border: `1px solid ${t.dangerBorder || t.danger}`,
              background: 'transparent', color: t.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              {tr('account.danger.cta')}
            </button>
          </>
        ) : (
          <form onSubmit={deleteAccount}>
            <div style={{ fontSize: 13, color: t.danger, marginBottom: 12, lineHeight: 1.5, fontWeight: 600 }}>
              {tr('account.danger.confirmBody')}
            </div>
            <input type="password" placeholder={tr('account.danger.confirmPassword')} value={deletePw}
              onChange={e => setDeletePw(e.target.value)} required autoComplete="current-password" style={inputStyle} />
            {deleteError && <div style={{ color: t.danger, fontSize: 13, marginBottom: 10 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={deleteLoading} style={{
                padding: '10px 18px', background: t.danger, color: '#fff', border: 'none',
                borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: deleteLoading ? 0.7 : 1,
              }}>
                {deleteLoading ? '...' : tr('account.danger.confirmSubmit')}
              </button>
              <button type="button" onClick={() => { setShowDelete(false); setDeletePw(''); setDeleteError('') }} style={{
                padding: '10px 18px', borderRadius: 11, border: `1px solid ${t.border}`,
                background: 'transparent', color: t.textSub, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                {tr('account.danger.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
