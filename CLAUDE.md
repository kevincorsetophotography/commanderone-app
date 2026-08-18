# CLAUDE.md — CommanderOne

Tracker **sociale** di partite Magic: The Gathering / Commander (EDH), multi-tenant: chiunque può creare o unirsi a un **Gruppo** (playgroup) indipendente, con membri/mazzi/partite/eventi isolati dagli altri gruppi.

> Questo progetto è un **fork** di Commanderone (il tracker personale per il gruppo di Villastellone, `../commander-tracker`), riprogettato come prodotto generico da distribuire su store. I due progetti sono separati: nessuna cronologia git condivisa, nessun dato condiviso.

---

## Vincoli legali — LEGGERE PRIMA DI PROGETTARE MONETIZZAZIONE

Il progetto dipende strutturalmente da dati di Wizards of the Coast (tramite l'API Scryfall). Sia la **Fan Content Policy** di Wizards sia i **Termini Scryfall** vietano esplicitamente di mettere l'app o i suoi contenuti dietro un paywall — niente app a pagamento, niente abbonamento per le funzioni core, niente IAP che sblocca dati di gioco. Non esiste soglia di fatturato che faccia eccezione.

**Monetizzazione compliant**: ads non invasive + donazioni/Patreon + IAP "rimuovi pubblicità"/supporter che sblocca solo funzioni **scollegate dai dati Magic** (es. gruppi multipli, backup cloud, temi). Nessuna feature core mai dietro paywall. Vedi anche il disclaimer Fan Content Policy già presente in `App.jsx`, `Login.jsx`, `OnboardingPage.jsx`.

---

## Stack & deploy

- **Frontend**: React 18 + Vite 5, `react-router-dom` 6, stili inline (niente CSS framework), tema dark/light. Test: Vitest 2.
- **Backend**: Node + Express + **Prisma 5** + **PostgreSQL**. Auth JWT + bcrypt. Test: Vitest 2.
- **Deploy**: non ancora configurato per questo progetto (nessun Railway/Vercel collegato). Quando si configura, replicare il pattern di Commanderone (`start:prod` = `prisma db push --accept-data-loss && index.js`; niente più `ensureAdmin`/migrazioni legacy, il bootstrap admin non serve più — l'ADMIN di un gruppo nasce da chi lo crea).
- **Node 18** in locale.

## Ambiente di sviluppo locale

- `cd backend && npm run dev` → `scripts/dev.mjs`: Postgres embedded su **:5433**, `db push`, seed se vuoto, poi nodemon su **:3001**.
  - Seed (`prisma/seed.mjs`): crea **2 gruppi demo indipendenti** ("Demo Playgroup A" 6 giocatori/34 partite, "Demo Playgroup B" 4 giocatori/20 partite) per verificare a occhio l'isolamento multi-tenant. Password di tutti gli utenti: `test`. Invite code stampati a console a ogni seed (cambiano a ogni riavvio con DB vuoto).
- Frontend: `cd frontend && npx vite --host` (:5173) → `http://localhost:3001/api`.
- `.env` backend (gitignored): `DATABASE_URL`, `JWT_SECRET` (≥32 char), `PORT`, `FRONTEND_URL`, `GROQ_API_KEY` (Judge Bot, opzionale — senza, fallback gratuito senza LLM), `JUDGE_DAILY_LLM_CAP` (tetto giornaliero domande AI, default 300), `RESEND_API_KEY`/`MAIL_FROM` (email transazionali, opzionali in locale — senza, le email si stampano in console). **Non serve più `INVITE_CODE`** (era globale, ora ogni gruppo ha il proprio codice in DB) né `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

---

## Multi-tenancy — il cuore dell'architettura

- **`Group`**: entità first-class. `slug` (unique, usato nell'URL API), `inviteCode` (unique, rigenerabile). Ogni `Deck`, `Game`, `Event`, `JudgeQuestion`, `AchievementUnlock` ha `groupId`.
- **`GroupMember`**: join table User↔Group con `role` (PLAYER|ADMIN) **scoped al gruppo**, non più globale. `User` non ha più un campo `role` — un utente può essere ADMIN nel proprio gruppo e PLAYER in un altro.
- **`User.username` resta univoco globalmente** (un account, molti gruppi, login sempre per username). Email richiesta alla registrazione: verifica indirizzo, reset e cambio password sono tutti self-service (`lib/authTokens.js`, `lib/mailer.js`). Cancellazione account self-service (`lib/accountDeletion.js`) — vedi sotto.
- **Route mounting**: `/api/auth/*` (account, senza gruppo) e `/api/groups` (crea/unisciti/mine) sono globali; tutto il resto vive sotto `/api/groups/:slug/*`, con middleware `resolveGroup` (verifica membership, 403 se non membro, attacca `req.group`/`req.membership`) seguito da `requireGroupAdmin` dove serve.
- **Achievement per-gruppo**: `AchievementUnlock` ha `@@unique([groupId, userId, achievementId])` — un giocatore in due gruppi ha progressi indipendenti in ciascuno. `loadData(prisma, groupId)` in `achievements.js` filtra sempre per gruppo.
- **Frontend**: `hooks/useGroup.jsx` (context) gestisce la lista gruppi dell'utente, il gruppo attivo (persistito in `localStorage` come `ct_active_group`) e lo switcher. `lib/api.js` prefissa automaticamente le chiamate group-scoped con `/groups/${activeGroupSlug}`. `App.jsx` mostra `OnboardingPage` (crea/unisciti) se l'utente ha zero gruppi.
- **Onboarding**: `POST /api/auth/register` crea solo l'account (nessun invite code). Il gruppo si crea (`POST /api/groups`, il creatore diventa ADMIN) o si raggiunge (`POST /api/groups/join {inviteCode}`) in un secondo momento.
- **Cancellazione account** (`lib/accountDeletion.js`): non un semplice `DELETE FROM User` — lo storico partite è condiviso con altri giocatori. Righe puramente personali (membership, commenti, reazioni, notifiche, achievement) cascatano via schema; mazzi/partecipazioni/eventi usati in partite condivise vengono riassegnati a un utente "fantasma" (`[utente eliminato]`) condiviso da tutte le cancellazioni, così lo storico degli altri giocatori resta intatto. Bloccata solo se sei l'unico admin di un gruppo con altri membri.

## API backend — endpoint principali

```
POST   /api/auth/register            {username, email, password}
POST   /api/auth/login               {username (o email), password}
GET    /api/auth/me                  profilo esteso (per la pagina Account)
POST   /api/auth/verify-email        {token}
POST   /api/auth/resend-verification (autenticato)
POST   /api/auth/forgot-password     {email} — risposta sempre uguale, no user enumeration
POST   /api/auth/reset-password      {token, newPassword}
PATCH  /api/auth/password            {currentPassword, newPassword} (autenticato)
PATCH  /api/auth/profile             (avatar)
DELETE /api/auth/account             {password} — cancellazione self-service, vedi sopra

POST /api/groups               {name} → crea gruppo, creatore = ADMIN
POST /api/groups/join          {inviteCode}
GET  /api/groups/mine
POST /api/groups/:slug/invite-code/regenerate   (admin del gruppo)

# tutto il resto sotto /api/groups/:slug/... (richiede membership)
/decks, /games (+ commenti/reazioni; GET supporta ?page&pageSize opzionali), /stats,
/events (+ tornei), /notifications, /judge (risponde con llmUsed:false in fallback
gratuito se il tetto giornaliero è esaurito o Groq non risponde)
/admin/export, /admin/members (GET/PATCH ruolo/DELETE rimuovi — gestione membri, NON più creazione utenti/cambio password: quello è self-service)

/api/scryfall/art     (globale, non autenticato — proxy immagini Scryfall)
```

## Cosa è cambiato rispetto a Commanderone (per chi conosce il progetto originale)

- Niente più admin globale hardcoded (`ensureAdmin.js` rimosso) — l'ADMIN è per-gruppo.
- `decks.js`/`gamesV2.js`/`stats.js`/`events.js`/`admin.js`: ogni query ora filtra per `groupId`. `AdminPage.jsx` gestisce membri del gruppo (ruolo, rimozione, codice invito), non più CRUD utenti globale con password.
- Brand: nome **CommanderOne**, palette blu/ambra (`theme.js`). Icona app reale (monogramma "C1" neon, coerente col wordmark CSS) al posto del placeholder ffmpeg.
- `GUIDA_UTENTE.md` riscritta da zero, generica (nessuno screenshot ancora — quelli di Commanderone erano specifici di Villastellone). Stesso trattamento per `PRIVACY_POLICY.md`/`TERMINI_SERVIZIO.md` (vedi Roadmap: titolare/contatto/hosting/legge applicabile restano segnaposto da completare prima della pubblicazione).
- Logica pura invariata 1:1: `seasons.js`, `achievements.js` (frontend), `tournament.js`, `judge.js` — ricevono dati già scoped per gruppo dal backend, nessuna modifica strutturale necessaria.

---

## Roadmap

> Stato aggiornato al 18/08/2026. Tutto il lavoro sotto è in `main`.

### Fatto di recente
- Verifica email, reset/cambio password self-service, validazione username, cancellazione account self-service (GDPR — vedi sezione Multi-tenancy per il meccanismo "utente fantasma").
- Multi-gruppo: entry point in `AccountPage` per unirsi/creare un gruppo oltre al primo (backend e switcher lo supportavano già).
- Icona app reale, Privacy Policy + Termini di Servizio (con segnaposto legali ancora da completare, vedi sopra).
- Judge Bot: modello Groq dismesso sostituito, tetto di costo giornaliero globale (`JUDGE_DAILY_LLM_CAP`), fallback gratuito senza LLM quando il tetto è esaurito o Groq non risponde.
- Test di integrazione HTTP (supertest + Postgres embedded dedicato, `backend/test/`) — 37 test: auth, gruppi, `resolveGroup`/`requireGroupAdmin`, isolamento multi-tenant, cancellazione account.
- Paginazione opzionale `GET /api/groups/:slug/games` (retrocompatibile — vedi sopra). `api.getGamesPage()` esiste lato frontend ma **nessuna pagina lo usa ancora**.
- Link donazioni Ko-fi (`lib/links.js`, footer + pagina Account + card chiudibile in cima al Feed con snooze 30gg via `SupportBanner.jsx`) — chiudeva l'ultima voce economica in "Prossimi". Primo modo per validare se la community sostiene il progetto prima di investire in ads/IAP. (Un'icona in navbar era stata provata e scartata: affollava troppo, specie su mobile.)
- **i18n Fase 1** (react-i18next + `locales/it.json`/`en.json`): flusso auth completo in IT/EN — Login, Onboarding, Account (con selettore lingua), `GroupJoinCreateForm`. Backend `/api/auth/*` migrato a codici errore (`validators.js`, `routes/auth.js`, `lib/accountDeletion.js`) invece di frasi italiane pronte, tradotti lato client via `lib/apiError.js`. Il resto del backend (14 file, ~150 messaggi) non è ancora migrato e continua a restituire italiano diretto — `apiError.js` lo passa attraverso intatto (nessuna regressione), ma per quelle route la UI resta italiana anche in modalità EN. Convenzione per le fasi successive: `useTheme()` usa già `t` per i token colore ovunque nel progetto, quindi `useTranslation()` va sempre aliasato `tr`.

### Prossimi
- Wiring UI della paginazione partite (vedi sopra) — solo se/quando lo storico di un gruppo reale inizia a diventare pesante da caricare tutto insieme.

### i18n Fase 2 — il resto dell'app (in corso)
Stesso pattern della Fase 1 (codici errore dal backend, `t`→`tr` per non fare ombra al tema, `locales/it.json`/`en.json`), applicato schermata per schermata. Nessuna nuova libreria da installare. Va prima di ads/Capacitor, non dopo — è la porta d'ingresso per qualunque mercato non italiano.

**Già convertiti** (oltre alla Fase 1): componenti condivisi `NotificationBell`/`GameSocial`/`DeckListPanel`/`BracketBadge`, `FeedPage` (la pagina più vista), `VerifyEmailPage`/`ResetPasswordPage` (flusso auth rimasto fuori dalla Fase 1 per errore), `GamePage`, `GiocaPage`, `DecksPage`, `EventsPage`, `JudgePage`, `GruppoPage`.

Estrazioni di supporto nate durante la conversione: `lib/timeAgo.js` (tempo relativo minuti/ore/giorni, era duplicato in 2 componenti), `lib/ordinal.js` (piazzamento "1°" it / "1st" en — pattern `${n}°` ancora duplicato in ~9 file non convertiti: Dashboard, Gruppo, Admin, PlayerProfile, DeckProfile, NewGame, EventDetail, SeasonRecap — da consolidare quando tocca a quei file), `bracketLabel()` in `lib/brackets.js` (vedi sotto). Namespace `common` avviato con `back`/`edit`/`delete`/`cancel`/`loading` — non retroattivo sui file già convertiti prima che esistesse (tengono le proprie chiavi scoped-per-pagina, es. `decksPage.delete`), da riusare per i file ancora da fare.

**Nota strutturale — risolta per i bracket, aperta per le stagioni**: `lib/brackets.js` aveva lo stesso problema di `lib/seasons.js` sotto (costante non-componente con label già tradotta in italiano) — risolto con `bracketLabel(id, tr)` che pesca da `locales/*.json` (chiave `brackets`), lasciando `BRACKETS[id].label` invariato come fallback per i 3 punti che lo leggono ancora direttamente (Dashboard, Admin, PlayerProfile — restano in italiano fisso finché non tocca a loro, nessuna regressione). `lib/seasons.js` (`LABELS` stagioni, "Gennaio–Aprile" ecc.) ha lo stesso problema, stesso fix da applicare quando si converte una pagina che lo usa. `lib/archetypes.js` va probabilmente lasciato in inglese: sono termini di gergo Magic (Aggro, Control, Combo, Stax...) usati così a livello internazionale.

**Restano da convertire**: frontend — `App.jsx`, `SupportBanner.jsx`, `useFeedback.jsx`/`useGroup.jsx`/`useTheme.jsx`, `AdminPage` (823 righe), `Dashboard`/`DashboardPage` (1045 righe), `DeckProfilePage`, `EventDetailPage`, `NewGamePage`, `PlayerProfilePage` (1014 righe), `SeasonRecap` — queste ultime quattro sono le pagine grosse rimaste, ognuna probabilmente un batch a sé. Backend — i ~150 messaggi d'errore nei 13 file non ancora migrati (`middleware/*`, `routes/{admin,decks,events,gamesV2,groups,judge,notifications,scryfall,stats}.js`, `app.js`). Esplicitamente escluso da questa fase (task di traduzione contenuti, non di stringhe UI): `PrivacyPage`/`TermsPage`/`GuidaPage`/`MarkdownDoc.jsx`, cioè il contenuto di `PRIVACY_POLICY.md`/`TERMINI_SERVIZIO.md`/`GUIDA_UTENTE.md`.

`gruppoPage.gamesCount`/`winsCount` (pluralizzate, "N partite · N vittorie") pensate per essere riusate quando si convertono Dashboard/PlayerProfile/DeckProfile, che hanno lo stesso pattern testuale.

### Crescita
- Link di invito condivisibile con preview + QR invece del solo codice a mano — `qrcode` è già una dipendenza frontend, usata solo in `SeasonRecap.jsx`, non per gli inviti.

### Fase 2 — Capacitor (store iOS/Android)
`@capacitor/core`/`cli`, `cap add ios/android`, `webDir: frontend/dist`. I path assoluti attuali (`/icon-192.png`, `/api/...`) sono già compatibili. Disabilitare la registrazione di `sw.js` quando gira dentro Capacitor (`window.Capacitor` presente). Push notification native al posto del polling 60s. Quando si arriva qui, rivedere anche l'icona 512 "maskable" (il glow sfuma ai bordi, rischia di venire tagliato stretto dalle adaptive icon Android — serve una variante "safe zone").

### Fase 3 — Monetizzazione
Ads SDK + IAP "rimuovi pubblicità"/supporter (vedi vincoli legali sopra). Esempi di feature IAP-compliant (scollegate dai dati Magic, quindi ok da vendere): tetto sui gruppi creabili/uniti oltre un limite free (il multi-gruppo sopra lo rende possibile), tetto più alto di domande/giorno per il Judge Bot (il campo `llmUsed` e il sistema di budget già in campo servono anche a questo). Brand/logo ormai a posto.

### Fase 4 — Submission store
Compliance Apple Guideline 4.2 (funzionalità nativa sufficiente per non essere respinti come "wrapper di sito web" — serve Capacitor con feature native vere). Disclaimer Fan Content Policy già presente in app. Age rating, screenshot store.
