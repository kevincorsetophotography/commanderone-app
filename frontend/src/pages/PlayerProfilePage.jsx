import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useFeedback } from '../hooks/useFeedback'
import { SkeletonList, Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import DeckThumb from '../components/DeckThumb'
import DeckListPanel from '../components/DeckListPanel'
import CommanderInput from '../components/CommanderInput'
import BracketBadge from '../components/BracketBadge'
import ArchetypeBadge from '../components/ArchetypeBadge'
import { getAchievements } from '../lib/achievements'
import { BRACKETS, BRACKET_OPTIONS } from '../lib/brackets'
import { ARCHETYPE_OPTIONS } from '../lib/archetypes'
import { fetchCommanderColors, getCardPrintings } from '../lib/scryfall'
import { seasonOf, computeStandings } from '../lib/seasons'

const COLOR_MAP   = { W: '#f5f0e0', U: '#b8d4e8', B: '#c8b8d8', R: '#e8c0b0', G: '#b8d8b8' }
const COLOR_LABEL = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' }

const artUrl = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

function WinBar({ pct, t }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.bgMuted, overflow: 'hidden', marginTop: 6 }}>
      <div className="ct-bar-fill" style={{ height: '100%', width: `${pct}%`, background: t.primary, borderRadius: 3 }} />
    </div>
  )
}

function ColorPip({ c }) {
  return (
    <span title={COLOR_LABEL[c]} style={{
      display: 'inline-block', width: 16, height: 16, borderRadius: '50%',
      background: COLOR_MAP[c] || '#eee', border: '1px solid rgba(0,0,0,0.15)',
      fontSize: 9, lineHeight: '16px', textAlign: 'center', fontWeight: 600, color: '#444',
    }}>{c}</span>
  )
}

export default function PlayerProfilePage() {
  const { id } = useParams()
  const pid = Number.parseInt(id, 10)
  const navigate = useNavigate()
  const { t } = useTheme()
  const { user, updateUser, logout } = useAuth()
  const isMobile = useIsMobile()
  const { toast, confirm } = useFeedback()
  const isOwnProfile = user?.id === pid

  // ── Dati principali ──
  const [games, setGames]       = useState([])
  const [deckStats, setDeckStats] = useState([])
  const [players, setPlayers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // ── UI state sezioni ──
  const [achOpen, setAchOpen]           = useState(false)
  const [showRivalita, setShowRivalita] = useState(false)
  const [showStats, setShowStats]       = useState(false)

  // ── Avatar ──
  const [avatarCard, setAvatarCard]           = useState(null)
  const [avatarScryfallId, setAvatarScryfallId] = useState(null)
  const [pickerOpen, setPickerOpen]           = useState(false)
  const [pickerInput, setPickerInput]         = useState('')
  const [printings, setPrintings]             = useState([])
  const [loadingPrintings, setLoadingPrintings] = useState(false)
  const [selectedPrintingId, setSelectedPrintingId] = useState(null)
  const [savingAvatar, setSavingAvatar]       = useState(false)

  // ── Gestione mazzi (solo profilo proprio) ──
  const [myFullDecks, setMyFullDecks]         = useState([])
  const [loadingDecks, setLoadingDecks]       = useState(false)
  const [showAddForm, setShowAddForm]         = useState(false)
  const [deckForm, setDeckForm]               = useState({ name: '', commander: '', colors: [], bracket: '', archetype: '' })
  const [addingDeck, setAddingDeck]           = useState(false)
  const [deckFormError, setDeckFormError]     = useState('')
  const [detectingDeckColors, setDetectingDeckColors] = useState(false)

  // ── Deep-link achievement (?ach=1) ──
  const [searchParams] = useSearchParams()
  const wantAch = searchParams.get('ach') === '1'
  useEffect(() => {
    if (!wantAch || loading) return
    setAchOpen(true)
    const tm = setTimeout(() => {
      document.getElementById('achievements')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearTimeout(tm)
  }, [wantAch, loading])

  // ── Carica dati principali ──
  useEffect(() => {
    Promise.all([api.getGames(), api.statsDecks(), api.statsPlayers()])
      .then(([g, d, p]) => { setGames(g); setDeckStats(d); setPlayers(p) })
      .catch(() => setError('Errore nel caricamento del profilo'))
      .finally(() => setLoading(false))
  }, [])

  // ── Achievement snapshot (fonte di verità server) ──
  const [unlockedIds, setUnlockedIds] = useState([])
  useEffect(() => {
    api.playerAchievements(pid)
      .then(r => setUnlockedIds(r.unlocked || []))
      .catch(() => setUnlockedIds([]))
  }, [pid])

  // ── Inizializza avatar da dati giocatore / auth ──
  useEffect(() => {
    if (loading) return
    if (isOwnProfile) {
      setAvatarCard(user?.avatarCardName ?? null)
      setAvatarScryfallId(user?.avatarScryfallId ?? null)
    } else {
      const p = players.find(pl => pl.id === pid)
      setAvatarCard(p?.avatarCardName ?? null)
      setAvatarScryfallId(p?.avatarScryfallId ?? null)
    }
  }, [loading, players, pid, isOwnProfile, user])

  // ── Carica mazzi completi (solo profilo proprio) ──
  const loadMyDecks = async () => {
    setLoadingDecks(true)
    try { setMyFullDecks(await api.getMyDecks()) }
    catch { toast('Errore nel caricamento mazzi', 'error') }
    finally { setLoadingDecks(false) }
  }
  useEffect(() => { if (isOwnProfile) loadMyDecks() }, [isOwnProfile])

  // ── Profilo calcolato ──
  const profile = useMemo(() => {
    const player = players.find(p => p.id === pid)
    const myGames = games
      .filter(g => g.players.some(p => p.user.id === pid))
      .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))

    const wins    = myGames.filter(g => g.players.find(p => p.user.id === pid)?.isWinner).length
    const total   = myGames.length
    const winRate = total ? Math.round(wins / total * 100) : 0

    let streak = 0
    for (const g of myGames) {
      if (g.players.find(p => p.user.id === pid)?.isWinner) streak++
      else break
    }

    const nemesisTally = {}
    for (const g of myGames) {
      const me = g.players.find(p => p.user.id === pid)
      if (me?.isWinner) continue
      const winner = g.players.find(p => p.isWinner)
      if (winner && winner.user.id !== pid) {
        nemesisTally[winner.user.username] = (nemesisTally[winner.user.username] || 0) + 1
      }
    }
    const nemesis = Object.entries(nemesisTally).sort((a, b) => b[1] - a[1])[0] || null

    const deckTally = {}
    for (const g of myGames) {
      const me = g.players.find(p => p.user.id === pid)
      if (me) deckTally[me.deck.name] = (deckTally[me.deck.name] || 0) + 1
    }
    const favDeck = Object.entries(deckTally).sort((a, b) => b[1] - a[1])[0] || null

    const myDecks = deckStats.filter(d => d.ownerId === pid).sort((a, b) => b.winRate - a.winRate)

    const placed      = myGames.filter(g => g.players.find(p => p.user.id === pid)?.placement != null)
    const avgPlacement = placed.length
      ? placed.reduce((s, g) => s + g.players.find(p => p.user.id === pid).placement, 0) / placed.length
      : null
    const firstOuts = placed.filter(g => {
      const me = g.players.find(p => p.user.id === pid)
      return me.placement === g.players.length
    }).length

    const chrono = [...myGames].reverse()
    let cw = 0
    const trend = chrono.map((g, i) => {
      if (g.players.find(p => p.user.id === pid)?.isWinner) cw++
      return Math.round(cw / (i + 1) * 100)
    })

    let kills = 0, deaths = 0
    const eliminatorTally = {}, preyTally = {}
    for (const g of myGames) {
      for (const p of g.players) {
        if (p.eliminatedById === pid && p.user.id !== pid) {
          kills++
          preyTally[p.user.username] = (preyTally[p.user.username] || 0) + 1
        }
      }
      const me = g.players.find(p => p.user.id === pid)
      if (me?.eliminatedById) {
        deaths++
        const killer = g.players.find(p => p.user.id === me.eliminatedById)
        if (killer) eliminatorTally[killer.user.username] = (eliminatorTally[killer.user.username] || 0) + 1
      }
    }
    const archNemesis   = Object.entries(eliminatorTally).sort((a, b) => b[1] - a[1])[0] || null
    const favoritePrey  = Object.entries(preyTally).sort((a, b) => b[1] - a[1])[0] || null
    const hasKillData   = kills > 0 || deaths > 0

    const achievements = getAchievements({ myGames, myDecks, pid, allGames: games, unlockedIds })

    return { player, myGames, wins, total, winRate, streak, nemesis, favDeck, myDecks, trend, avgPlacement, firstOuts, placed, achievements, kills, deaths, archNemesis, favoritePrey, hasKillData }
  }, [games, deckStats, players, pid, unlockedIds])

  // ── Stagione corrente ──
  const seasonData = useMemo(() => {
    if (!games.length) return null
    const s = seasonOf(new Date())
    const { standings } = computeStandings(games, s.key)
    const idx = standings.findIndex(st => st.id === pid)
    if (idx < 0) return null
    return { label: s.label, rank: idx + 1, total: standings.length, ...standings[idx] }
  }, [games, pid])

  // ── Rivalità ──
  const [rivalId, setRivalId] = useState(null)
  const opponents = useMemo(() => {
    const seen = new Map()
    for (const g of profile.myGames) {
      for (const p of g.players) {
        if (p.user.id !== pid && !seen.has(p.user.id)) seen.set(p.user.id, p.user.username)
      }
    }
    return [...seen].map(([id, username]) => ({ id, username })).sort((a, b) => a.username.localeCompare(b.username))
  }, [profile.myGames, pid])
  useEffect(() => { setRivalId(prev => (opponents.some(o => o.id === prev) ? prev : (opponents[0]?.id ?? null))) }, [opponents])

  const h2h = useMemo(() => {
    if (!rivalId) return null
    const shared = profile.myGames.filter(g => g.players.some(p => p.user.id === rivalId))
    let meBetter = 0, oppBetter = 0, undecided = 0, myWins = 0, oppWins = 0, myKills = 0, oppKills = 0
    for (const g of shared) {
      const me  = g.players.find(p => p.user.id === pid)
      const opp = g.players.find(p => p.user.id === rivalId)
      if (me.placement != null && opp.placement != null) {
        if (me.placement < opp.placement) meBetter++; else oppBetter++
      } else if (me.isWinner) meBetter++
      else if (opp.isWinner) oppBetter++
      else undecided++
      if (me.isWinner) myWins++
      if (opp.isWinner) oppWins++
      if (opp.eliminatedById === pid) myKills++
      if (me.eliminatedById === rivalId) oppKills++
    }
    return { shared, meBetter, oppBetter, undecided, myWins, oppWins, myKills, oppKills, rival: opponents.find(o => o.id === rivalId) }
  }, [rivalId, profile.myGames, pid, opponents])

  // ── Deck management ──
  const handleDeckCommanderBlur = async () => {
    const name = deckForm.commander.trim()
    if (!name) return
    setDetectingDeckColors(true)
    try {
      const colors = await fetchCommanderColors(name)
      if (colors !== null) setDeckForm(f => ({ ...f, colors }))
    } finally { setDetectingDeckColors(false) }
  }
  const toggleDeckColor = (c) =>
    setDeckForm(f => ({ ...f, colors: f.colors.includes(c) ? f.colors.filter(x => x !== c) : [...f.colors, c] }))

  const submitAddDeck = async (e) => {
    e.preventDefault()
    if (!deckForm.name.trim()) { setDeckFormError('Il nome è obbligatorio'); return }
    setAddingDeck(true); setDeckFormError('')
    try {
      await api.createDeck({
        name:      deckForm.name.trim(),
        commander: deckForm.commander.trim() || null,
        colors:    deckForm.colors.join('') || null,
        bracket:   deckForm.bracket || null,
        archetype: deckForm.archetype || null,
      })
      setDeckForm({ name: '', commander: '', colors: [], bracket: '', archetype: '' })
      setShowAddForm(false)
      await loadMyDecks()
      toast('Mazzo aggiunto', 'success')
    } catch (err) {
      setDeckFormError(err.error || 'Errore nel salvataggio')
    } finally { setAddingDeck(false) }
  }

  const updateDeckBracket = async (id, bracket) => {
    try { await api.updateDeck(id, { bracket: bracket || null }); await loadMyDecks(); toast('Livello aggiornato', 'success') }
    catch (err) { toast(err.error || 'Errore aggiornamento', 'error') }
  }
  const updateDeckArchetype = async (id, archetype) => {
    try { await api.updateDeck(id, { archetype: archetype || null }); await loadMyDecks(); toast('Archetipo aggiornato', 'success') }
    catch (err) { toast(err.error || 'Errore aggiornamento', 'error') }
  }
  const deleteDeck = async (id, name) => {
    const ok = await confirm({ title: 'Eliminare il mazzo?', message: `"${name}" verrà eliminato definitivamente.`, confirmLabel: 'Elimina', danger: true })
    if (!ok) return
    try { await api.deleteDeck(id); await loadMyDecks(); toast('Mazzo eliminato', 'success') }
    catch (err) { toast(err.error || 'Errore nella cancellazione', 'error') }
  }

  // ── Avatar ──
  const fetchPrintings = async (name) => {
    if (!name) return
    setLoadingPrintings(true)
    setPrintings([])
    try {
      const results = await getCardPrintings(name)
      setPrintings(results)
      if (results.length === 1) setSelectedPrintingId(results[0].id)
    } catch { toast('Errore nel caricamento delle stampe', 'error') }
    finally { setLoadingPrintings(false) }
  }
  const openPicker = async () => {
    setPickerInput(avatarCard || '')
    setSelectedPrintingId(avatarScryfallId || null)
    setPrintings([])
    setPickerOpen(true)
    if (avatarCard) fetchPrintings(avatarCard)
  }
  const saveAvatar = async () => {
    const name = pickerInput.trim()
    if (!name || !selectedPrintingId) return
    setSavingAvatar(true)
    try {
      await api.updateProfile({ avatarCardName: name, avatarScryfallId: selectedPrintingId })
      setAvatarCard(name)
      setAvatarScryfallId(selectedPrintingId)
      updateUser({ avatarCardName: name, avatarScryfallId: selectedPrintingId })
      setPickerOpen(false)
      toast('Avatar aggiornato', 'success')
    } catch { toast("Errore nel salvataggio dell'avatar", 'error') }
    finally { setSavingAvatar(false) }
  }
  const removeAvatar = async () => {
    setSavingAvatar(true)
    try {
      await api.updateProfile({ avatarCardName: null, avatarScryfallId: null })
      setAvatarCard(null)
      setAvatarScryfallId(null)
      updateUser({ avatarCardName: null, avatarScryfallId: null })
      setPickerOpen(false)
      toast('Avatar rimosso', 'success')
    } catch { toast('Errore nella rimozione', 'error') }
    finally { setSavingAvatar(false) }
  }

  // ── Stili ──
  const card = {
    background: t.bgSurface,
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    padding: '1.15rem 1.35rem',
    marginBottom: 12,
    boxShadow: t.shadow,
  }
  const inputSt  = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', background: t.inputBg, color: t.text }
  const btnPrimary   = { padding: '9px 20px', background: t.primary, color: t.primaryFg, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
  const btnSecondary = { padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const btnDanger    = { padding: '5px 12px', background: t.dangerBg, color: t.danger, border: `0.5px solid ${t.dangerBorder}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }

  const backBtn = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <button onClick={() => navigate(-1)} style={btnSecondary}>← Indietro</button>
      {isOwnProfile && <button onClick={() => navigate('/guida')} style={btnSecondary}>? Guida</button>}
    </div>
  )

  if (loading) return (<div>{backBtn}<Skeleton h={140} r={16} style={{ marginBottom: 16 }} /><SkeletonList rows={4} /></div>)
  if (error)   return (<div>{backBtn}<EmptyState icon="⚠️" title="Errore" message={error} /></div>)
  if (!profile.player) return (<div>{backBtn}<EmptyState icon="🔍" title="Giocatore non trovato" message="Questo profilo non esiste o non ha ancora dati." /></div>)

  const { player, myGames, wins, total, winRate, streak, nemesis, favDeck, myDecks, trend, avgPlacement, firstOuts, placed, achievements, kills, deaths, archNemesis, favoritePrey, hasKillData } = profile

  // Hero card: avatar scelto, altrimenti commander del mazzo migliore
  const heroCard    = avatarCard || myDecks.find(d => d.commander)?.commander || null
  const hasArt      = !!heroCard
  const cdnArt      = (id) => `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`
  const heroImgSrc  = avatarScryfallId ? cdnArt(avatarScryfallId) : (avatarCard ? artUrl(avatarCard) : null)
  const fallbackSrc = !heroImgSrc && heroCard ? artUrl(heroCard) : null
  const bgSrc       = heroImgSrc || fallbackSrc

  const stat = (label, value, sub) => (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  )

  const GOLD        = '#E8B84B'
  const unlockedCount = achievements.filter(a => a.unlocked).length
  const secretTotal   = achievements.filter(a => a.secret).length
  const secretDone    = achievements.filter(a => a.secret && a.unlocked).length
  const nextAch       = achievements.find(a => !a.unlocked && !a.secret) || null
  const previewOrder  = [...achievements].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0))

  const achChip = (a) => {
    const hidden = a.secret && !a.unlocked
    const gold   = a.secret && a.unlocked
    return (
      <span key={a.id} title={hidden ? 'Achievement segreto' : a.title} style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        background: a.unlocked ? (gold ? GOLD + '22' : t.primaryBg) : t.bgMuted,
        border: `1px solid ${a.unlocked ? (gold ? GOLD + '88' : t.primaryBorder) : t.border}`,
        filter: a.unlocked ? 'none' : 'grayscale(1)', opacity: a.unlocked ? 1 : 0.5,
        boxShadow: gold ? `0 0 8px ${GOLD}55` : 'none',
      }}>{hidden ? '🔒' : a.icon}</span>
    )
  }

  const achTile = (a) => {
    const hidden = a.secret && !a.unlocked
    const gold   = a.secret && a.unlocked
    return (
      <div key={a.id} title={hidden ? 'Achievement segreto' : a.desc} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10,
        background: a.unlocked ? (gold ? GOLD + '1f' : t.primaryBg) : t.bgMuted,
        border: `1px solid ${a.unlocked ? (gold ? GOLD + '88' : t.primaryBorder) : (a.secret ? GOLD + '40' : t.border)}`,
        borderStyle: hidden ? 'dashed' : 'solid',
        opacity: a.unlocked ? 1 : 0.55,
        boxShadow: gold ? `0 0 10px ${GOLD}44` : 'none',
      }}>
        <span style={{ fontSize: 22, filter: a.unlocked ? 'none' : 'grayscale(1)' }}>{hidden ? '🔒' : a.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: a.unlocked ? (gold ? GOLD : t.text) : t.textSub }}>
            {hidden ? '???' : a.title}{gold && ' ✨'}
          </div>
          <div style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.25 }}>{hidden ? 'Achievement segreto' : a.desc}</div>
        </div>
      </div>
    )
  }

  const getDeckStat = (deckId) => deckStats.find(d => d.id === deckId) || { games: 0, wins: 0, winRate: 0 }

  return (
    <div>
      {backBtn}

      {/* ── HERO BANNER ── */}
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 12, minHeight: 130, boxShadow: t.shadow }}>
        {/* sfondo art sfocato */}
        {bgSrc && (
          <img
            src={bgSrc}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', filter: 'blur(14px) brightness(0.35)', transform: 'scale(1.15)', pointerEvents: 'none' }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: hasArt
            ? 'linear-gradient(135deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.15) 100%)'
            : t.bgSurface,
          border: `1px solid ${hasArt ? 'rgba(255,255,255,0.10)' : t.border}`,
          borderRadius: 16,
        }} />

        <div style={{ position: 'relative', padding: '20px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Avatar circolare */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
              border: `2.5px solid ${hasArt ? 'rgba(255,255,255,0.40)' : t.primaryBorder}`,
              background: t.primaryBg,
            }}>
              {heroImgSrc
                ? <img src={heroImgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} onError={() => { setAvatarCard(null); setAvatarScryfallId(null) }} />
                : fallbackSrc
                  ? <img src={fallbackSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: t.primary }}>
                      {player.username.substring(0, 2).toUpperCase()}
                    </div>
              }
            </div>
            {isOwnProfile && (
              <button
                onClick={openPicker}
                title="Cambia avatar"
                style={{
                  position: 'absolute', bottom: -1, right: -1,
                  width: 26, height: 26, borderRadius: '50%',
                  background: t.primary, color: t.primaryFg,
                  border: `2px solid ${hasArt ? 'rgba(0,0,0,0.55)' : t.bgSurface}`,
                  cursor: 'pointer', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              >✎</button>
            )}
          </div>

          {/* Nome + info */}
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: hasArt ? '#fff' : t.text, textShadow: hasArt ? '0 1px 6px rgba(0,0,0,0.6)' : 'none' }}>
              {player.username}
            </div>
            <div style={{ fontSize: 13, color: hasArt ? 'rgba(255,255,255,0.65)' : t.textSub }}>
              {total} partite giocate
            </div>
            {streak >= 2 && (
              <div style={{ fontSize: 12, fontWeight: 700, color: hasArt ? '#FFD580' : t.primary, marginTop: 2 }}>
                🔥 Streak attiva: {streak} vittorie di fila
              </div>
            )}
          </div>

          {/* Win rate % */}
          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: hasArt ? '#fff' : (winRate >= 50 ? t.win : t.primary), textShadow: hasArt ? '0 2px 10px rgba(0,0,0,0.5)' : 'none', flexShrink: 0 }}>
            {winRate}%
          </div>
        </div>
      </div>

      {/* ── STAGIONE CORRENTE (mini-card) ── */}
      {seasonData && (
        <div style={{ ...card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Stagione corrente</div>
            <div style={{ fontSize: 13, color: t.text, marginTop: 2, fontWeight: 500 }}>
              {seasonData.label} · Rank #{seasonData.rank} · {seasonData.points} punti
            </div>
          </div>
          {seasonData.qualified
            ? <span style={{ fontSize: 11, fontWeight: 700, color: t.win, background: t.winBg, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>qualificato ✓</span>
            : <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>non qualificato</span>
          }
          <button
            onClick={() => navigate('/gruppo?tab=stagione')}
            style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >Classifica →</button>
        </div>
      )}

      {/* ── ACHIEVEMENT ── */}
      <div id="achievements" style={{ ...card, cursor: achOpen ? 'default' : 'pointer', scrollMarginTop: 70 }} onClick={() => { if (!achOpen) setAchOpen(true) }}>
        <div onClick={(e) => { e.stopPropagation(); setAchOpen(o => !o) }} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Achievement</span>
          <span style={{ fontWeight: 500, color: t.textMuted, fontSize: 13 }}>· {unlockedCount}/{achievements.length}</span>
          {secretTotal > 0 && <span style={{ fontWeight: 600, color: GOLD, fontSize: 12 }}>✨ {secretDone}/{secretTotal} segreti</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: t.textSub, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {achOpen ? 'nascondi' : 'mostra'}
            <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: achOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
          </span>
        </div>
        {!achOpen && (
          <>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, overflow: 'hidden', maskImage: 'linear-gradient(to right, #000 78%, transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 78%, transparent)' }}>
              {previewOrder.map(achChip)}
            </div>
            {nextAch && (
              <div style={{ marginTop: 10, fontSize: 12, color: t.textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ opacity: 0.5 }}>{nextAch.icon}</span>
                <span>Prossimo: <strong style={{ color: t.text }}>{nextAch.title}</strong> — {nextAch.desc}</span>
              </div>
            )}
          </>
        )}
        {achOpen && (
          <div className="ct-section-open" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 12 }}>
            {achievements.map(achTile)}
          </div>
        )}
      </div>

      {/* ── MAZZI ── */}
      {isOwnProfile ? (
        /* Profilo proprio: gestione completa */
        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (showAddForm || myFullDecks.length > 0) ? 14 : 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>I miei mazzi</span>
            {myFullDecks.length > 0 && (
              <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>{myFullDecks.length}</span>
            )}
            <button
              onClick={() => setShowAddForm(v => !v)}
              style={{
                marginLeft: 'auto', padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${showAddForm ? t.dangerBorder : t.primary}`,
                background: showAddForm ? t.dangerBg : t.primaryBg,
                color: showAddForm ? t.danger : t.primary,
              }}
            >{showAddForm ? '✕ Annulla' : '+ Aggiungi'}</button>
          </div>

          {/* Form aggiungi mazzo */}
          {showAddForm && (
            <form onSubmit={submitAddDeck} style={{ background: t.bgMuted, borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Nuovo mazzo</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input style={inputSt} placeholder="Nome mazzo *" value={deckForm.name} onChange={e => setDeckForm(f => ({ ...f, name: e.target.value }))} />
                <CommanderInput
                  style={inputSt}
                  placeholder="Commander (opzionale)"
                  value={deckForm.commander}
                  onChange={(name) => setDeckForm(f => ({ ...f, commander: name }))}
                  onBlur={handleDeckCommanderBlur}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: t.textSub }}>
                  Colori:{detectingDeckColors && <span style={{ marginLeft: 5, fontSize: 11, color: t.primary }}>rilevamento...</span>}
                </span>
                {['W', 'U', 'B', 'R', 'G'].map(c => (
                  <button key={c} type="button" onClick={() => toggleDeckColor(c)} style={{
                    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, color: '#444', background: COLOR_MAP[c],
                    border: deckForm.colors.includes(c) ? `2px solid ${t.primary}` : '1px solid #ccc',
                    outline: deckForm.colors.includes(c) ? `2px solid ${t.primaryBorder}` : 'none',
                  }}>{c}</button>
                ))}
                <select style={{ ...inputSt, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={deckForm.bracket} onChange={e => setDeckForm(f => ({ ...f, bracket: e.target.value }))}>
                  <option value="">— livello</option>
                  {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
                </select>
                <select style={{ ...inputSt, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={deckForm.archetype} onChange={e => setDeckForm(f => ({ ...f, archetype: e.target.value }))}>
                  <option value="">— archetipo</option>
                  {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {deckFormError && <div style={{ color: t.danger, fontSize: 12, marginBottom: 8 }}>{deckFormError}</div>}
              <button type="submit" style={{ ...btnPrimary, fontSize: 13, padding: '8px 18px' }} disabled={addingDeck}>
                {addingDeck ? 'Salvataggio...' : '+ Crea mazzo'}
              </button>
            </form>
          )}

          {loadingDecks && <SkeletonList rows={2} />}
          {!loadingDecks && myFullDecks.length === 0 && (
            <EmptyState icon="🎴" title="Nessun mazzo" message="Aggiungi il tuo primo mazzo con il pulsante +." />
          )}
          {!loadingDecks && myFullDecks.map(deck => {
            const ds = getDeckStat(deck.id)
            return (
              <div key={deck.id} className="ct-lift ct-fade-up" style={{ borderRadius: 14, marginBottom: 10, overflow: 'hidden', border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                {deck.commander ? (
                  <div
                    onClick={() => navigate(`/mazzo/${deck.id}`)}
                    title="Apri profilo mazzo"
                    style={{ position: 'relative', height: 80, background: '#1a1640', overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <img
                      src={artUrl(deck.commander)}
                      alt=""
                      onError={e => { e.currentTarget.style.display = 'none' }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{deck.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{deck.commander}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {deck.archetype && <ArchetypeBadge archetype={deck.archetype} />}
                          {deck.bracket && <BracketBadge bracket={deck.bracket} />}
                        </div>
                        {deck.colors && <div style={{ display: 'flex', gap: 2 }}>{deck.colors.split('').map(c => <ColorPip key={c} c={c} />)}</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.bgSurface }}>
                    <div onClick={() => navigate(`/mazzo/${deck.id}`)} style={{ fontWeight: 600, fontSize: 14, color: t.text, cursor: 'pointer' }}>{deck.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {deck.archetype && <ArchetypeBadge archetype={deck.archetype} />}
                      {deck.bracket && <BracketBadge bracket={deck.bracket} />}
                    </div>
                  </div>
                )}
                {/* Toolbar */}
                <div style={{ padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', background: t.bgSurface, borderTop: deck.commander ? 'none' : `1px solid ${t.border}` }}>
                  {ds.games > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: ds.winRate >= 50 ? t.win : t.textSub, marginRight: 2, flexShrink: 0 }}>
                      {ds.winRate}% WR
                    </span>
                  )}
                  <select
                    value={deck.archetype || ''}
                    onChange={e => updateDeckArchetype(deck.id, e.target.value)}
                    style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 11, cursor: 'pointer', outline: 'none', flex: 1, minWidth: 0 }}
                  >
                    <option value="">— archetipo</option>
                    {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select
                    value={deck.bracket || ''}
                    onChange={e => updateDeckBracket(deck.id, e.target.value)}
                    style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 11, cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">— livello</option>
                    {BRACKET_OPTIONS.map(b => <option key={b} value={b}>B{b} · {BRACKETS[b].label}</option>)}
                  </select>
                  <DeckListPanel
                    decklist={deck.decklist}
                    commander={deck.commander}
                    name={deck.name}
                    onSave={async (newList, newCommander, newColors, newName) => {
                      await api.updateDeck(deck.id, { name: newName, decklist: newList, commander: newCommander, colors: newColors || undefined })
                      await loadMyDecks()
                      toast('Mazzo aggiornato', 'success')
                    }}
                  />
                  <button style={btnDanger} onClick={() => deleteDeck(deck.id, deck.name)}>Elimina</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Profilo altrui: read-only */
        <>
          {(() => {
            const best = myDecks.find(d => d.games > 0)
            if (!best) return null
            return (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>Miglior Mazzo</div>
                <div className="ct-lift" style={{ ...card, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(`/mazzo/${best.id}`)}>
                  <DeckThumb commander={best.commander} w={64} preview={false} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {best.name}
                      {best.colors && (
                        <span style={{ display: 'inline-flex', gap: 2 }}>
                          {best.colors.split('').map(c => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: COLOR_MAP[c] || '#eee', border: '1px solid rgba(0,0,0,0.15)' }} />)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub }}>{best.commander || 'Nessun commander'} · {best.wins}V / {best.games - best.wins}P su {best.games} partite</div>
                    <WinBar pct={best.winRate} t={t} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: best.winRate >= 50 ? t.win : t.primary, flexShrink: 0 }}>{best.winRate}%</div>
                </div>
              </>
            )
          })()}
          {myDecks.length > 1 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>
                Tutti i mazzi
                <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500, marginLeft: 6 }}>{myDecks.length}</span>
              </div>
              {myDecks.map(d => (
                <div key={d.id} className="ct-lift" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }} onClick={() => navigate(`/mazzo/${d.id}`)}>
                  <DeckThumb commander={d.commander} w={36} preview={false} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{d.commander || '—'}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: d.games === 0 ? t.textMuted : d.winRate >= 50 ? t.win : t.primary, flexShrink: 0 }}>
                    {d.games === 0 ? 'n/a' : `${d.winRate}%`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SCONTRI DIRETTI ── */}
      {opponents.length > 0 && (
        <div style={card}>
          <div onClick={() => setShowRivalita(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Scontri diretti ⚔️</span>
            <span style={{ fontSize: 12, color: t.textMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {showRivalita ? 'nascondi' : `${opponents.length} avversari`}
              <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: showRivalita ? 'rotate(90deg)' : 'none' }}>▸</span>
            </span>
          </div>
          {showRivalita && h2h && (
            <div className="ct-section-open" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: t.textSub }}>vs</span>
                <select
                  value={rivalId || ''}
                  onChange={e => setRivalId(Number.parseInt(e.target.value, 10))}
                  style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                >
                  {opponents.map(o => <option key={o.id} value={o.id}>{o.username}</option>)}
                </select>
                <span style={{ fontSize: 12, color: t.textMuted }}>{h2h.shared.length} partite insieme</span>
              </div>
              {(() => {
                const decided = h2h.meBetter + h2h.oppBetter
                const mePct   = decided ? Math.round(h2h.meBetter / decided * 100) : 50
                const row = (label, a, b) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `0.5px solid ${t.border}` }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: t.text, minWidth: 30, textAlign: 'left' }}>{a}</span>
                    <span style={{ fontSize: 12, color: t.textSub }}>{label}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: t.text, minWidth: 30, textAlign: 'right' }}>{b}</span>
                  </div>
                )
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: t.primary, fontSize: 14 }}>{player.username}</span>
                      <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>{h2h.rival?.username}</span>
                    </div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ width: `${mePct}%`, background: t.primary }} />
                      <div style={{ width: `${100 - mePct}%`, background: t.bgMuted }} />
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: t.textMuted, marginBottom: 12 }}>chi finisce più in alto</div>
                    {row('arrivato più in alto', h2h.meBetter, h2h.oppBetter)}
                    {row('vittorie del pod', h2h.myWins, h2h.oppWins)}
                    {row('eliminazioni inflitte ⚔️', h2h.myKills, h2h.oppKills)}
                    {h2h.undecided > 0 && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>{h2h.undecided} partite senza ordine di uscita non assegnate.</div>}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── STATISTICHE DETTAGLIATE ── */}
      {total > 0 && (
        <div style={card}>
          <div onClick={() => setShowStats(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Statistiche dettagliate</span>
            <span style={{ fontSize: 12, color: t.textMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {showStats ? 'nascondi' : 'vittorie, kill, trend'}
              <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: showStats ? 'rotate(90deg)' : 'none' }}>▸</span>
            </span>
          </div>
          {showStats && (
            <div className="ct-section-open" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                {stat('Vittorie', wins, `${total - wins} sconfitte`)}
                {stat('Nemesi', nemesis ? nemesis[0] : '—', nemesis ? `ti ha battuto ${nemesis[1]} volte` : 'nessuna')}
                {stat('Mazzo preferito', favDeck ? favDeck[0] : '—', favDeck ? `${favDeck[1]} partite` : '')}
                {stat('Piazz. medio', avgPlacement ? avgPlacement.toFixed(1) + '°' : '—', placed.length ? `su ${placed.length} partite` : 'nessun dato')}
                {stat('Primo eliminato', placed.length ? `${firstOuts}×` : '—', placed.length ? 'volte fuori per primo' : 'nessun dato')}
              </div>
              {hasKillData && (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 12, borderTop: `0.5px solid ${t.border}`, marginBottom: 12 }}>
                  {stat('⚔️ Kill', kills, 'giocatori eliminati')}
                  {stat('💀 Morti', deaths, 'volte eliminato')}
                  {stat('😈 Arcinemico', archNemesis ? archNemesis[0] : '—', archNemesis ? `ti ha eliminato ${archNemesis[1]}×` : 'nessuno')}
                  {stat('🎯 Preda preferita', favoritePrey ? favoritePrey[0] : '—', favoritePrey ? `eliminato ${favoritePrey[1]}×` : 'nessuna')}
                </div>
              )}
              {trend.length >= 2 && (
                <div style={{ paddingTop: 12, borderTop: `0.5px solid ${t.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Andamento win rate</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>win rate cumulativo · {trend.length} partite</div>
                  {(() => {
                    const W = 600, H = 120, pad = 6, n = trend.length
                    const x = (i) => pad + (i / (n - 1)) * (W - pad * 2)
                    const y = (v) => pad + (1 - v / 100) * (H - pad * 2)
                    const line = trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
                    const area = `${line} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`
                    return (
                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
                        <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={t.border} strokeWidth="1" strokeDasharray="4 4" />
                        <defs><linearGradient id="ct-trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.primary} stopOpacity="0.30" /><stop offset="100%" stopColor={t.primary} stopOpacity="0" /></linearGradient></defs>
                        <path d={area} fill="url(#ct-trend)" />
                        <path d={line} fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                        <circle cx={x(n - 1)} cy={y(trend[n - 1])} r="4" fill={t.primary} />
                      </svg>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STORICO PARTITE ── */}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '20px 0 10px' }}>Storico partite</div>
      {myGames.length === 0 ? (
        <EmptyState icon="🃏" title="Nessuna partita" message="Questo giocatore non ha ancora giocato." />
      ) : (
        myGames.map(g => {
          const me     = g.players.find(p => p.user.id === pid)
          const won    = me?.isWinner
          const winner = g.players.find(p => p.isWinner)
          const date   = new Date(g.playedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
          return (
            <div key={g.id} style={{ ...card, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: t.textMuted }}>{date} · {g.players.length} giocatori</div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: won ? t.winBg : t.bgMuted, color: won ? t.win : t.textSub }}>
                  {won ? 'Vittoria' : 'Sconfitta'}{me?.placement ? ` · ${me.placement}°` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DeckThumb commander={me?.deck.commander} w={32} />
                <div style={{ fontSize: 13, color: t.text }}>
                  {me?.deck.name}
                  {!won && winner && <span style={{ color: t.textSub }}> · ha vinto {winner.user.username} ({winner.deck.name})</span>}
                </div>
              </div>
              {g.notes && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontStyle: 'italic' }}>{g.notes}</div>}
            </div>
          )
        })
      )}

      {/* ── LOGOUT ── */}
      {isOwnProfile && (
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${t.border}`, textAlign: 'center' }}>
          <button
            onClick={logout}
            style={{
              padding: '10px 28px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted,
              transition: 'all 0.18s ease',
            }}
          >
            Esci dall'account
          </button>
        </div>
      )}

      {/* ── AVATAR PICKER MODAL ── */}
      {pickerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPickerOpen(false)}
        >
          <div
            style={{ background: t.bgSurface, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${t.border}`, borderRadius: 18, padding: 20, maxWidth: 400, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 3 }}>Scegli il tuo avatar</div>
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 14 }}>
              Cerca una carta Magic e scegli la stampa che preferisci.
            </div>

            {/* Ricerca */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <CommanderInput
                  value={pickerInput}
                  onChange={(name) => { setPickerInput(name); setPrintings([]); setSelectedPrintingId(null) }}
                  placeholder="Cerca una carta Magic..."
                  style={{ ...inputSt, fontSize: 13 }}
                />
              </div>
              <button
                onClick={() => fetchPrintings(pickerInput.trim())}
                disabled={!pickerInput.trim() || loadingPrintings}
                style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${t.primary}`, background: t.primaryBg, color: t.primary, fontWeight: 700, fontSize: 13, cursor: pickerInput.trim() && !loadingPrintings ? 'pointer' : 'default', whiteSpace: 'nowrap', flexShrink: 0 }}
              >{loadingPrintings ? '…' : 'Cerca →'}</button>
            </div>

            {/* Griglia stampe */}
            {printings.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 8 }}>
                  {printings.length} stampa{printings.length !== 1 ? '' : 'e'} — clicca per selezionare
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                  {printings.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPrintingId(p.id)}
                      style={{
                        padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                        background: 'transparent', outline: 'none',
                        border: `2px solid ${selectedPrintingId === p.id ? t.primary : t.border}`,
                        boxShadow: selectedPrintingId === p.id ? `0 0 0 2px ${t.primaryBorder}` : 'none',
                        transition: 'border-color 0.12s',
                      }}
                    >
                      <img src={p.artCropUrl} alt={p.setName} style={{ width: '100%', height: 68, objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }} />
                      <div style={{ fontSize: 9, color: t.textSub, padding: '3px 5px', background: t.bgMuted, lineHeight: 1.3, textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: t.textSub }}>{p.setCode}</div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.artist}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {printings.length === 0 && !loadingPrintings && pickerInput.trim() && (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: t.textMuted, marginBottom: 14 }}>
                Clicca "Cerca →" per vedere le stampe disponibili
              </div>
            )}

            {/* Azioni */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                style={{ ...btnPrimary, flex: 1, minWidth: 0 }}
                onClick={saveAvatar}
                disabled={!pickerInput.trim() || !selectedPrintingId || savingAvatar}
              >
                {savingAvatar ? 'Salvataggio...' : 'Usa come avatar'}
              </button>
              {avatarCard && (
                <button style={btnDanger} onClick={removeAvatar} disabled={savingAvatar}>Rimuovi</button>
              )}
              <button style={btnSecondary} onClick={() => setPickerOpen(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
