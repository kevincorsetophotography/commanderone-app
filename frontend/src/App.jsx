import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'

function RedirectWithSearch({ to }) {
  const { search } = useLocation()
  return <Navigate to={to + search} replace />
}
import { AuthProvider, useAuth } from './hooks/useAuth'
import { GroupProvider, useGroup } from './hooks/useGroup'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { FeedbackProvider } from './hooks/useFeedback'
import { useIsMobile } from './hooks/useIsMobile'
import Login from './pages/Login'
import OnboardingPage from './pages/OnboardingPage'
import DecksPage from './pages/DecksPage'
import NewGamePage from './pages/NewGamePage'
import DashboardPage from './pages/DashboardPage'
import FeedPage from './pages/FeedPage'
import GruppoPage from './pages/GruppoPage'
import AdminPage from './pages/AdminPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import DeckProfilePage from './pages/DeckProfilePage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import GamePage from './pages/GamePage'
import JudgePage from './pages/JudgePage'
import GiocaPage from './pages/GiocaPage'
import GuidaPage from './pages/GuidaPage'
import AccountPage from './pages/AccountPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import NotificationBell from './components/NotificationBell'
import PlayerAvatar from './components/PlayerAvatar'
import { KOFI_URL } from './lib/links'

function NavItem({ to, end, children }) {
  const { t } = useTheme()
  const [hover, setHover] = useState(false)
  return (
    <NavLink
      to={to}
      end={end}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={({ isActive }) => ({
        padding: '7px 15px',
        borderRadius: 10,
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        background: isActive ? t.primary : hover ? t.bgMuted : 'transparent',
        color: isActive ? t.primaryFg : hover ? t.text : t.textSub,
        boxShadow: isActive ? t.glow : 'none',
        transition: 'all 0.18s ease',
      })}
    >
      {children}
    </NavLink>
  )
}

function IconButton({ onClick, title, children }) {
  const { t } = useTheme()
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 12px',
        border: `1px solid ${hover ? t.borderStrong : t.border}`,
        borderRadius: 10,
        background: hover ? t.bgMuted : t.bgSurfaceAlt,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        color: t.textSub,
        transition: 'all 0.18s ease',
      }}
    >
      {children}
    </button>
  )
}

// Stessa forma di IconButton ma colorata (accent) e come link esterno, non
// bottone — sempre visibile in navbar apposta, ma resta solo un'icona in
// più: chi non è interessato la ignora senza sforzo.
function SupportIcon() {
  const { t } = useTheme()
  const [hover, setHover] = useState(false)
  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Sostieni CommanderOne su Ko-fi"
      aria-label="Sostieni CommanderOne su Ko-fi"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 12px',
        border: `1px solid ${t.accent}`,
        borderRadius: 10,
        background: hover ? t.accent : 'transparent',
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1,
        color: hover ? '#1a1206' : t.accent,
        textDecoration: 'none',
        transition: 'all 0.18s ease',
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      ☕
    </a>
  )
}

function Brand({ logoSize = 42, titleSize = 14, compact = false }) {
  const { t, dark } = useTheme()
  const { activeGroup } = useGroup()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <img
        src="/icon-192.png"
        alt="CommanderOne"
        onError={e => { e.currentTarget.style.display = 'none' }}
        style={{ height: logoSize, width: logoSize, objectFit: 'contain', borderRadius: logoSize * 0.22, filter: dark ? `drop-shadow(0 0 10px ${t.primaryBorder})` : 'none' }}
      />
      {!compact && (
        <div style={{ lineHeight: 1.12 }}>
          <div style={{ fontWeight: 900, fontSize: titleSize, letterSpacing: '0.02em' }}>
            <span style={{ color: t.text }}>Commander</span>
            <span className={`ct-wordmark ${dark ? 'dark' : 'light'}`}>One</span>
          </div>
          {activeGroup && (
            <div style={{ fontSize: titleSize * 0.64, color: t.textMuted, letterSpacing: '0.1em', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeGroup.name.toUpperCase()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Avatar + username, riusato in alto a destra.
function UserChip({ titleSize = 13, avatar = 26, hideLabel = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTheme()
  return (
    <span
      onClick={() => user?.id && navigate(`/giocatore/${user.id}`)}
      title="Vai al tuo profilo"
      style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, cursor: 'pointer' }}
    >
      <PlayerAvatar username={user?.username} avatarCardName={user?.avatarCardName} avatarScryfallId={user?.avatarScryfallId} size={avatar} highlight />
      {!hideLabel && (
        <span style={{ fontSize: titleSize, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.username}
        </span>
      )}
    </span>
  )
}

function GroupSwitcher() {
  const { groups, activeGroup, selectGroup } = useGroup()
  const { t } = useTheme()
  if (!groups || groups.length <= 1) return null
  return (
    <select
      value={activeGroup?.slug || ''}
      onChange={e => selectGroup(e.target.value)}
      title="Cambia gruppo"
      style={{
        padding: '6px 10px', borderRadius: 10, border: `1px solid ${t.border}`,
        background: t.bgSurfaceAlt, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        maxWidth: 140,
      }}
    >
      {groups.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
    </select>
  )
}

const DOCK_ICONS = {
  feed: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  gioca: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="4" width="8" height="14" rx="1.5" transform="rotate(-18 12 18)"/>
      <rect x="8" y="4" width="8" height="14" rx="1.5" transform="rotate(18 12 18)"/>
      <rect x="8" y="3" width="8" height="15" rx="1.5"/>
      <path d="M12,8.5 L13.3,11 L12,13.5 L10.7,11 Z" strokeWidth="1.2"/>
    </svg>
  ),
  eventi: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  gruppo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  io: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
}

function DockItem({ to, end, icon, label }) {
  const { t } = useTheme()
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        flex: 1, minWidth: 0, textDecoration: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        minHeight: 56, padding: '8px 2px', borderRadius: 14,
        color: isActive ? t.primary : t.textSub,
        background: isActive ? t.primaryBg : 'transparent',
        transition: 'color 0.15s ease, background 0.15s ease',
      })}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>{label}</span>
    </NavLink>
  )
}

function Layout() {
  const { user, logout } = useAuth()
  const { activeGroup } = useGroup()
  const { t, dark, toggleDark } = useTheme()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const isGroupAdmin = activeGroup?.role === 'ADMIN'

  const routes = (
    <Routes>
      <Route path="/"              element={<FeedPage />} />
      <Route path="/gruppo"        element={<GruppoPage />} />
      {/* Gioca: nuova landing */}
      <Route path="/gioca"         element={<GiocaPage />} />
      <Route path="/eventi"        element={<EventsPage />} />
      {/* Redirect /tornei → /eventi per retrocompatibilità deep-link */}
      <Route path="/tornei"        element={<RedirectWithSearch to="/eventi" />} />
      <Route path="/giocatore/:id" element={<PlayerProfilePage />} />
      <Route path="/mazzo/:id"     element={<DeckProfilePage />} />
      <Route path="/mazzi"         element={<DecksPage />} />
      <Route path="/partita/:id"   element={<GamePage />} />
      <Route path="/evento/:id"    element={<EventDetailPage />} />
      <Route path="/nuova-partita" element={<NewGamePage />} />
      <Route path="/giudice"       element={<JudgePage />} />
      <Route path="/guida"         element={<GuidaPage />} />
      <Route path="/account"       element={<AccountPage />} />
      <Route path="/admin"         element={isGroupAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
    </Routes>
  )

  const navBar = {
    background: t.bgNav,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    borderBottom: `1px solid ${t.border}`,
    position: 'sticky', top: 0, zIndex: 20,
  }

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', color: t.text }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {isMobile ? (
          /* ── HEADER MOBILE (singola riga) ── */
          <div style={{ ...navBar, padding: '0 0.75rem', paddingTop: 'env(safe-area-inset-top)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
              <div style={{ minWidth: 0, overflow: 'hidden', flexShrink: 1 }}>
                <Brand logoSize={30} titleSize={12} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <GroupSwitcher />
                <NotificationBell />
                {isGroupAdmin && (
                  <NavLink to="/admin" style={({ isActive }) => ({
                    padding: '6px 10px', borderRadius: 10, textDecoration: 'none', fontSize: 12, fontWeight: 600,
                    background: isActive ? t.primary : t.bgSurfaceAlt, color: isActive ? t.primaryFg : t.textSub,
                    border: `1px solid ${t.border}`,
                  })}>Admin</NavLink>
                )}
                <SupportIcon />
                <IconButton onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '🌙'}</IconButton>
                <IconButton onClick={() => navigate('/account')} title="Account">⚙</IconButton>
                <UserChip avatar={26} hideLabel />
              </div>
            </div>
          </div>
        ) : (
          /* ── NAVBAR DESKTOP ── */
          <div style={{ ...navBar, padding: '0 1rem' }}>
            <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 62, padding: '8px 0', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ marginRight: 8 }}><Brand /></div>
                <NavItem to="/" end>Feed</NavItem>
                <NavItem to="/gioca">Gioca</NavItem>
                <NavItem to="/eventi">Eventi</NavItem>
                <NavItem to="/gruppo">Gruppo</NavItem>
                <NavItem to="/mazzi">Mazzi</NavItem>
                {isGroupAdmin && <NavItem to="/admin">Admin</NavItem>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GroupSwitcher />
                <UserChip />
                <NotificationBell />
                <SupportIcon />
                <IconButton onClick={toggleDark} title={dark ? 'Passa a light mode' : 'Passa a dark mode'}>{dark ? '☀' : '🌙'}</IconButton>
                <IconButton onClick={() => navigate('/account')} title="Impostazioni account">⚙</IconButton>
                <IconButton onClick={logout} title="Esci">Esci</IconButton>
              </div>
            </div>
          </div>
        )}

        {/* Contenuto — key sul gruppo attivo: cambiare gruppo rimonta le pagine e forza il refetch */}
        <div key={activeGroup?.slug} style={{ maxWidth: 980, margin: '0 auto', padding: isMobile ? '1rem 0.85rem calc(104px + env(safe-area-inset-bottom))' : '1.75rem 1rem 3rem' }}>
          {routes}
          <FanContentDisclaimer t={t} />
        </div>
      </div>

      {/* ── DOCK MOBILE ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: t.bgNav,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          borderTop: `1px solid ${t.border}`,
          display: 'flex', gap: 4,
          padding: '6px 8px calc(6px + env(safe-area-inset-bottom)) 8px',
        }}>
          <DockItem to="/" end icon={DOCK_ICONS.feed} label="Feed" />
          <DockItem to="/gioca"  icon={DOCK_ICONS.gioca} label="Gioca" />
          <DockItem to="/eventi" icon={DOCK_ICONS.eventi} label="Eventi" />
          <DockItem to="/gruppo" icon={DOCK_ICONS.gruppo} label="Gruppo" />
          <DockItem to={`/giocatore/${user?.id}`} icon={DOCK_ICONS.io} label="Io" />
        </div>
      )}
    </div>
  )
}

function FanContentDisclaimer({ t }) {
  return (
    <div style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${t.border}`, fontSize: 10.5, color: t.textMuted, lineHeight: 1.5, textAlign: 'center' }}>
      CommanderOne è Fan Content non ufficiale, permesso dalla Fan Content Policy di Wizards of the Coast.
      Non è approvato/sostenuto da Wizards. Le porzioni di proprietà di Wizards sono ©Wizards of the Coast LLC.
      <br />
      <Link to="/privacy" style={{ color: t.textMuted }}>Privacy Policy</Link> · <Link to="/termini" style={{ color: t.textMuted }}>Termini di Servizio</Link>
      {' '}· <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" style={{ color: t.textMuted }}>☕ Sostieni il progetto</a>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

// Dentro l'area autenticata: se l'utente non ha ancora nessun gruppo, mostra
// l'onboarding (crea/unisciti) invece del layout normale con le route dell'app.
function GroupGate() {
  const { loading, groups } = useGroup()
  const { t } = useTheme()

  if (loading) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSub }}>Caricamento…</div>
  }
  if (!groups || groups.length === 0) {
    return <OnboardingPage />
  }
  return <Layout />
}

export default function App() {
  return (
    <ThemeProvider>
      <FeedbackProvider>
        <AuthProvider>
          <GroupProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login"          element={<Login />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email"   element={<VerifyEmailPage />} />
                {/* Pubbliche apposta: chi valuta l'app prima di registrarsi (o una
                    store review) deve poterle leggere senza avere un account. */}
                <Route path="/privacy"        element={<PrivacyPage />} />
                <Route path="/termini"        element={<TermsPage />} />
                <Route path="/*"              element={<PrivateRoute><GroupGate /></PrivateRoute>} />
              </Routes>
            </BrowserRouter>
          </GroupProvider>
        </AuthProvider>
      </FeedbackProvider>
    </ThemeProvider>
  )
}
