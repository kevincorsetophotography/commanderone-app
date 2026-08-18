// "ora" / "5m fa" / "3h fa" / "2g fa" (o l'inglese equivalente), altrimenti
// la data. Duplicata identica in NotificationBell.jsx e GameSocial.jsx prima
// di questa estrazione — un solo posto anche per la traduzione.
export function timeAgo(iso, tr, locale) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return tr('time.now')
  if (m < 60) return tr('time.minutesAgo', { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return tr('time.hoursAgo', { count: h })
  const d = Math.floor(h / 24)
  if (d < 7) return tr('time.daysAgo', { count: d })
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}
