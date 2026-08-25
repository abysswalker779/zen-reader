'use client'

import { useEffect } from 'react'
import { useReaderState } from '@/lib/use-reader-state'
import { THEMES } from '@/lib/reader'
import { InputScreen } from './input-screen'
import { ReaderScreen } from './reader-screen'

export function ReaderApp() {
  const state = useReaderState()
  const theme = THEMES[state.settings.theme]

  // Keep the page/overscroll background and the browser theme-color in sync
  // with the active reading theme so there is no color flash at the edges.
  useEffect(() => {
    if (!state.hydrated) return
    const root = document.documentElement
    root.style.backgroundColor = theme.bg
    document.body.style.backgroundColor = theme.bg

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', theme.bg)
  }, [theme.bg, state.hydrated])

  // Avoid a flash of default (unhydrated) UI before we know the saved theme.
  if (!state.hydrated) {
    return <div className="min-h-dvh" style={{ backgroundColor: THEMES.oled.bg }} aria-hidden />
  }

  return state.isReading ? <ReaderScreen state={state} /> : <InputScreen state={state} />
}
