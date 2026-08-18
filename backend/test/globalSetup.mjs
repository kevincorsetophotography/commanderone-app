// Global setup dei test di integrazione (vitest.integration.config.js).
// Avvia un PostgreSQL "embedded" dedicato ai test — isolato dal DB di sviluppo
// (porta e cartella diverse) così `npm test:integration` non tocca mai i dati
// di `npm run dev`, e funziona anche senza il dev server già avviato.
import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';

const DB_DIR = './.testdb';
const PORT = 5434;
const DB_NAME = 'commanderone_test';
const DATABASE_URL = `postgresql://test:test@localhost:${PORT}/${DB_NAME}`;

let pg;

export async function setup() {
  // Ripulisce eventuali residui di una run precedente interrotta a metà.
  if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true, force: true });

  pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user: 'test',
    password: 'test',
    port: PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();

  // Stesso accorgimento UTF-8 di scripts/dev.mjs: su Windows initdb usa
  // WIN1252 come default, che non regge le emoji usate nei test (reazioni).
  const admin = pg.getPgClient();
  await admin.connect();
  await admin.query(
    `CREATE DATABASE "${DB_NAME}" WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`
  );
  await admin.end();

  process.env.DATABASE_URL = DATABASE_URL;
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long-ok';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  // Letto da app.js/routes/judge.js per disattivare i rate limiter: in una
  // suite di integrazione tutte le richieste arrivano dalla stessa "IP" via
  // supertest, e superano facilmente i limiti pensati per un utente reale.
  process.env.NODE_ENV = 'test';

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL },
  });
}

export async function teardown() {
  await pg?.stop();
  rmSync(DB_DIR, { recursive: true, force: true });
}
