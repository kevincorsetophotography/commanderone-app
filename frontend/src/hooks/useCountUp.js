import { useState, useEffect, useRef } from 'react'

// Anima un numero da 0 al valore target con easing. Per valori non numerici lo restituisce così com'è.
export function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(typeof target === 'number' ? 0 : target)
  const raf = useRef(null)

  useEffect(() => {
    if (typeof target !== 'number' || !isFinite(target)) { setVal(target); return }
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * eased))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return val
}
