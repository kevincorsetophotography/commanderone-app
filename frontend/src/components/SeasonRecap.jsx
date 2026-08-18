import { useRef, useMemo, useEffect, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { Trans, useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'
import { seasonOf } from '../lib/seasons'
import { ordinal } from '../lib/ordinal'

// ── palette brand ──────────────────────────────────────────────────────────────
const C = {
  bg:     '#07080F',
  card:   '#0C0E1C',
  text:   '#FFFFFF',
  sub:    '#8A97B8',
  muted:  '#4A5475',
  green:  '#34F08F',
  purple: '#8B5CF6',
  gold:   '#F5C542',
  silver: '#9BAEC8',
  bronze: '#C47D42',
  cyan:   '#22D3EE',
  orange: '#FB923C',
  pink:   '#F472B6',
  glowG:  '0 0 32px rgba(52,240,143,0.65), 0 0 70px rgba(52,240,143,0.22)',
}

const W = 360, H = 450, SCALE = 3

// ── helpers ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const ART = n => `${API_BASE}/scryfall/art?name=${encodeURIComponent(n)}`
const b64 = blob => new Promise(r => { const x = new FileReader(); x.onload = () => r(x.result); x.readAsDataURL(blob) })
const fetchDU = async url => { try { const r = await fetch(url); if (!r.ok) return null; return b64(await r.blob()) } catch { return null } }
const hue = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff, 0) % 360

// ── data ───────────────────────────────────────────────────────────────────────
function computeSeason(games, key) {
  const sg = games.filter(g => seasonOf(g.playedAt).key === key)
  const dk = {}, kk = {}
  let totalKills = 0
  for (const g of sg) {
    for (const p of g.players) {
      if (!dk[p.deck.id]) dk[p.deck.id] = { id: p.deck.id, name: p.deck.name, commander: p.deck.commander, games: 0, wins: 0 }
      dk[p.deck.id].games++; if (p.isWinner) dk[p.deck.id].wins++
      if (p.eliminatedById) { totalKills++; const k = g.players.find(x => x.user.id === p.eliminatedById); if (k) kk[k.user.username] = (kk[k.user.username] || 0) + 1 }
    }
  }
  const spotlight = Object.values(dk).filter(d => d.games >= 3).map(d => ({ ...d, wr: Math.round(d.wins / d.games * 100) })).sort((a, b) => b.wr - a.wr || b.wins - a.wins)[0] || null
  const sorted = [...sg].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))
  const sm = {}
  for (const g of sorted) for (const p of g.players) {
    if (!sm[p.user.id]) sm[p.user.id] = { username: p.user.username, cur: 0, best: 0 }
    const r = sm[p.user.id]; if (p.isWinner) { r.cur++; r.best = Math.max(r.best, r.cur) } else r.cur = 0
  }
  const topStreak = Object.values(sm).sort((a, b) => b.best - a.best)[0] || null
  const topKiller = Object.entries(kk).sort((a, b) => b[1] - a[1])[0] || null
  const deckCount = Object.keys(dk).length
  const uniquePlayers = new Set(sg.flatMap(g => g.players.map(p => p.user.id))).size
  return { sg, spotlight, topStreak, topKiller, deckCount, uniquePlayers, totalKills }
}

// ── atoms ──────────────────────────────────────────────────────────────────────
function Avatar({ src, name, size, ring }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2.5px solid ${ring}`, background: `hsl(${hue(name)},44%,28%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
           : <span style={{ fontSize: size * 0.35, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{(name || '?').slice(0, 2).toUpperCase()}</span>}
    </div>
  )
}

function GLine({ col = '#34F08F', op = 0.45 }) {
  const h = Math.round(op * 255).toString(16).padStart(2, '0')
  return <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${col}${h}, transparent)` }} />
}

// TopBar: ~38px totali (padding 7+5 + logo 26px)
function TopBar({ n, groupName }) {
  return (
    <div style={{ padding: '7px 16px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: '0.04em' }}>
        {String(n).padStart(2, '0')}<span style={{ color: C.muted, fontWeight: 600 }}>/03</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <img src="/icon-192.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 6 }} />
        <div>
          <div style={{ fontSize: 8, fontWeight: 900, color: C.green, letterSpacing: '0.18em', lineHeight: 1 }}>COMMANDERONE</div>
          {groupName && <div style={{ fontSize: 6.5, color: C.muted, letterSpacing: '0.14em', marginTop: 1.5, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName.toUpperCase()}</div>}
        </div>
      </div>
      <div style={{ width: 44 }} />
    </div>
  )
}

// ── SLIDE 1 ─────────────────────────────────────────────────────────────────────
// Budget altezza: TopBar 42px | GLine+margin 11px | Title 64px | Champion(flex) | Podio 64px | Stats 54px | Footer 27px = 262px fissi
function Slide1({ champion, second, third, label, imgUrls, total, uniquePlayers, deckCount, topDecks, groupName, tr, locale }) {
  function DeckChip({ playerId, col, size = 'sm' }) {
    const deck = topDecks?.[playerId]
    const art  = imgUrls?.[`bd_${playerId}`]
    const w = size === 'lg' ? 28 : 22, h = 16
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        {art
          ? <img src={art} alt="" style={{ width: w, height: h, borderRadius: 3, objectFit: 'cover', objectPosition: 'center 20%', flexShrink: 0, border: `1px solid ${col}50` }} />
          : <div style={{ width: w, height: h, borderRadius: 3, background: `${col}22`, flexShrink: 0 }} />}
        <div style={{ fontSize: size === 'lg' ? 8.5 : 8, fontWeight: 700, color: col, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {deck?.name || '—'}
        </div>
      </div>
    )
  }
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 100% 70% at 50% 82%, rgba(139,92,246,0.35) 0%, transparent 55%), radial-gradient(ellipse 55% 40% at 8% 15%, rgba(52,240,143,0.16) 0%, transparent 48%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar n={1} groupName={groupName} />
      <div style={{ margin: '0 16px 10px' }}><GLine op={0.5} /></div>

      {/* Title block */}
      <div style={{ textAlign: 'center', padding: '0 16px 7px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: C.green, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 5 }}>{tr('seasonRecap.slide1.eyebrow')}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 8.5, color: C.sub, marginTop: 5, fontStyle: 'italic' }}>{tr('seasonRecap.slide1.tagline')}</div>
      </div>

      {/* Champion card — flex: 1 */}
      <div style={{ padding: '0 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 26, textAlign: 'center', lineHeight: 1, marginBottom: -11, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 0 10px rgba(245,197,66,0.95))' }}>👑</div>
        <div style={{
          borderRadius: 16, padding: '12px 16px 12px',
          background: 'linear-gradient(150deg, rgba(52,240,143,0.08) 0%, rgba(52,240,143,0.025) 50%, rgba(139,92,246,0.07) 100%)',
          border: `2px solid ${C.green}`,
          boxShadow: C.glowG,
        }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: C.green, letterSpacing: '0.28em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 9 }}>{tr('seasonRecap.slide1.championLabel')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar src={imgUrls[`p_${champion?.id}`]} name={champion?.username || '?'} size={50} ring={C.green} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 27, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {champion?.username || '—'}
              </div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>
                {tr('seasonRecap.slide1.championStats', { wins: champion?.wins || 0, pct: champion?.games ? Math.round(champion.wins / champion.games * 100) : 0 })}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: C.green, lineHeight: 1, textShadow: '0 0 24px rgba(52,240,143,0.75)' }}>{champion?.points ?? 0}</div>
              <div style={{ fontSize: 9, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.16em', marginTop: 3 }}>{tr('gruppoPage.points').toUpperCase()}</div>
            </div>
          </div>
          {/* Best deck del campione */}
          <div style={{ marginTop: 7 }}>
            <DeckChip playerId={champion?.id} col={C.green} size="lg" />
          </div>
        </div>
      </div>

      {/* Podio */}
      <div style={{ display: 'flex', gap: 8, padding: '7px 14px 5px' }}>
        {[{ p: second, col: C.silver, n: ordinal(2, locale) }, { p: third, col: C.bronze, n: ordinal(3, locale) }].map(({ p, col, n }) => (
          <div key={n} style={{ flex: 1, borderRadius: 12, padding: '9px 11px 8px', background: C.card, borderTop: `2px solid ${col}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: col, lineHeight: 1, textShadow: `0 0 12px ${col}90`, minWidth: 20, flexShrink: 0 }}>{n}</div>
              <Avatar src={imgUrls[`p_${p?.id}`]} name={p?.username || '?'} size={24} ring={col} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p?.username || '—'}</div>
                <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{tr('seasonRecap.slide1.podiumStats', { points: p?.points ?? 0, wins: p?.wins ?? 0 })}</div>
              </div>
            </div>
            {/* Best deck del giocatore */}
            <div style={{ marginTop: 7 }}>
              <DeckChip playerId={p?.id} col={col} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Stats row ~54px */}
      <div style={{ padding: '0 16px 8px' }}>
        <GLine col={C.muted} op={0.35} />
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0 7px' }}>
          {[{ icon: '⚔️', v: total, l: tr('seasonRecap.slide1.statGames') }, { icon: '👥', v: uniquePlayers, l: tr('seasonRecap.slide1.statPlayers') }, { icon: '🃏', v: deckCount, l: tr('seasonRecap.slide1.statDecks') }].map(({ icon, v, l }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, lineHeight: 1, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 21, fontWeight: 900, color: C.text, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 8.5, color: C.muted, letterSpacing: '0.12em', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        <GLine col={C.muted} op={0.25} />
      </div>

      {/* Footer ~27px */}
      <div style={{ padding: '5px 16px 12px', textAlign: 'center', fontSize: 9, letterSpacing: '0.04em', color: C.sub }}>
        <Trans i18nKey="seasonRecap.slide1.footer" components={{ incredible: <span style={{ color: C.green, fontWeight: 800 }} /> }} />
      </div>
    </div>
  )
}

// ── SLIDE 2 ─────────────────────────────────────────────────────────────────────
// Budget: TopBar 42px | GLine 7px | Title 72px | Grid(flex) | Footer 47px = 168px fissi; grid ~282px
function Slide2({ total, uniquePlayers, deckCount, avgParticipation, topStreak, totalKills, groupName, tr }) {
  const stats = [
    { val: total,                  label: tr('seasonRecap.slide2.statGames'),         col: C.green,  icon: '⚔️' },
    { val: uniquePlayers,          label: tr('seasonRecap.slide2.statPlayers'),       col: C.purple, icon: '👥' },
    { val: deckCount,               label: tr('seasonRecap.slide2.statDecks'),        col: C.cyan,   icon: '🃏' },
    { val: `${avgParticipation}%`, label: tr('seasonRecap.slide2.statParticipation'), col: C.cyan,   icon: '📊' },
    { val: topStreak?.best || 0,   label: tr('seasonRecap.slide2.statStreak'),        col: C.orange, icon: '🔥' },
    { val: totalKills,             label: tr('seasonRecap.slide2.statEliminations'),  col: C.purple, icon: '💀' },
  ]
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 65% 50% at 88% 8%, rgba(139,92,246,0.28) 0%, transparent 55%), radial-gradient(ellipse 50% 38% at 8% 92%, rgba(52,240,143,0.1) 0%, transparent 48%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar n={2} groupName={groupName} />
      <div style={{ margin: '0 16px 6px' }}><GLine op={0.5} /></div>

      {/* Title ~72px */}
      <div style={{ textAlign: 'center', padding: '2px 16px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.sub, letterSpacing: '0.3em', textTransform: 'uppercase', lineHeight: 1, marginBottom: 3 }}>{tr('seasonRecap.slide2.titleEyebrow')}</div>
        <div style={{ fontSize: 44, fontWeight: 900, color: C.green, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1, textShadow: '0 0 36px rgba(52,240,143,0.6)' }}>{tr('seasonRecap.slide2.titleMain')}</div>
      </div>

      {/* Grid 2×3 — cuore della slide */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(3, 1fr)', gap: 7, padding: '0 12px' }}>
        {stats.map(({ val, label, col, icon }) => (
          <div key={label} style={{
            borderRadius: 12, padding: '0 10px',
            background: C.card,
            border: `1.5px solid ${col}45`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 5 }}>{icon}</div>
            <div style={{ fontSize: 33, fontWeight: 900, color: C.text, lineHeight: 1 }}>{val}</div>
            {/* Label — minimo 8px per leggibilità */}
            <div style={{ fontSize: 8, fontWeight: 700, color: col, letterSpacing: '0.12em', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.4, marginTop: 6, whiteSpace: 'pre-line' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Footer decorativo ~47px */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(52,240,143,0.5))' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9.5, fontWeight: 900, color: C.green, letterSpacing: '0.26em' }}>COMMANDERONE</div>
          {groupName && <div style={{ fontSize: 7, color: C.muted, letterSpacing: '0.18em', marginTop: 2 }}>{groupName.toUpperCase()}</div>}
        </div>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(52,240,143,0.5), transparent)' }} />
      </div>
    </div>
  )
}

// ── SLIDE 3 ─────────────────────────────────────────────────────────────────────
// Budget: TopBar 42px | GLine 7px | Title 47px | Awards 180px | Deck 72px | TY 39px | Footer(auto) 63px = 450px
function Slide3({ mostWins, mostGames, topKiller, bestWinRate, topStreak, mostConsistent, spotlight, imgUrls, qrDataUrl, groupName, tr }) {
  const wr = p => p?.games ? Math.round(p.wins / p.games * 100) : 0
  const awards = [
    { icon: '🏆', col: C.gold,   label: tr('seasonRecap.slide3.awardMostWins'),      name: mostWins?.username || '—',       stat: tr('seasonRecap.slide3.awardWinsStat', { count: mostWins?.wins || 0 }) },
    { icon: '🎯', col: C.cyan,   label: tr('seasonRecap.slide3.awardMostGames'),     name: mostGames?.username || '—',      stat: tr('seasonRecap.slide3.awardGamesStat', { count: mostGames?.games || 0 }) },
    { icon: '📈', col: C.green,  label: tr('seasonRecap.slide3.awardBestWinRate'),   name: bestWinRate?.username || '—',    stat: `${wr(bestWinRate)}%` },
    { icon: '⚔️', col: C.pink,   label: tr('seasonRecap.slide3.awardMostRuthless'),  name: topKiller?.[0] || '—',          stat: tr('seasonRecap.slide3.awardKillsStat', { count: topKiller?.[1] || 0 }) },
    { icon: '🔥', col: C.orange, label: tr('seasonRecap.slide3.awardStreak'),        name: topStreak?.username || '—',      stat: tr('seasonRecap.slide3.awardStreakStat', { count: topStreak?.best || 0 }) },
    { icon: '💎', col: C.purple, label: tr('seasonRecap.slide3.awardMostConsistent'), name: mostConsistent?.username || '—', stat: tr('seasonRecap.slide3.awardConsistentStat', { value: (mostConsistent?.avg || 0).toFixed(1) }) },
  ]
  return (
    <div style={{
      width: W, height: H, overflow: 'hidden',
      background: `radial-gradient(ellipse 85% 52% at 50% 20%, rgba(139,92,246,0.28) 0%, transparent 55%), #07080F`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar n={3} groupName={groupName} />
      <div style={{ margin: '0 16px 6px' }}><GLine op={0.5} /></div>

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '0 16px 5px' }}>
        <div style={{ fontSize: 25, fontWeight: 900, color: C.text, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>{tr('seasonRecap.slide3.title')}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.green, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 5 }}>{tr('seasonRecap.slide3.subtitle')}</div>
      </div>

      {/* Award tiles 3×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '0 12px' }}>
        {awards.map(({ icon, col, label, name, stat }) => (
          <div key={label} style={{ borderRadius: 11, padding: '6px 5px 5px', textAlign: 'center', background: C.card, border: `1.5px solid ${col}45` }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${col}1A`, border: `1.5px solid ${col}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 3px', fontSize: 12, lineHeight: 1 }}>{icon}</div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: col, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.text, marginTop: 2, lineHeight: 1 }}>{name}</div>
            <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{stat}</div>
          </div>
        ))}
      </div>

      {/* Deck della stagione — ~72px (margin 8 + height 64) */}
      {spotlight && (
        <div style={{ margin: '8px 12px 0', borderRadius: 11, overflow: 'hidden', border: `1.5px solid rgba(52,240,143,0.5)`, height: 64, position: 'relative', flexShrink: 0, boxShadow: '0 0 20px rgba(52,240,143,0.22)' }}>
          {/* art_crop più visibile: opacity 0.72, overlay leggero che copre solo la zona testo */}
          {imgUrls?.deck && <img src={imgUrls.deck} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', opacity: 0.72 }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,8,15,0.88) 34%, rgba(7,8,15,0.05) 70%)' }}>
            <div style={{ padding: '0 14px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: C.green, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{tr('seasonRecap.slide3.deckOfSeason')}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1, marginTop: 3 }}>{spotlight.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Thank you */}
      <div style={{ textAlign: 'center', padding: '5px 16px 2px' }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: C.green, fontStyle: 'italic', textShadow: '0 0 20px rgba(52,240,143,0.6)', letterSpacing: '0.02em' }}>{tr('seasonRecap.slide3.thanksCommunity')}</div>
        <div style={{ fontSize: 9.5, color: C.sub, marginTop: 4, letterSpacing: '0.05em' }}>{tr('seasonRecap.slide3.seeYouNextSeason')}</div>
      </div>

      {/* Footer QR — spinto a fondo da marginTop:auto */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/icon-192.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 6 }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: C.green, letterSpacing: '0.18em' }}>COMMANDERONE</div>
            {groupName && <div style={{ fontSize: 7, color: C.muted, letterSpacing: '0.14em', marginTop: 1.5 }}>{groupName.toUpperCase()}</div>}
          </div>
        </div>
        {qrDataUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 8, color: C.green, fontWeight: 700, letterSpacing: '0.1em' }}>{tr('seasonRecap.slide3.discoverMore')}</div>
            <img src={qrDataUrl} alt="QR" style={{ width: 50, height: 50, borderRadius: 8, imageRendering: 'pixelated' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL ──────────────────────────────────────────────────────────────────────
export default function SeasonRecap({ season, seasonKey, seasons, games, playerStats, groupName, onClose }) {
  const { t } = useTheme()
  const { t: tr, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'it-IT'
  const refs = [useRef(null), useRef(null), useRef(null)]
  const [imgUrls, setImgUrls]     = useState({})
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [dlState, setDlState]     = useState(null)

  const seasonLabel = seasons.find(s => s.key === seasonKey)?.label || seasonKey
  const { sg, spotlight, topStreak, topKiller, deckCount, uniquePlayers, totalKills } =
    useMemo(() => computeSeason(games, seasonKey), [games, seasonKey])

  const top3           = season.standings.filter(s => s.qualified).slice(0, 3)
  const statsMap       = useMemo(() => Object.fromEntries((playerStats || []).map(p => [p.id, p])), [playerStats])
  const mostWins       = useMemo(() => [...season.standings].sort((a, b) => b.wins - a.wins)[0] || null, [season])
  const mostGames      = useMemo(() => [...season.standings].sort((a, b) => b.games - a.games)[0] || null, [season])
  const bestWinRate    = useMemo(() => season.standings.filter(s => s.games >= 3).sort((a, b) => b.wins / b.games - a.wins / a.games)[0] || null, [season])
  const mostConsistent = useMemo(() => season.standings.filter(s => s.games >= 3).map(s => ({ ...s, avg: s.points / s.games })).sort((a, b) => b.avg - a.avg)[0] || null, [season])
  const avgParticipation = useMemo(() => {
    if (!sg.length || !playerStats?.length) return 0
    return Math.round(sg.reduce((s, g) => s + g.players.length, 0) / sg.length / playerStats.length * 100)
  }, [sg, playerStats])

  const topDecks = useMemo(() => {
    if (!sg.length) return {}
    const result = {}
    for (const player of top3) {
      if (!player) continue
      const dk = {}
      for (const g of sg) {
        for (const gp of g.players) {
          if (gp.user.id !== player.id) continue
          const d = gp.deck
          if (!dk[d.id]) dk[d.id] = { id: d.id, name: d.name, commander: d.commander, wins: 0, games: 0 }
          dk[d.id].games++
          if (gp.isWinner) dk[d.id].wins++
        }
      }
      result[player.id] = Object.values(dk).sort((a, b) => b.wins - a.wins || b.games - a.games)[0] || null
    }
    return result
  }, [sg, top3])

  useEffect(() => {
    setLoading(true); setImgUrls({}); setQrDataUrl(null)
    const toLoad = {}
    for (const s of top3) {
      const ps = statsMap[s.id]
      const bd = topDecks[s.id]
      if (ps?.avatarScryfallId) {
        toLoad[`p_${s.id}`] = `${API_BASE}/scryfall/art?id=${ps.avatarScryfallId}`
      } else {
        const avatarCard = ps?.avatarCardName || bd?.commander
        if (avatarCard) toLoad[`p_${s.id}`] = ART(avatarCard)
      }
      if (bd?.commander) toLoad[`bd_${s.id}`] = ART(bd.commander)
    }
    if (spotlight?.commander) toLoad.deck = ART(spotlight.commander)
    Promise.allSettled([
      Promise.all(Object.entries(toLoad).map(([k, url]) => fetchDU(url).then(du => du ? [k, du] : null).catch(() => null)))
        .then(rs => { const m = {}; for (const r of rs) if (r) m[r[0]] = r[1]; setImgUrls(m) }),
      QRCode.toDataURL(window.location.origin, { width: 160, margin: 2, color: { dark: '#ECEDFB', light: '#07080F' } }).then(setQrDataUrl).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [seasonKey])

  async function capture(idx) {
    if (!refs[idx].current) return
    const cv = await html2canvas(refs[idx].current, { scale: SCALE, backgroundColor: C.bg, useCORS: false, logging: false, imageTimeout: 0 })
    const a = Object.assign(document.createElement('a'), { download: `commanderone-${seasonKey}-slide-${idx + 1}.png`, href: cv.toDataURL('image/png') })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
  async function downloadOne(idx) { setDlState(idx); try { await capture(idx) } finally { setDlState(null) } }
  async function downloadAll() {
    setDlState('all')
    try { for (let i = 0; i < 3; i++) { await capture(i); if (i < 2) await new Promise(r => setTimeout(r, 500)) } }
    finally { setDlState(null) }
  }

  const busy = dlState !== null || loading
  const s1 = { champion: top3[0], second: top3[1], third: top3[2], label: seasonLabel, imgUrls, total: sg.length, uniquePlayers, deckCount, topDecks, groupName, tr, locale }
  const s2 = { total: sg.length, uniquePlayers, deckCount, avgParticipation, topStreak, totalKills, groupName, tr }
  const s3 = { mostWins, mostGames, topKiller, bestWinRate, topStreak, mostConsistent, spotlight, imgUrls, qrDataUrl, groupName, tr }
  const info = [
    { label: tr('seasonRecap.modal.slide1Title'), sub: tr('seasonRecap.modal.slide1Sub') },
    { label: tr('seasonRecap.modal.slide2Title'), sub: tr('seasonRecap.modal.slide2Sub') },
    { label: tr('seasonRecap.modal.slide3Title'), sub: tr('seasonRecap.modal.slide3Sub') },
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)', overflowY: 'auto', padding: '16px 12px 40px' }}>
      <div onClick={e => e.stopPropagation()} className="ct-modal-in" style={{ maxWidth: 400, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: t.text }}>{tr('seasonRecap.modal.title')}</div>
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{tr('seasonRecap.modal.dimensions', { w: W * SCALE, h: H * SCALE })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadAll} disabled={busy} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', background: busy ? t.bgMuted : t.primary, color: busy ? t.textMuted : '#04111A', fontWeight: 800, fontSize: 12, cursor: busy ? 'default' : 'pointer' }}>
              {dlState === 'all' ? tr('seasonRecap.modal.downloading') : loading ? tr('seasonRecap.modal.loadingImages') : tr('seasonRecap.modal.downloadAll')}
            </button>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${t.border}`, background: t.bgSurface, color: t.text, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {[<Slide1 {...s1} />, <Slide2 {...s2} />, <Slide3 {...s3} />].map((comp, idx) => (
          <div key={idx} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{info[idx].label}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{info[idx].sub}</div>
              </div>
              <button onClick={() => downloadOne(idx)} disabled={busy} style={{ padding: '6px 12px', borderRadius: 16, border: `1px solid ${t.primaryBorder}`, background: t.primaryBg, color: t.primary, fontWeight: 700, fontSize: 11, cursor: busy ? 'default' : 'pointer' }}>
                {dlState === idx ? tr('seasonRecap.modal.downloadingShort') : tr('seasonRecap.modal.downloadPng')}
              </button>
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
              <div ref={refs[idx]} style={{ display: 'inline-block' }}>{comp}</div>
            </div>
          </div>
        ))}

        <p style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, marginTop: 4 }}>{tr('seasonRecap.modal.tapToClose')}</p>
      </div>
    </div>
  )
}
