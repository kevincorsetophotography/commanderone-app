import { defineConfig } from 'vitest/config';

// Test di integrazione HTTP (supertest contro src/app.js): resolveGroup,
// isolamento multi-tenant, flussi auth/gruppi. Girano contro un Postgres
// embedded dedicato avviato/spento da test/globalSetup.mjs.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.js'],
    globalSetup: './test/globalSetup.mjs',
    testTimeout: 20000,
    hookTimeout: 30000,
    // Un solo Postgres condiviso da tutti i file di test: via sequenziale per
    // evitare collisioni (rate limiter condivisi, unique constraint su
    // username/slug) tra file eseguiti in parallelo.
    fileParallelism: false,
  },
});
