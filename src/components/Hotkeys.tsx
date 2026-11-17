import { useEffect } from 'react'
import type { Engine } from '../engine/Engine'

interface HotkeysProps {
  engine: Engine | null
  onFocusSearch?: () => void
}

export function Hotkeys({ engine, onFocusSearch }: HotkeysProps) {
  useEffect(() => {
    if (!engine) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        engine.togglePause()
      } else if (e.key === 's' || e.key === 'S') {
        engine.skip()
      } else if (e.key === 'f' || e.key === 'F') {
        engine.togglePlayFull()
      } else if (e.key === '/') {
        if (onFocusSearch) {
          e.preventDefault()
          onFocusSearch()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [engine, onFocusSearch])

  return null
}
export default Hotkeys
