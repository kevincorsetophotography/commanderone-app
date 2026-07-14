import { createContext, useContext, useState, useEffect } from 'react'
import { themes } from '../lib/theme'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  // Default: dark mode (a meno che l'utente non abbia scelto light)
  const [dark, setDark] = useState(() => localStorage.getItem('ct_theme') !== 'light')

  useEffect(() => {
    const tk = dark ? themes.dark : themes.light
    document.documentElement.style.background = tk.bgPage
    document.body.style.background = tk.bgPage
    document.body.style.color = tk.text
    document.body.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif"
    document.body.style.transition = 'background 0.3s ease'
  }, [dark])

  const toggleDark = () => {
    setDark(d => {
      const next = !d
      localStorage.setItem('ct_theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <ThemeCtx.Provider value={{ t: dark ? themes.dark : themes.light, dark, toggleDark }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeCtx)
}
