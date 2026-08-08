import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [override, setOverride] = useState(() => localStorage.getItem('coop-theme-override') || null)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  const resolved = override ?? (systemDark ? 'dark' : 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
  }, [resolved])

  function setTheme(next) {
    setOverride(next)
    if (next) localStorage.setItem('coop-theme-override', next)
    else localStorage.removeItem('coop-theme-override')
  }

  return (
    <ThemeContext.Provider value={{ theme: resolved, override, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
