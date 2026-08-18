// Traduce un errore ritornato da api.js (vedi lib/api.js: throw { error, status, ... }).
//
// Fase 1 dell'i18n: solo /api/auth/* restituisce codici (es. "PASSWORD_TOO_SHORT").
// Il resto del backend, non ancora migrato, restituisce ancora frasi italiane
// pronte — t(key, { defaultValue }) le lascia passare intatte quando il
// codice non esiste nel dizionario, invece di mostrare la chiave grezza.
// Man mano che altre route vengono migrate, basta aggiungere i loro codici
// a locales/it.json e en.json: questa funzione non cambia.
export function translateApiError(err, t) {
  if (!err) return t('errors.GENERIC');
  const code = err.error;
  if (!code) return t('errors.GENERIC');

  if (code === 'SOLE_ADMIN_BLOCKED' && err.groupNames?.length) {
    const key = err.groupNames.length === 1 ? 'errors.SOLE_ADMIN_BLOCKED_ONE' : 'errors.SOLE_ADMIN_BLOCKED_OTHER';
    return t(key, { groups: err.groupNames.join(', ') });
  }

  return t(`errors.${code}`, { defaultValue: code });
}
