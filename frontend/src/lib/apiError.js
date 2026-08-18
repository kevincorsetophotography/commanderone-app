// Traduce un errore ritornato da api.js (vedi lib/api.js: throw { error, status, ... }).
//
// Tutto il backend restituisce codici (es. "PASSWORD_TOO_SHORT") — vedi i file
// sotto routes/ e middleware/. I codici con parametri dinamici (es. "Nome
// troppo lungo (max {{max}} caratteri)") arrivano col resto del payload
// dell'errore accanto al codice (es. { error: 'GROUP_NAME_TOO_LONG', max: 60 }):
// qui viene passato per intero come variabili di interpolazione, così le
// stringhe in locales/*.json possono usare {{max}}, {{groups}}, ecc. senza che
// questa funzione debba conoscerle una per una.
// t(key, { defaultValue }) lascia passare intatto un eventuale codice ancora
// senza traduzione invece di mostrare la chiave grezza — rete di sicurezza per
// route non ancora aggiornate, non più il caso normale.
export function translateApiError(err, t) {
  if (!err) return t('errors.GENERIC');
  const code = err.error;
  if (!code) return t('errors.GENERIC');

  if (code === 'SOLE_ADMIN_BLOCKED' && err.groupNames?.length) {
    const key = err.groupNames.length === 1 ? 'errors.SOLE_ADMIN_BLOCKED_ONE' : 'errors.SOLE_ADMIN_BLOCKED_OTHER';
    return t(key, { groups: err.groupNames.join(', ') });
  }

  return t(`errors.${code}`, { ...err, defaultValue: code });
}
