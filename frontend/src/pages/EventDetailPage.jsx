import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useFeedback } from '../hooks/useFeedback'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import PlayerAvatar from '../components/PlayerAvatar'

const FORMAT_BADGE = {
  multiplayer: { label: '🎴 Multiplayer', color: '#5FB87A' },
  '1v1': { label: '⚔️ 1v1', color: '#E8654F' },
}


export default function EventDetailPage() {
  const { id } = useParams()
  const eid = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()
  const { user } = useAuth()
  const { activeGroup } = useGroup()
  const { toast, confirm } = useFeedback()
  const isAdmin = activeGroup?.role === 'ADMIN'

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scores, setScores] = useState({}) // tableId -> { a, b }

  const load = () => {
    setLoading(true); setError('')
    api.getEvent(eid).then(setEvent).catch(e => setError(e.error || 'Evento non trovato')).finally(() => setLoading(false))
  }
  useEffect(load, [eid])

  const back = (
    <button onClick={() => navigate('/eventi')} style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>← Eventi</button>
  )

  if (loading) return (<div>{back}<Skeleton h={160} r={16} /></div>)
  if (error || !event) return (<div>{back}<EmptyState icon="🔍" title="Evento non trovato" message={error} /></div>)

  const going = event.rsvps?.some(r => r.userId === user?.id)
  const registrants = event.rsvps || []
  const round = event.rounds?.[event.rounds.length - 1] || null
  const badge = FORMAT_BADGE[event.format]

  const card = { background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: 14, boxShadow: t.shadow }
  const btnPrimary = { padding: '9px 18px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
  const btnGhost = { padding: '7px 14px', background: 'transparent', color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer' }

  const toggleRsvp = async () => {
    try { const { rsvps } = await api.toggleRsvp(eid); setEvent(ev => ({ ...ev, rsvps })) }
    catch (e) { toast(e.error || 'Errore adesione', 'error') }
  }
  const generateRound = async () => {
    setBusy(true)
    try { setEvent(await api.generateRound(eid)); toast('Turno generato', 'success') }
    catch (e) { toast(e.error || 'Errore', 'error') }
    finally { setBusy(false) }
  }
  const deleteRound = async (rid) => {
    const ok = await confirm({ title: 'Eliminare il turno?', message: 'Tavoli e abbinamenti verranno rifatti.', confirmLabel: 'Elimina', danger: true })
    if (!ok) return
    try { await api.deleteRound(eid, rid); load() } catch (e) { toast(e.error || 'Errore', 'error') }
  }
  const submitResult = async (tbl) => {
    const sc = scores[tbl.id] || { a: 0, b: 0 }
    try {
      setEvent(await api.submitTableResult(eid, tbl.id, { scoreA: sc.a, scoreB: sc.b }))
      toast('Risultato salvato', 'success')
    } catch (e) { toast(e.error || 'Errore', 'error') }
  }
  const setScore = (tableId, side, val) => setScores(s => ({ ...s, [tableId]: { ...(s[tableId] || { a: 0, b: 0 }), [side]: val } }))

  const dateLine = new Date(event.startsAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = event.allDay ? null : new Date(event.startsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  // Un tavolo (pod o pairing)
  const renderTable = (tbl) => {
    const mine = tbl.seats.some(s => s.user.id === user?.id)
    const isBye = tbl.seats.length === 1 && event.format === '1v1'
    const is1v1 = event.format === '1v1' && tbl.seats.length === 2
    return (
      <div key={tbl.id} style={{
        border: `1px solid ${mine ? t.primary : t.border}`, borderRadius: 12, padding: '10px 12px',
        background: mine ? (t.primaryBg || t.bgMuted) : t.bgMuted,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{isBye ? 'Bye' : (is1v1 ? `Match ${tbl.number}` : `Tavolo ${tbl.number}`)}</span>
          {mine && <span style={{ fontSize: 10.5, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, padding: '1px 7px', borderRadius: 20 }}>Il tuo {is1v1 ? 'match' : 'tavolo'}</span>}
          {tbl.done && <span style={{ fontSize: 11, color: t.win, marginLeft: 'auto' }}>✓ concluso</span>}
        </div>

        {isBye ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textSub }}>
            <PlayerAvatar username={tbl.seats[0].user.username} avatarCardName={tbl.seats[0].user.avatarCardName} avatarScryfallId={tbl.seats[0].user.avatarScryfallId} size={26} highlight={tbl.seats[0].user.id === user?.id} />
            {tbl.seats[0].user.username} · passa il turno
          </div>
        ) : is1v1 ? (() => {
          const sa = tbl.seats.find(s => s.seat === 0) || tbl.seats[0]
          const sb = tbl.seats.find(s => s.seat === 1) || tbl.seats[1]
          const canEnter = (isAdmin || mine) && !tbl.done
          const sc = scores[tbl.id] || { a: tbl.scoreA ?? 0, b: tbl.scoreB ?? 0 }
          const winA = tbl.done && tbl.winnerUserId === sa.user.id
          const winB = tbl.done && tbl.winnerUserId === sb.user.id
          const stepBtn = { width: 24, height: 24, borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.text, cursor: 'pointer', fontSize: 15, lineHeight: 1 }
          const player = (s, win) => (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: win ? 800 : 600, color: win ? t.win : (s.user.id === user?.id ? t.text : t.textSub) }}>
              <PlayerAvatar username={s.user.username} avatarCardName={s.user.avatarCardName} avatarScryfallId={s.user.avatarScryfallId} size={26} highlight={s.user.id === user?.id} />{s.user.username}{win ? ' 🏆' : ''}
            </span>
          )
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 14, flexWrap: 'wrap' }}>
                {player(sa, winA)}
                <span style={{ color: t.textMuted, fontWeight: 800, fontSize: 16 }}>
                  {tbl.done ? `${tbl.scoreA}–${tbl.scoreB}` : 'vs'}
                </span>
                {player(sb, winB)}
              </div>
              {tbl.done && tbl.isDraw && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>Pareggio</div>}
              {canEnter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button style={stepBtn} onClick={() => setScore(tbl.id, 'a', Math.max(0, sc.a - 1))}>−</button>
                    <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 800 }}>{sc.a}</span>
                    <button style={stepBtn} onClick={() => setScore(tbl.id, 'a', Math.min(event.bestOf || 1, sc.a + 1))}>+</button>
                    <span style={{ fontSize: 12, color: t.textMuted, margin: '0 4px' }}>—</span>
                    <button style={stepBtn} onClick={() => setScore(tbl.id, 'b', Math.max(0, sc.b - 1))}>−</button>
                    <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 800 }}>{sc.b}</span>
                    <button style={stepBtn} onClick={() => setScore(tbl.id, 'b', Math.min(event.bestOf || 1, sc.b + 1))}>+</button>
                  </span>
                  <button onClick={() => submitResult(tbl)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Salva risultato
                  </button>
                </div>
              )}
            </div>
          )
        })() : (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tbl.seats.map(s => (
                <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: s.user.id === user?.id ? t.text : t.textSub, background: t.bgSurface, border: `0.5px solid ${t.border}`, borderRadius: 20, padding: '3px 10px 3px 3px' }}>
                  <PlayerAvatar username={s.user.username} avatarCardName={s.user.avatarCardName} avatarScryfallId={s.user.avatarScryfallId} size={22} highlight={s.user.id === user?.id} />{s.user.username}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {tbl.done && tbl.game ? (
                <>
                  <span style={{ fontSize: 13, color: t.win, fontWeight: 600 }}>🏆 {tbl.game.players[0]?.user.username}{tbl.game.players[0]?.deck?.name ? ` · ${tbl.game.players[0].deck.name}` : ''}</span>
                  <button onClick={() => navigate(`/partita/${tbl.game.id}`)} style={{ ...btnGhost, padding: '5px 12px', fontSize: 12 }}>Vedi partita ›</button>
                </>
              ) : (isAdmin || mine) ? (
                <button
                  onClick={() => navigate('/nuova-partita', { state: { podContext: { eventId: eid, tableId: tbl.id, date: event.startsAt, players: tbl.seats.map(s => ({ userId: s.user.id, username: s.user.username })) } } })}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: t.primary, color: t.primaryFg, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >Registra partita</button>
              ) : (
                <span style={{ fontSize: 12, color: t.textMuted }}>In attesa del risultato</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {back}

      {/* Hero intestazione evento */}
      {(() => {
        const diffMs = new Date(event.startsAt) - Date.now()
        const diffDays = Math.ceil(diffMs / 86400000)
        const isPast = diffMs < 0
        const countdown = isPast ? null : diffDays === 0 ? 'Oggi' : diffDays === 1 ? 'Domani' : `tra ${diffDays} giorni`

        return (
          <div style={{
            borderRadius: 18, marginBottom: 14, overflow: 'hidden',
            border: `1px solid ${t.border}`, boxShadow: t.shadow,
          }}>
            {/* Striscia colorata top */}
            <div style={{ height: 4, background: badge ? badge.color : t.primary }} />
            <div style={{ background: t.bgSurface, padding: '1.2rem 1.35rem' }}>
              {/* Badge formato + countdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {badge && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: badge.color, background: badge.color + '22', border: `1px solid ${badge.color}55`, padding: '3px 10px', borderRadius: 20 }}>
                    {badge.label}{event.format === '1v1' && event.bestOf ? ` · Bo${event.bestOf}` : ''}
                  </span>
                )}
                {!badge && <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub, background: t.bgMuted, padding: '3px 10px', borderRadius: 20, border: `1px solid ${t.border}` }}>🎴 Serata libera</span>}
                {countdown && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, padding: '3px 10px', borderRadius: 20 }}>
                    {countdown}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6 }}>{event.title}</div>
              <div style={{ fontSize: 13, color: t.textSub, textTransform: 'capitalize' }}>
                {dateLine}{time ? ` · ${time}` : ''}{event.location ? <span style={{ textTransform: 'none' }}> · 📍 {event.location}</span> : ''}
              </div>
              {event.description && <div style={{ fontSize: 13, color: t.textMuted, marginTop: 8, whiteSpace: 'pre-wrap' }}>{event.description}</div>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={toggleRsvp} style={{ padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid ${going ? t.primary : t.border}`, background: going ? t.primary : 'transparent', color: going ? t.primaryFg : t.textSub }}>
                  {going ? '✓ Ci sono' : '+ Ci sono'}
                </button>
                <span style={{ fontSize: 12, color: t.textMuted }}>{registrants.length} iscritt{registrants.length === 1 ? 'o' : 'i'}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Iscritti */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Iscritti</div>
        {registrants.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textMuted }}>Nessun iscritto. Premi “Ci sono”.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {registrants.map(r => (
              <span key={r.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: r.userId === user?.id ? t.text : t.textSub, background: t.bgMuted, borderRadius: 20, padding: '3px 10px 3px 3px' }}>
                <PlayerAvatar username={r.user.username} avatarCardName={r.user.avatarCardName} avatarScryfallId={r.user.avatarScryfallId} size={22} highlight={r.userId === user?.id} />{r.user.username}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Torneo */}
      {event.format ? (
        <>
          {/* Vincitore */}
          {event.finished && event.winner && (
            <div style={{ ...card, border: `1px solid #E8B84B88`, background: '#E8B84B1f', textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#E8B84B' }}>
              🏆 Vincitore: {event.winner.username} · {event.winner.points} punti
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {event.format === '1v1' ? 'Torneo 1v1 (svizzera)' : 'Torneo a pod'}
              </div>
              {isAdmin && event.rounds.length === 0 && (
                <button style={{ ...btnPrimary, marginLeft: 'auto' }} onClick={generateRound} disabled={busy}>
                  {event.format === 'multiplayer' ? 'Genera tavoli' : 'Genera abbinamenti'}
                </button>
              )}
              {isAdmin && event.canNextRound && (
                <button style={{ ...btnPrimary, marginLeft: 'auto' }} onClick={generateRound} disabled={busy}>Genera turno {event.rounds.length + 1}</button>
              )}
              {event.finished && <span style={{ marginLeft: 'auto', fontSize: 12, color: t.win, fontWeight: 700 }}>Torneo concluso</span>}
            </div>

            {event.rounds.length === 0 ? (
              <div style={{ fontSize: 13, color: t.textMuted }}>
                {event.format === 'multiplayer'
                  ? 'Quando tutti sono iscritti, l’admin genera i tavoli (pod da 3 a 5, preferendo 4).'
                  : 'Quando tutti sono iscritti, l’admin genera gli abbinamenti del primo turno.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {event.rounds.map((r, ri) => (
                  <div key={r.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Turno {r.number}</span>
                      {isAdmin && ri === event.rounds.length - 1 && (
                        <button style={{ ...btnGhost, marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => deleteRound(r.id)}>Rifai turno</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {r.tables.map(renderTable)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Classifica (1v1) */}
          {event.format === '1v1' && event.standings?.length > 0 && event.rounds.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Classifica</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {event.standings.map((s, i) => (
                  <div key={s.userId} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8,
                    background: s.userId === user?.id ? (t.primaryBg || t.bgMuted) : 'transparent',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? '#E8B84B' : t.textMuted, minWidth: 22 }}>{i + 1}°</span>
                    <PlayerAvatar username={s.username} avatarCardName={event.rsvps?.find(r => r.userId === s.userId)?.user?.avatarCardName ?? null} avatarScryfallId={event.rsvps?.find(r => r.userId === s.userId)?.user?.avatarScryfallId ?? null} size={24} highlight={s.userId === user?.id} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.text, flex: 1, minWidth: 0 }}>{s.username}</span>
                    <span style={{ fontSize: 12, color: t.textMuted }}>{s.wins}V · {s.draws}N · {s.losses}P{s.byes ? ` · ${s.byes} bye` : ''}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: t.text, minWidth: 28, textAlign: 'right' }}>{s.points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ ...card, color: t.textMuted, fontSize: 13 }}>Evento semplice (senza torneo). Il formato si imposta alla creazione.</div>
      )}
    </div>
  )
}
