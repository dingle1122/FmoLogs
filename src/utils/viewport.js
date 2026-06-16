let lastStableHeight = 0
let lastStableWidth = 0

function isEditableFocused() {
  const active = document.activeElement
  if (!active) return false
  const tagName = active.tagName
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    active.isContentEditable
  )
}

function setViewportCssVars() {
  const viewport = window.visualViewport
  const nextHeight = viewport?.height || window.innerHeight
  const nextWidth = viewport?.width || window.innerWidth
  const keyboardLikelyOpen =
    isEditableFocused() &&
    lastStableHeight > 0 &&
    nextHeight < lastStableHeight * 0.8
  const height = keyboardLikelyOpen ? lastStableHeight : nextHeight
  const width = keyboardLikelyOpen ? lastStableWidth || nextWidth : nextWidth
  const rootStyle = document.documentElement.style

  if (!keyboardLikelyOpen) {
    lastStableHeight = nextHeight
    lastStableWidth = nextWidth
  }

  rootStyle.setProperty('--app-height', `${height}px`)
  rootStyle.setProperty('--app-width', `${width}px`)
  rootStyle.setProperty('--vh', `${height * 0.01}px`)
}

export function applyViewportCssVars() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  let frameId = 0
  const scheduleUpdate = () => {
    if (frameId) return
    frameId = window.requestAnimationFrame(() => {
      frameId = 0
      setViewportCssVars()
    })
  }

  scheduleUpdate()

  window.addEventListener('resize', scheduleUpdate, { passive: true })
  window.addEventListener('orientationchange', scheduleUpdate, { passive: true })
  window.addEventListener('pageshow', scheduleUpdate, { passive: true })

  const viewport = window.visualViewport
  viewport?.addEventListener('resize', scheduleUpdate, { passive: true })
  viewport?.addEventListener('scroll', scheduleUpdate, { passive: true })

  return () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId)
      frameId = 0
    }
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('orientationchange', scheduleUpdate)
    window.removeEventListener('pageshow', scheduleUpdate)
    viewport?.removeEventListener('resize', scheduleUpdate)
    viewport?.removeEventListener('scroll', scheduleUpdate)
  }
}
