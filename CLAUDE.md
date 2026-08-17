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
- `.env` backend (gitignored): `DATABASE_URL`, `JWT_SECRET` (≥32 char), `PORT`, `FRONTEND_URL`, `GROQ_API_KEY` (Judge Bot). **Non serve più `INVITE_CODE`** (era globale, ora ogni gruppo ha il proprio codice in DB) né `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

---

## Multi-tenancy — il cuore dell'architettura

- **`Group`**: entità first-class. `slug` (unique, usato nell'URL API), `inviteCode` (unique, rigenerabile). Ogni `Deck`, `Game`, `Event`, `JudgeQuestion`, `AchievementUnlock` ha `groupId`.
- **`GroupMember`**: join table User↔Group con `role` (PLAYER|ADMIN) **scoped al gruppo**, non più globale. `User` non ha più un campo `role` — un utente può essere ADMIN nel proprio gruppo e PLAYER in un altro.
- **`User.username` resta univoco globalmente** (un account, molti gruppi, login sempre per username). Email ora richiesta alla registrazione (verifica + reset password self-service) — vedi branch `feat/email-verification-password-reset`, non ancora in `main`.
- **Route mounting**: `/api/auth/*` (account, senza gruppo) e `/api/groups` (crea/unisciti/mine) sono globali; tutto il resto vive sotto `/api/groups/:slug/*`, con middleware `resolveGroup` (verifica membership, 403 se non membro, attacca `req.group`/`req.membership`) seguito da `requireGroupAdmin` dove serve.
- **Achievement per-gruppo**: `AchievementUnlock` ha `@@unique([groupId, userId, achievementId])` — un giocatore in due gruppi ha progressi indipendenti in ciascuno. `loadData(prisma, groupId)` in `achievements.js` filtra sempre per gruppo.
- **Frontend**: `hooks/useGroup.jsx` (context) gestisce la lista gruppi dell'utente, il gruppo attivo (persistito in `localStorage` come `ct_active_group`) e lo switcher. `lib/api.js` prefissa automaticamente le chiamate group-scoped con `/groups/${activeGroupSlug}`. `App.jsx` mostra `OnboardingPage` (crea/unisciti) se l'utente ha zero gruppi.
- **Onboarding**: `POST /api/auth/register` crea solo l'account (nessun invite code). Il gruppo si crea (`POST /api/groups`, il creatore diventa ADMIN) o si raggiunge (`POST /api/groups/join {inviteCode}`) in un secondo momento.

## API backend — endpoint principali

```
POST /api/auth/register        {username, password}
POST /api/auth/login           {username, password}
PATCH /api/auth/profile        (avatar)

POST /api/groups               {name} → crea gruppo, creatore = ADMIN
POST /api/groups/join          {inviteCode}
GET  /api/groups/mine
POST /api/groups/:slug/invite-code/regenerate   (admin del gruppo)

# tutto il resto sotto /api/groups/:slug/... (richiede membership)
/decks, /games (+ commenti/reazioni), /stats, /events (+ tornei), /notifications, /judge
/admin/export, /admin/members (GET/PATCH ruolo/DELETE rimuovi — gestione membri, NON più creazione utenti/cambio password: quello è self-service)

/api/scryfall/art     (globale, non autenticato — proxy immagini Scryfall)
```

## Cosa è cambiato rispetto a Commanderone (per chi conosce il progetto originale)

- Niente più admin globale hardcoded (`ensureAdmin.js` rimosso) — l'ADMIN è per-gruppo.
- `decks.js`/`gamesV2.js`/`stats.js`/`events.js`/`admin.js`: ogni query ora filtra per `groupId`. `AdminPage.jsx` gestisce membri del gruppo (ruolo, rimozione, codice invito), non più CRUD utenti globale con password.
- Brand: nome **CommanderOne**, palette blu/ambra (`theme.js`). Icona app reale (monogramma "C1" neon, coerente col wordmark CSS) sostituisce il placeholder ffmpeg — vedi branch `feat/new-app-icon`, non ancora in `main`.
- `GUIDA_UTENTE.md` riscritta da zero, generica (nessuno screenshot ancora — quelli di Commanderone erano specifici di Villastellone).
- Logica pura invariata 1:1: `seasons.js`, `achievements.js` (frontend), `tournament.js`, `judge.js` — ricevono dati già scoped per gruppo dal backend, nessuna modifica strutturale necessaria.

---

## Roadmap

> Stato aggiornato al 18/08/2026. Le voci "✅ fatto" vivono su branch dedicati non ancora in `main`: `feat/email-verification-password-reset`, `feat/multi-group-switching`, `feat/new-app-icon`, `feat/judge-bot-cost-safety`, `test/http-integration-and-pagination`.

### Appena fatto (da mergiare in `main`)
- ✅ Verifica email, reset password, cambio password self-service (`PATCH /api/auth/password`) — chiudeva la voce storica "Alta priorità".
- ✅ Validazione username (regex in `lib/validators.js`) — chiudeva l'altra voce storica.
- ✅ Multi-gruppo: entry point in `AccountPage` per unirsi/creare un gruppo oltre al primo. Backend e switcher già lo supportavano (vedi sezione Multi-tenancy sopra), mancava solo questo pezzo di UI.
- ✅ Icona app reale al posto del placeholder ffmpeg.
- ✅ Judge Bot: modello Groq dismesso (`llama-3.1-8b-instant`, morto il 16/08/2026) sostituito, tetto di costo giornaliero globale (`JUDGE_DAILY_LLM_CAP`, tabella `JudgeLlmUsage`), fallback gratuito senza LLM (oracle text + ruling Scryfall + ricerca locale CR) quando il tetto è esaurito o Groq non risponde.
- ✅ Test di integrazione HTTP (supertest + Postgres embedded dedicato, `backend/test/`) — chiudeva l'ultima voce storica in "Alta priorità". 29 test: auth, gruppi, `resolveGroup`/`requireGroupAdmin`, e soprattutto l'isolamento multi-tenant (mai testato prima). Richiesto `src/app.js` separato da `src/index.js` (che faceva `app.listen()` al top-level, impossibile da testare così com'era).
- ✅ Paginazione opzionale `GET /api/groups/:slug/games` — retrocompatibile (senza query params ritorna l'array completo come sempre, 6 pagine su 7 del frontend calcolano statistiche client-side sull'intera lista). Con `?page&pageSize` ritorna `{ games, total, page, pageSize, totalPages }`. `api.getGamesPage()` esiste lato frontend ma **nessuna pagina lo usa ancora** — il wiring UI (infinite scroll vs "carica altre" vs pagine numerate) resta un follow-up di design.

### Prossimi (prerequisiti più che feature — bassa complessità, alto impatto, nessuno richiede Capacitor)
- **Cancellazione account self-service** (GDPR "diritto all'oblio") — oggi non esiste, solo rimozione-da-gruppo fatta da un admin. Non rimandabile ora che l'account ha un'email reale.
- **Privacy Policy + Termini di Servizio** — zero file nel repo oggi. Bloccante sia per la submission store sia per conformità GDPR.
- **Donazioni** (Ko-fi/Patreon/Buy Me a Coffee) — spedibile subito, zero rischio legale (vedi vincoli sopra), primo modo per validare se la community sostiene il progetto prima di investire in ads/IAP.
- Wiring UI della paginazione partite (vedi sopra) — solo se/quando lo storico di un gruppo reale inizia a diventare pesante da caricare tutto insieme.

### i18n — prerequisito per "internazionale", il lavoro grosso
Tutto è hardcoded in italiano oggi: non solo le stringhe UI ma anche i **messaggi d'errore restituiti dal backend** (`validators.js`, `mailer.js`, ...) e ~21 occorrenze di `'it-IT'` per date/numeri sparse in una dozzina di file frontend. Nessuna libreria i18n installata. Serve: (1) libreria i18n frontend (es. `react-i18next`), (2) refactor backend per restituire **codici errore** invece di stringhe italiane pronte, tradotti lato client. Va prima di ads/Capacitor, non dopo — è la porta d'ingresso per qualunque mercato non italiano.

### Crescita
- Link di invito condivisibile con preview + QR invece del solo codice a mano — `qrcode` è già una dipendenza frontend, usata solo in `SeasonRecap.jsx`, non per gli inviti.

### Fase 2 — Capacitor (store iOS/Android)
`@capacitor/core`/`cli`, `cap add ios/android`, `webDir: frontend/dist`. I path assoluti attuali (`/icon-192.png`, `/api/...`) sono già compatibili. Disabilitare la registrazione di `sw.js` quando gira dentro Capacitor (`window.Capacitor` presente). Push notification native al posto del polling 60s. Quando si arriva qui, rivedere anche l'icona 512 "maskable" (il glow sfuma ai bordi, rischia di venire tagliato stretto dalle adaptive icon Android — serve una variante "safe zone").

### Fase 3 — Monetizzazione
Ads SDK + IAP "rimuovi pubblicità"/supporter (vedi vincoli legali sopra). Esempi di feature IAP-compliant (scollegate dai dati Magic, quindi ok da vendere): tetto sui gruppi creabili/uniti oltre un limite free (il multi-gruppo sopra lo rende possibile), tetto più alto di domande/giorno per il Judge Bot (il campo `llmUsed` e il sistema di budget già in campo servono anche a questo). Brand/logo ormai a posto.

### Fase 4 — Submission store
Compliance Apple Guideline 4.2 (funzionalità nativa sufficiente per non essere respinti come "wrapper di sito web" — serve Capacitor con feature native vere). Disclaimer Fan Content Policy già presente in app. Age rating, screenshot store.
