// Livelli di potenza dei mazzi (semplificazione del sistema bracket WotC).
// `label` resta la stringa italiana per i punti non ancora convertiti alla
// Fase 2 dell'i18n (nessuna regressione); `bracketLabel()` restituisce la
// versione tradotta per i componenti già convertiti — vedi locales/*.json
// chiave "brackets".
export const BRACKETS = {
  1: { label: 'Casual', color: '#6BCB77' },
  2: { label: 'Bilanciato', color: '#4D96FF' },
  3: { label: 'Potente', color: '#FFA94D' },
  4: { label: 'cEDH', color: '#FF6B6B' },
}

export const BRACKET_OPTIONS = [1, 2, 3, 4]

export function bracketLabel(id, tr) {
  return tr(`brackets.${id}`)
}
