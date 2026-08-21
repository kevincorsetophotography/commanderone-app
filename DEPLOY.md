# 🚀 Deploy di CommanderOne (Railway + Vercel)

Guida per pubblicare l'app online. Architettura:

- **Backend + PostgreSQL** → Railway
- **Frontend** → Vercel
- Entrambi si aggiornano automaticamente a ogni `git push` su `main`.

Il codice è già predisposto (`backend/railway.json`, `frontend/vercel.json`, `start:prod`): questa guida copre solo i clic sui due servizi.

> Questo è un progetto **separato** da Commanderone (il tracker di Villastellone): anche se usi gli stessi account Railway/Vercel, crea due progetti nuovi e distinti — nessun dato o servizio va condiviso tra i due.

---

## Prerequisiti

- Il repo è già su GitHub: `kevincorsetophotography/commanderone-app` ✓
- Hai già un account su **[railway.app](https://railway.app)** e su **[vercel.com](https://vercel.com)** (dal progetto Commanderone) — accedi con GitHub, **New Project** anziché riusare quelli esistenti.
- `JWT_SECRET` già generato per te, ≥32 caratteri casuali:
  ```
  OFe1gFtBc0BOaInY2k4yY-SvgAzqCflVs3ufarIcaCaslfNtsERhamoYq7ksnVJ9
  ```
  (tienilo al sicuro — chiunque lo conosca può forgiare token di sessione validi. Se preferisci generarne uno tuo: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)

---

## Parte 1 — Backend + Database su Railway

### 1.1 Crea il progetto
1. Su Railway: **New Project → Deploy from GitHub repo** → scegli `commanderone-app`.
2. Railway crea un servizio. Aprilo → **Settings → Root Directory** → imposta **`backend`** → Save.

### 1.2 Aggiungi il database PostgreSQL
1. Nel progetto: **New → Database → Add PostgreSQL**.
2. Railway crea il servizio Postgres e una variabile `DATABASE_URL` al suo interno.

### 1.3 Collega il database al backend
1. Apri il servizio **backend → Variables**.
2. Aggiungi una variabile:
   - **Nome:** `DATABASE_URL`
   - **Valore:** `${{Postgres.DATABASE_URL}}`  ← riferimento al database (Railway lo autocompleta)

### 1.4 Imposta le altre variabili (sempre in backend → Variables)

**Obbligatorie:**

| Variabile | Valore |
|-----------|--------|
| `JWT_SECRET` | il secret generato sopra (o uno tuo, ≥32 caratteri) |
| `FRONTEND_URL` | lascialo vuoto per ora (lo metti nella Parte 3) |

> `PORT` lo gestisce Railway da solo, non serve impostarlo. Non servono `INVITE_CODE`/`ADMIN_USERNAME`/`ADMIN_PASSWORD`: a differenza di Commanderone non c'è un admin globale — il primo utente che si registra crea il proprio account **e poi** crea o si unisce a un Gruppo (diventandone admin lui stesso).

**Opzionali** (senza queste il Servizio funziona lo stesso, con fallback gratuiti):

| Variabile | Effetto se assente |
|-----------|---------------------|
| `RESEND_API_KEY` + `MAIL_FROM` | Le email (verifica indirizzo, reset password) vengono stampate nei log di Railway invece di essere inviate davvero. Per email reali, crea un account su [resend.com](https://resend.com), verifica un dominio mittente e imposta entrambe. |
| `GROQ_API_KEY` | Il Judge Bot funziona comunque in modalità "fallback gratuito" (solo confronto testuale con le regole ufficiali, niente sintesi AI). Per risposte generate da LLM, crea una chiave su [console.groq.com](https://console.groq.com). |
| `JUDGE_DAILY_LLM_CAP` | Tetto giornaliero di domande AI al Judge Bot — default `300` se non impostata. |

### 1.5 Deploy
Railway fa il deploy in automatico. Grazie al file `railway.json` userà `npm run start:prod`, che:
- crea le tabelle nel database (`prisma db push --skip-generate --accept-data-loss`),
- avvia il server (nessun utente admin da creare: è tutto self-service da app).

### 1.6 Esponi l'URL pubblico
1. Backend → **Settings → Networking → Generate Domain**.
2. Copia l'URL, sarà tipo: `https://commanderone-app-production.up.railway.app`
3. **Verifica** aprendo `https://…railway.app/api/scryfall/art?name=Sol+Ring` → deve rispondere con un'immagine (endpoint pubblico, non richiede login).

📌 **Annota questo URL backend**, serve nella Parte 2.

---

## Parte 2 — Frontend su Vercel

1. Su Vercel: **Add New → Project** → importa `commanderone-app`.
2. **Root Directory** → seleziona **`frontend`**.
3. Framework: Vercel rileva **Vite** da solo (Build: `npm run build`, Output: `dist`).
4. Apri **Environment Variables** e aggiungi:
   - **Nome:** `VITE_API_URL`
   - **Valore:** l'URL backend + `/api` → es. `https://commanderone-app-production.up.railway.app/api`
5. **Deploy**.
6. A fine deploy Vercel ti dà l'URL del sito, tipo: `https://commanderone-app.vercel.app`

📌 **Annota questo URL frontend.**

---

## Parte 3 — Collega i due servizi (CORS)

Il backend accetta richieste solo dal frontend autorizzato.

1. Torna su Railway → backend → **Variables**.
2. Imposta `FRONTEND_URL` = l'URL Vercel (senza `/` finale), es. `https://commanderone-app.vercel.app`
3. Salva: Railway ri-deploya da solo.

---

## Parte 4 — Primo accesso

1. Apri l'URL Vercel.
2. **Registrati** (username + email + password) — nessun invito richiesto per creare l'account.
3. Verifica l'indirizzo email se hai configurato Resend (sezione 1.4), altrimenti clicca sul link stampato nei log di Railway.
4. **Crea un Gruppo** (ne diventi automaticamente admin) o **unisciti** a uno esistente con un codice invito.
5. Inserisci mazzi e partite: il database è già pronto e vuoto.

---

## Aggiornamenti futuri

Da ora in poi ti basta:
```
git push
```
Railway e Vercel rilevano il push e ri-deployano automaticamente. Nessun altro passaggio.

---

## Dominio personalizzato (opzionale)

- **Vercel** → Project → **Settings → Domains** → aggiungi il tuo dominio e segui le istruzioni DNS.
- Se cambi dominio del frontend, aggiorna `FRONTEND_URL` su Railway.
- Se aggiungi un dominio, ricordati di aggiornare anche il segnaposto hosting nella Privacy Policy (`PRIVACY_POLICY.md`/`.en.md`, sezione 5.5) con il provider scelto.

---

## Risoluzione problemi

| Sintomo | Causa / soluzione |
|---------|-------------------|
| Il sito carica ma il login dà errore di rete | `VITE_API_URL` sbagliato su Vercel, o manca `/api` in fondo. |
| Errore CORS nella console | `FRONTEND_URL` su Railway non combacia con l'URL Vercel (controlla http**s** e niente `/` finale). |
| 500 al login / "Internal server error" | Il backend non vede il database: controlla che `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`. |
| Il backend non parte | Guarda i **Deploy Logs** su Railway. Se lamenta `JWT_SECRET`, impostalo (≥ 32 caratteri, non uno dei valori deboli tipo `secret`/`changeme`). |
| Le rotte (es. /mazzi) danno 404 ricaricando | Manca il routing SPA: il file `frontend/vercel.json` lo gestisce, assicurati sia stato deployato. |
| Le email di verifica/reset non arrivano | Senza `RESEND_API_KEY`/`MAIL_FROM` vengono solo stampate nei log di Railway — normale in assenza di configurazione. Controlla i Deploy Logs per il link. |
| Il Judge Bot risponde ma sempre "senza AI" | Manca `GROQ_API_KEY`, oppure il tetto `JUDGE_DAILY_LLM_CAP` è esaurito per la giornata — è il fallback gratuito previsto, non un errore. |
| Primo accesso lento | Normale su free tier dopo inattività; dal secondo accesso è veloce. |

---

## Variabili d'ambiente — riepilogo

**Railway (backend):**
- Obbligatorie: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
- Opzionali: `RESEND_API_KEY`, `MAIL_FROM`, `GROQ_API_KEY`, `JUDGE_DAILY_LLM_CAP`

**Vercel (frontend):**
`VITE_API_URL`
