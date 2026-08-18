// CommanderOne API — entry point del processo. La costruzione dell'app vive in
// app.js (importabile dai test con supertest senza avviare un vero server).
const app = require('./app');
const prisma = require('./lib/prisma');
const { initAchievementSnapshots } = require('./lib/notify');
const { loadComprehensiveRules } = require('./lib/judge');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`CommanderOne API on :${PORT}`));

// Registra in silenzio gli achievement già maturati, per ogni gruppo (anti-flood notifiche)
initAchievementSnapshots(prisma);

// Carica le Comprehensive Rules in memoria (best-effort, fallback silenzioso)
loadComprehensiveRules();
