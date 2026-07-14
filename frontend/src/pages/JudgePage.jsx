import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import PlayerAvatar from '../components/PlayerAvatar'

function ConfidenceBadge({ value }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.85 ? '#4caf50' : value >= 0.6 ? '#ff9800' : '#f44336'
  const label = value >= 0.85 ? 'Alta' : value >= 0.6 ? 'Media' : 'Bassa'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: color + '20', color, border: `1px solid ${color}50`
    }}>
      Confidenza {label} · {pct}%
    </span>
  )
}

function Tag({ children, color }) {
  const { t } = useTheme()
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 6, fontSize: 12, fontWeight: 500,
      background: color ? color + '18' : t.bgMuted,
      color: color || t.textSub,
      border: `1px solid ${color ? color + '40' : t.border}`
    }}>
      {children}
    </span>
  )
}

function HistoryItem({ item, t }) {
  const [open, setOpen] = useState(false)
  const date = new Date(item.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  const pct = Math.round(item.confidence * 100)
  const confColor = item.confidence >= 0.85 ? '#4caf50' : item.confidence >= 0.6 ? '#ff9800' : '#f44336'

  return (
    <div style={{
      background: t.bgSurface, border: `1px solid ${t.border}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '0.75rem 0.9rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <PlayerAvatar username={item.user.username} avatarCardName={item.user.avatarCardName || null} avatarScryfallId={item.user.avatarScryfallId || null} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.question}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span>{item.user.username}</span>
            <span>·</span>
            <span>{date}</span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: confColor, flexShrink: 0 }} />
            <span style={{ color: confColor, fontWeight: 600 }}>{pct}%</span>
          </div>
        </div>
        <span style={{
          fontSize: 11, color: t.textMuted, flexShrink: 0,
          transition: 'transform 0.2s', display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)'
        }}>▶</span>
      </button>

      {open && (
        <div style={{ padding: '0 0.9rem 0.9rem 0.9rem', borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 14, color: t.text, lineHeight: 1.65, paddingTop: '0.75rem' }}>
            {item.answer}
          </div>
        </div>
      )}
    </div>
  )
}

export default function JudgePage() {
  const { t } = useTheme()
  const { user } = useAuth()
  const [question, setQuestion]   = useState('')
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [showSources, setShowSources] = useState(false)
  const [history, setHistory]     = useState([])

  useEffect(() => {
    api.getJudgeHistory()
      .then(setHistory)
      .catch(() => {})
  }, [])

  const ask = async () => {
    const q = question.trim()
    if (!q || q.length < 5) { setError('Scrivi almeno una domanda completa.'); return }
    setLoading(true); setError(''); setResult(null); setShowSources(false)
    try {
      const data = await api.askJudge(q)
      setResult(data)
      // aggiorna storico aggiungendo la nuova domanda in cima (ottimistico)
      setHistory(prev => [{
        id: Date.now(), question: q, answer: data.answer,
        confidence: data.confidence, createdAt: new Date().toISOString(),
        user: { username: user?.username || 'Tu', avatarCardName: user?.avatarCardName || null, avatarScryfallId: user?.avatarScryfallId || null }
      }, ...prev.slice(0, 29)])
    } catch (err) {
      setError(err.error || 'Errore durante la consulenza. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask()
  }

  const glass = {
    background: t.bgSurface,
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    padding: '1.25rem 1.4rem',
    boxShadow: t.shadow,
  }

  const inputSt = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${t.border}`, fontSize: 14,
    background: t.inputBg, color: t.text, outline: 'none',
    fontFamily: 'inherit', resize: 'vertical',
    lineHeight: 1.5,
  }

  const btnPrimary = {
    padding: '10px 22px', background: t.primary, color: t.primaryFg,
    border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
    transition: 'opacity 0.15s',
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: t.text }}>
        Judge Bot
      </div>
      <div style={{ fontSize: 13, color: t.textSub, marginBottom: '1.5rem' }}>
        Fai una domanda sulle regole di Magic: The Gathering Commander.
        Le risposte si basano su oracle text Scryfall e Comprehensive Rules.
      </div>

      {/* Domanda */}
      <div style={{ ...glass, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textSub, marginBottom: 8 }}>
          La tua domanda <span style={{ fontWeight: 400 }}>(Ctrl+Invio per inviare)</span>
        </div>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Es: Posso rispondere con una contromagia a una copia creata da Storm? Come funziona Rhystic Study se un avversario paga {1}?"
          rows={4}
          style={inputSt}
          disabled={loading}
        />
        {error && (
          <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 8, background: t.dangerBg, color: t.danger, fontSize: 13, border: `0.5px solid ${t.dangerBorder}` }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={btnPrimary} onClick={ask} disabled={loading}>
            {loading ? '⏳ Il judge sta consultando le regole...' : '⚖ Chiedi al Judge'}
          </button>
          {result && !loading && (
            <button
              style={{ padding: '10px 16px', background: 'transparent', color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, cursor: 'pointer' }}
              onClick={() => { setResult(null); setQuestion('') }}
            >
              Nuova domanda
            </button>
          )}
        </div>
      </div>

      {/* Risposta corrente */}
      {result && (
        <div className="ct-fade-up">

          <div style={{ ...glass, marginBottom: 12, borderLeft: `3px solid ${t.primary}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.primary }}>Ruling</span>
              <ConfidenceBadge value={result.confidence} />
            </div>
            <div style={{ fontSize: 15, color: t.text, lineHeight: 1.65, fontWeight: 500 }}>
              {result.answer}
            </div>
          </div>

          {result.explanation && (
            <div style={{ ...glass, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spiegazione</div>
              <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7 }}>{result.explanation}</div>
            </div>
          )}

          {(result.cardsDetected?.length > 0 || result.rulesUsed?.length > 0) && (
            <div style={{ ...glass, marginBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {result.cardsDetected?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Carte rilevate</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.cardsDetected.map(c => <Tag key={c} color={t.primary}>{c}</Tag>)}
                    </div>
                  </div>
                )}
                {result.rulesUsed?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Regole citate</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.rulesUsed.map(r => <Tag key={r}>CR {r}</Tag>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {result.sources?.length > 0 && (
            <div style={{ ...glass, marginBottom: 12 }}>
              <button
                onClick={() => setShowSources(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, color: t.textSub, fontSize: 13, fontWeight: 600 }}
              >
                <span style={{ fontSize: 11, transition: 'transform 0.2s', display: 'inline-block', transform: showSources ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                Sezioni CR usate ({result.sources.length})
              </button>
              {showSources && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.sources.map(s => (
                    <div key={s.id} style={{ padding: '8px 12px', background: t.bgMuted, borderRadius: 8, border: `0.5px solid ${t.border}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.primary, marginRight: 8 }}>{s.id}</span>
                      <span style={{ fontSize: 13, color: t.text }}>{s.text.replace(/^\d[\d.a-z]*\.\s+/, '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12, marginBottom: 24, fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
            Le risposte del judge bot sono orientative. Per decisioni ufficiali consulta sempre un judge certificato.
          </div>
        </div>
      )}

      {/* Storico domande del gruppo */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10, marginTop: result ? 0 : 8 }}>
            Domande recenti del gruppo
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((item, i) => (
              <div key={item.id} className="ct-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                <HistoryItem item={item} t={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
