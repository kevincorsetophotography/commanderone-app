// Archetipi dei mazzi (deve combaciare con la whitelist nel backend).
export const ARCHETYPES = {
  Aggro:       { color: '#E8654F' },
  Midrange:    { color: '#E89A3C' },
  Control:     { color: '#4D96FF' },
  Combo:       { color: '#A06CD5' },
  Stax:        { color: '#8A8D93' },
  Aristocrats: { color: '#B5495B' },
  Tokens:      { color: '#5FB87A' },
  Voltron:     { color: '#D4A23C' },
  Ramp:        { color: '#3FB0A9' },
}

export const ARCHETYPE_OPTIONS = Object.keys(ARCHETYPES)
