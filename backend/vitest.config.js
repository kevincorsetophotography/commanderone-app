import { defineConfig } from 'vitest/config';

// Config di default: solo unit test di logica pura (src/lib/*.test.js), veloci
// e senza DB. I test di integrazione HTTP vivono in test/integration/ e girano
// con `npm run test:integration` (vitest.integration.config.js) — separati
// perché richiedono un Postgres embedded dedicato (vedi test/globalSetup.mjs)
// e altrimenti rallenterebbero ogni `npm test` anche per chi tocca solo logica pura.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'test/integration/**'],
  },
});
