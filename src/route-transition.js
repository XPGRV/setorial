const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function runRouteTransition(action) {
  if (reducedMotion()) {
    action()
    return
  }

  if (document.startViewTransition) {
    document.startViewTransition(() => action())
    return
  }

  document.documentElement.classList.add('route-is-leaving')
  window.setTimeout(() => {
    action()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('route-is-leaving')
      document.documentElement.classList.add('route-is-entering')
      window.setTimeout(() => document.documentElement.classList.remove('route-is-entering'), 280)
    }))
  }, 180)
}
