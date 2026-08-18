// Piazzamento ordinale locale-aware: "1°"/"2°" in italiano, "1st"/"2nd"/"3rd"/
// "4th"... in inglese. Usato in tutte le pagine che mostrano una classifica
// o un piazzamento (Feed, Dashboard, Gruppo, Partita, ...).
export function ordinal(n, locale) {
  if (locale?.startsWith('en')) {
    const mod100 = n % 100
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`
    switch (n % 10) {
      case 1: return `${n}st`
      case 2: return `${n}nd`
      case 3: return `${n}rd`
      default: return `${n}th`
    }
  }
  return `${n}°`
}
