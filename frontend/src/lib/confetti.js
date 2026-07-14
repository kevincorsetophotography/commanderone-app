// Confetti burst su canvas, zero dipendenze. Si autorimuove al termine.
export function fireConfetti({ duration = 1600, colors } = {}) {
  if (typeof document === 'undefined') return
  // rispetta prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const palette = colors || ['#34F08F', '#8B5CF6', '#6C4AE0', '#22C55E', '#FFFFFF', '#FFD24A']
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const N = Math.min(160, Math.floor(window.innerWidth / 8))
  const cx = window.innerWidth / 2
  const particles = Array.from({ length: N }, () => {
    const angle = (Math.random() * Math.PI) - Math.PI / 2 // verso l'alto-laterale
    const speed = 6 + Math.random() * 7
    return {
      x: cx + (Math.random() - 0.5) * 120,
      y: window.innerHeight * 0.32,
      vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1),
      vy: -Math.abs(Math.sin(angle) * speed) - 4,
      size: 5 + Math.random() * 6,
      color: palette[Math.floor(Math.random() * palette.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    }
  })

  const start = performance.now()
  const gravity = 0.22

  function frame(now) {
    const elapsed = now - start
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      p.vy += gravity
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      p.life = Math.max(0, 1 - elapsed / duration)
      ctx.save()
      ctx.globalAlpha = p.life
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame)
    } else {
      canvas.remove()
    }
  }
  requestAnimationFrame(frame)
}
