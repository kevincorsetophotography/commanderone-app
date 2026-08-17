// Costruzione dell'app Express — separata da index.js (avvio del processo) così
// i test di integrazione possono importare `app` con supertest senza far
// partire un vero server né i side-effect di startup (CR loading, snapshot
// achievement). Vedi index.js per l'entry point del processo.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Guard di sicurezza: l'app non si costruisce con un JWT_SECRET assente o
// debole — qui e non solo in index.js, così vale anche per i test che
// importano app.js direttamente.
const WEAK_SECRETS = new Set(['change-me-in-production', 'secret', 'changeme', '']);
if (!process.env.JWT_SECRET || WEAK_SECRETS.has(process.env.JWT_SECRET) || process.env.JWT_SECRET.length < 32) {
  console.error('\n[FATAL] JWT_SECRET mancante o troppo debole.');
  console.error('Imposta una stringa casuale di almeno 32 caratteri nel file .env.');
  console.error('Puoi generarne una con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"\n');
  process.exit(1);
}

const authRoutes         = require('./routes/auth');
const groupsRoutes       = require('./routes/groups');
const adminRoutes        = require('./routes/admin');
const deckRoutes         = require('./routes/decks');
const gameRoutes         = require('./routes/gamesV2');
const statsRoutes        = require('./routes/stats');
const eventRoutes        = require('./routes/events');
const notificationRoutes = require('./routes/notifications');
const judgeRoutes        = require('./routes/judge');
const scryfallRoutes     = require('./routes/scryfall');
const auth               = require('./middleware/auth');
const resolveGroup       = require('./middleware/resolveGroup');
const { rateLimit } = require('express-rate-limit');

const app = express();

// Dietro il proxy di Railway: necessario perché il rate limiter veda l'IP reale
// del client (e non quello del proxy, condiviso da tutti).
app.set('trust proxy', 1);

// HTTP security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Anti brute-force su login/registrazione
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppi tentativi, riprova tra qualche minuto.' },
});

// Limite generale sulle API autenticate (anti-scraping, anti-flood)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppo traffico, rallenta un po\'.' },
});


const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin non consentita: ${origin}`));
  }
}));
app.use(express.json());

// Route "di conto": autenticazione e gestione gruppi (creazione/adesione), senza slug.
app.use('/api/auth',   authLimiter, authRoutes);
app.use('/api/groups', apiLimiter, groupsRoutes);

// Route "di contenuto": tutte scoped a un gruppo via :slug. resolveGroup verifica
// che l'utente sia membro del gruppo prima di lasciar passare qualunque richiesta.
const groupContentRouter = express.Router({ mergeParams: true });
groupContentRouter.use(auth, resolveGroup);
groupContentRouter.use('/decks',         deckRoutes);
groupContentRouter.use('/games',         gameRoutes);
groupContentRouter.use('/stats',         statsRoutes);
groupContentRouter.use('/events',        eventRoutes);
groupContentRouter.use('/notifications', notificationRoutes);
groupContentRouter.use('/judge',         judgeRoutes);
groupContentRouter.use('/admin',         adminRoutes);
app.use('/api/groups/:slug', apiLimiter, groupContentRouter);

app.use('/api/scryfall', apiLimiter, scryfallRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
