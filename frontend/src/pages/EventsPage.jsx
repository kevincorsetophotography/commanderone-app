import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useFeedback } from '../hooks/useFeedback'
import EmptyState from '../components/EmptyState'

const pad = (n) => String(n).padStart(2, '0')

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000)

function countdown(startsAt, tr) {
  const d = dayDiff(startsAt, new Date())
  if (d === 0) return tr('feed.today')
  if (d === 1) return tr('gioca.tomorrow')
  if (d === -1) return tr('feed.yesterday')
  if (d > 1 && d <= 21) return tr('gioca.inDays', { count: d })
  if (d < -1 && d >= -21) return tr('eventsPage.daysAgo', { count: -d })
  return null
}

function isPast(ev) {
  const now = Date.now()
  const eventDate = new Date(ev.startsAt)
  // Giorno dell'evento in Europe/Rome
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(eventDate)
  const y = +parts.find(p => p.type === 'year').value
  const mo = +parts.find(p => p.type === 'month').value
  const d = +parts.find(p => p.type === 'day').value
  // Probe: giorno+1 alle 05:00 UTC, poi aggiusta per l'offset di Roma
  const probe = new Date(Date.UTC(y, mo - 1, d + 1, 5, 0, 0))
  const romeHour = +new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome', hour: 'numeric', hour12: false,
  }).format(probe)
  const deadline = probe.getTime() - (romeHour - 5) * 3600000
  return deadline < now
}

const EMPTY = { title: '', date: '', time: '', location: '', description: '', format: '', bestOf: '1' }

export default function EventsPage() {
  const { t } = useTheme()
  const { t: tr, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'it-IT'
  const { user } = useAuth()
  const { activeGroup } = useGroup()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const isAdmin = activeGroup?.role === 'ADMIN'

  const FORMAT_BADGE = {
    multiplayer: { label: '🎴 Multiplayer', color: '#5FB87A' },
    '1v1': { label: '⚔️ 1v1', color: '#E8654F' },
  }

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [searchParams] = useSearchParams()
  const focusId = Number(searchParams.get('focus')) || null
  const [highlightId, setHighlightId] = useState(null)

  // Da notifica evento (?focus=ID): scrolla e evidenzia l'evento
  useEffect(() => {
    if (!focusId || loading || events.length === 0) return
    const el = document.getElementById(`evento-${focusId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(focusId)
      const tm = setTimeout(() => setHighlightId(null), 2600)
      return () => clearTimeout(tm)
    }
  }, [focusId, loading, events])

  const load = async () => {
    try { setEvents(await api.getEvents()) }
    catch { toast(tr('eventsPage.loadError'), 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const { upcoming, past } = useMemo(() => {
    const up = [], pa = []
    for (const ev of events) (isPast(ev) ? pa : up).push(ev)
    up.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    pa.sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
    return { upcoming: up, past: pa }
  }, [events])

  const resetForm = () => { setForm(EMPTY); setEditingId(null); setFormError(''); setShowForm(false) }

  const startCreate = () => { setForm(EMPTY); setEditingId(null); setFormError(''); setShowForm(true) }

  const startEdit = (ev) => {
    const d = new Date(ev.startsAt)
    setForm({
      title: ev.title,
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: ev.allDay ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      location: ev.location || '',
      description: ev.description || '',
      format: ev.format || '',
      bestOf: String(ev.bestOf || 1),
    })
    setEditingId(ev.id)
    setFormError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setFormError(tr('eventsPage.titleRequired')); return }
    if (!form.date) { setFormError(tr('eventsPage.dateRequired')); return }
    const allDay = !form.time
    const startsAt = new Date(`${form.date}T${form.time || '00:00'}`).toISOString()
    const payload = {
      title: form.title.trim(),
      startsAt,
      allDay,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      format: form.format || null,
      bestOf: form.format === '1v1' ? Number(form.bestOf) : null,
    }
    setSaving(true); setFormError('')
    try {
      if (editingId) { await api.updateEvent(editingId, payload); toast(tr('eventsPage.updated'), 'success') }
      else { await api.createEvent(payload); toast(tr('eventsPage.created'), 'success') }
      resetForm()
      await load()
    } catch (err) {
      setFormError(err.error || tr('eventsPage.saveError'))
    } finally { setSaving(false) }
  }

  const removeEvent = async (ev) => {
    const ok = await confirm({ title: tr('eventsPage.confirmDeleteTitle'), message: tr('eventsPage.confirmDeleteMessage', { title: ev.title }), confirmLabel: tr('common.delete'), danger: true })
    if (!ok) return
    try { await api.deleteEvent(ev.id); await load(); toast(tr('eventsPage.deleted'), 'success') }
    catch (err) { toast(err.error || tr('eventsPage.deleteError'), 'error') }
  }

  const toggleRsvp = async (ev) => {
    try {
      const { rsvps } = await api.toggleRsvp(ev.id)
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, rsvps } : e))
    } catch (err) {
      toast(err.error || tr('eventsPage.rsvpError'), 'error')
    }
  }

  // ── stili ──
  const glass = { background: t.bgSurface, border: `1px solid ${t.border}`, boxShadow: t.shadow }
  const inputSt = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text }
  const btnPrimary = { padding: '9px 20px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
  const btnGhost = { padding: '9px 16px', background: 'transparent', color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }
  const btnSmall = { padding: '5px 12px', background: t.bgMuted, color: t.textSub, border: `0.5px solid ${t.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }
  const btnDanger = { padding: '5px 12px', background: t.dangerBg, color: t.danger, border: `0.5px solid ${t.dangerBorder}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }

  const renderEvent = (ev, faded = false, idx = 0) => {
    const d = new Date(ev.startsAt)
    const cd = countdown(ev.startsAt, tr)
    const going = ev.rsvps?.some(r => r.userId === user?.id)
    const n = ev.rsvps?.length || 0
    const names = (ev.rsvps || []).map(r => r.user?.username).filter(Boolean)
    const dateLine = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
    const time = ev.allDay ? null : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    const monthAbbr = d.toLocaleDateString(locale, { month: 'short' }).replace('.', '')

    return (
      <div key={ev.id} id={`evento-${ev.id}`} className="ct-fade-up" style={{
        ...glass, borderRadius: 16, padding: '1rem 1.1rem', marginBottom: 12, opacity: faded ? 0.62 : 1,
        animationDelay: `${Math.min(idx, 5) * 60}ms`,
        outline: highlightId === ev.id ? `2px solid ${t.primary}` : 'none',
        boxShadow: highlightId === ev.id ? `0 0 0 4px ${t.primaryBg}` : (glass.boxShadow || 'none'),
        transition: 'outline 0.3s, box-shadow 0.3s',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Badge data */}
          <div style={{ flexShrink: 0, width: 58, textAlign: 'center', background: t.bgMuted, borderRadius: 12, padding: '8px 0', border: `0.5px solid ${t.border}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: faded ? t.textSub : t.primary, lineHeight: 1 }}>{d.getDate()}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', marginTop: 2 }}>{monthAbbr}</div>
          </div>

          {/* Corpo */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                onClick={() => navigate(`/evento/${ev.id}`)}
                title={tr('eventsPage.openEvent')}
                style={{ fontSize: 16, fontWeight: 700, color: t.text, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                {ev.title}<span style={{ color: t.primary }}>›</span>
              </span>
              {ev.format && FORMAT_BADGE[ev.format] && (
                <span style={{ fontSize: 11, fontWeight: 700, color: FORMAT_BADGE[ev.format].color, background: FORMAT_BADGE[ev.format].color + '22', border: `1px solid ${FORMAT_BADGE[ev.format].color}55`, padding: '2px 8px', borderRadius: 20 }}>
                  {FORMAT_BADGE[ev.format].label}{ev.format === '1v1' && ev.bestOf ? ` · Bo${ev.bestOf}` : ''}
                </span>
              )}
              {cd && !faded && (
                <span style={{ fontSize: 11, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, padding: '2px 8px', borderRadius: 20 }}>{cd}</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: t.textSub, marginTop: 3, textTransform: 'capitalize' }}>
              {dateLine}{time ? ` · ${time}` : ''}{ev.location ? <span style={{ textTransform: 'none' }}> · 📍 {ev.location}</span> : ''}
            </div>
            {ev.description && (
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ev.description}</div>
            )}

            {/* Adesioni */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => toggleRsvp(ev)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${going ? t.primary : t.border}`,
                  background: going ? t.primary : 'transparent',
                  color: going ? t.primaryFg : t.textSub,
                }}
              >
                {going ? tr('eventsPage.going') : tr('eventsPage.rsvpCta')}
              </button>
              <span style={{ fontSize: 12, color: t.textMuted }} title={names.join(', ')}>
                {n === 0 ? tr('eventsPage.noParticipants') : `${tr('eventsPage.participantsCount', { count: n })}${names.length ? ': ' + names.join(', ') : ''}`}
              </span>

              {isAdmin && (
                <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <button style={btnSmall} onClick={() => startEdit(ev)}>{tr('common.edit')}</button>
                  <button style={btnDanger} onClick={() => removeEvent(ev)}>{tr('common.delete')}</button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: t.text }}>{tr('eventsPage.title')}</div>
        {isAdmin && (
          <button style={btnPrimary} onClick={startCreate}>{tr('eventsPage.newEvent')}</button>
        )}
      </div>

      {/* Modal form admin (crea / modifica) */}
      {isAdmin && showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) resetForm() }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div className="ct-modal-in" style={{ ...glass, borderRadius: 18, padding: '1.35rem 1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{editingId ? tr('eventsPage.editEventTitle') : tr('eventsPage.newEventTitle')}</div>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: t.textMuted, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
            <form onSubmit={submit}>
              <input style={{ ...inputSt, marginBottom: 10 }} placeholder={tr('eventsPage.titlePlaceholder')} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={120} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 4 }}>{tr('eventsPage.dateLabel')}</label>
                  <input type="date" style={inputSt} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 4 }}>{tr('eventsPage.timeLabel')}</label>
                  <input type="time" style={inputSt} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <input style={{ ...inputSt, marginBottom: 10 }} placeholder={tr('eventsPage.locationPlaceholder')} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} maxLength={160} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 4 }}>{tr('eventsPage.formatLabel')}</label>
                  <select style={inputSt} value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                    <option value="">{tr('eventsPage.formatNone')}</option>
                    <option value="multiplayer">{tr('eventsPage.formatMultiplayer')}</option>
                    <option value="1v1">{tr('eventsPage.format1v1')}</option>
                  </select>
                </div>
                {form.format === '1v1' && (
                  <div>
                    <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 4 }}>{tr('eventsPage.matchLabel')}</label>
                    <select style={inputSt} value={form.bestOf} onChange={e => setForm(f => ({ ...f, bestOf: e.target.value }))}>
                      <option value="1">Best of 1</option>
                      <option value="3">Best of 3</option>
                    </select>
                  </div>
                )}
              </div>
              <textarea style={{ ...inputSt, marginBottom: 12, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} placeholder={tr('eventsPage.descriptionPlaceholder')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={2000} />
              {formError && <div style={{ color: t.danger, fontSize: 13, marginBottom: 10 }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={btnPrimary} disabled={saving}>{editingId ? tr('eventsPage.saveChanges') : tr('eventsPage.create')}</button>
                <button type="button" style={btnGhost} onClick={resetForm}>{tr('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 14, color: t.textSub }}>{tr('common.loading')}</div>
      ) : events.length === 0 ? (
        <EmptyState icon="📅" title={tr('eventsPage.emptyTitle')} message={isAdmin ? tr('eventsPage.emptyAdminMessage') : tr('eventsPage.emptyMemberMessage')} />
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 0 10px' }}>{tr('eventsPage.upcoming')}</div>
              {upcoming.map((ev, i) => renderEvent(ev, false, i))}
            </>
          )}
          {past.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '18px 0 10px' }}>{tr('eventsPage.past')}</div>
              {past.map((ev, i) => renderEvent(ev, true, i))}
            </>
          )}
        </>
      )}
    </div>
  )
}
