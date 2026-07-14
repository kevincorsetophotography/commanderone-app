import { useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import rawMd from '../../../GUIDA_UTENTE.md?raw'

// ── markdown parser ────────────────────────────────────────────────────────────

function parseBlocks(md) {
  const lines = md.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) { out.push({ t: 'hr' }); i++; continue }

    // Heading
    const hm = line.match(/^(#{1,6}) (.+)/)
    if (hm) { out.push({ t: 'h', lv: hm[1].length, tx: hm[2] }); i++; continue }

    // Image
    if (/^!\[/.test(line.trim())) {
      const im = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (im) out.push({ t: 'img', alt: im[1], src: '/' + im[2].replace(/^\//, '') })
      i++; continue
    }

    // Table (lines that start with |)
    if (line.includes('|') && line.trim()[0] === '|') {
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()[0] === '|') {
        rows.push(lines[i]); i++
      }
      const pr = r => r.split('|').slice(1, -1).map(c => c.trim())
      out.push({ t: 'tb', hd: pr(rows[0]), rw: rows.slice(2).map(pr) })
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const txs = []
      while (i < lines.length && lines[i].startsWith('> ')) { txs.push(lines[i].slice(2)); i++ }
      out.push({ t: 'bq', tx: txs.join(' ') })
      continue
    }

    // Unordered list
    if (/^[*-] /.test(line)) {
      const items = []
      while (i < lines.length && /^[*-] /.test(lines[i])) { items.push(lines[i].slice(2)); i++ }
      out.push({ t: 'ul', items })
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, '')); i++
      }
      out.push({ t: 'ol', items })
      continue
    }

    // Paragraph — accumulate until a block-level marker
    const para = []
    while (i < lines.length) {
      const l = lines[i]
      if (!l.trim() || /^#{1,6} /.test(l) || /^[*-] /.test(l) || /^\d+\. /.test(l) ||
          /^-{3,}$/.test(l.trim()) || l.startsWith('> ') ||
          (l.includes('|') && l.trim()[0] === '|') || /^!\[/.test(l.trim())) break
      para.push(l); i++
    }
    if (para.length) out.push({ t: 'p', tx: para.join(' ') })
  }

  return out
}

// ── inline text → safe HTML ───────────────────────────────────────────────────

function inline(text, t) {
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, `<code style="background:${t.bgMuted};padding:2px 5px;border-radius:4px;font-size:0.875em;font-family:monospace;color:${t.primary}">$1</code>`)
    .replace(/\[([^\]\n]+)\]\([^\)\n]*\)/g, '<span>$1</span>')
  return { __html: html }
}

// ── page component ─────────────────────────────────────────────────────────────

export default function GuidaPage() {
  const navigate = useNavigate()
  const { t } = useTheme()

  const blocks = parseBlocks(rawMd)

  const cardStyle = {
    background: t.bgSurface,
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    padding: '1.25rem 1.5rem',
    boxShadow: t.shadow,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ← Indietro
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>Guida Utente</h1>
      </div>

      <div style={cardStyle}>
        {blocks.map((block, idx) => {
          switch (block.t) {
            case 'hr':
              return <hr key={idx} style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '20px 0' }} />

            case 'h': {
              if (block.lv === 1) return null
              if (block.lv === 2) return (
                <h2 key={idx} style={{ fontSize: 17, fontWeight: 800, color: t.text, margin: '28px 0 10px', paddingTop: 4 }}
                  dangerouslySetInnerHTML={inline(block.tx, t)} />
              )
              return (
                <h3 key={idx} style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: '16px 0 6px' }}
                  dangerouslySetInnerHTML={inline(block.tx, t)} />
              )
            }

            case 'p':
              return <p key={idx} style={{ color: t.textSub, fontSize: 14, lineHeight: 1.65, margin: '6px 0' }}
                dangerouslySetInnerHTML={inline(block.tx, t)} />

            case 'ul':
              return (
                <ul key={idx} style={{ color: t.textSub, fontSize: 14, lineHeight: 1.65, margin: '6px 0', paddingLeft: 22 }}>
                  {block.items.map((item, i) => (
                    <li key={i} style={{ marginBottom: 3 }} dangerouslySetInnerHTML={inline(item, t)} />
                  ))}
                </ul>
              )

            case 'ol':
              return (
                <ol key={idx} style={{ color: t.textSub, fontSize: 14, lineHeight: 1.65, margin: '6px 0', paddingLeft: 22 }}>
                  {block.items.map((item, i) => (
                    <li key={i} style={{ marginBottom: 3 }} dangerouslySetInnerHTML={inline(item, t)} />
                  ))}
                </ol>
              )

            case 'bq':
              return (
                <blockquote key={idx} style={{ borderLeft: `3px solid ${t.primary}`, margin: '10px 0', background: t.bgMuted, borderRadius: '0 8px 8px 0', padding: '10px 14px' }}>
                  <span style={{ color: t.textSub, fontSize: 13, fontStyle: 'italic' }} dangerouslySetInnerHTML={inline(block.tx, t)} />
                </blockquote>
              )

            case 'tb':
              return (
                <div key={idx} style={{ overflowX: 'auto', margin: '10px 0' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {block.hd.map((h, i) => (
                          <th key={i} style={{ padding: '7px 12px', textAlign: 'left', borderBottom: `2px solid ${t.border}`, color: t.text, fontWeight: 700, background: t.bgMuted, whiteSpace: 'nowrap' }}
                            dangerouslySetInnerHTML={inline(h, t)} />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rw.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: `1px solid ${t.border}` }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ padding: '7px 12px', color: t.textSub, verticalAlign: 'top' }}
                              dangerouslySetInnerHTML={inline(cell, t)} />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )

            case 'img':
              return (
                <img key={idx} src={block.src} alt={block.alt}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                  style={{ maxWidth: '100%', borderRadius: 8, margin: '12px 0', display: 'block', border: `1px solid ${t.border}` }} />
              )

            default: return null
          }
        })}
      </div>
    </div>
  )
}
