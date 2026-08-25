'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  type ReaderSettings,
  type ThemeId,
  type SpacingId,
  type ScrollSpeedId,
  type ChapterMeta,
  FONT_MIN,
  FONT_MAX,
  FONT_STEP,
} from './reader'

const KEYS = {
  settings: 'zenreader:settings',
  text: 'zenreader:text',
  reading: 'zenreader:reading',
  scroll: 'zenreader:scroll',
  chapter: 'zenreader:chapter',
} as const

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage full / unavailable — reading still works, just not persisted */
  }
}

export interface ReaderState {
  hydrated: boolean
  settings: ReaderSettings
  text: string
  isReading: boolean
  /** Set when the current text came from a URL extraction (Pillar 1); null for manual paste. */
  chapter: ChapterMeta | null
  /** Scroll position (px) restored from a previous session, consumed once. */
  initialScroll: number
  setTheme: (theme: ThemeId) => void
  setSpacing: (spacing: SpacingId) => void
  setScrollSpeed: (speed: ScrollSpeedId) => void
  setCustomBackground: (background: string | null) => void
  setCustomOverlay: (opacity: number) => void
  increaseFont: () => void
  decreaseFont: () => void
  setText: (text: string) => void
  startReading: (text: string, chapter?: ChapterMeta | null) => void
  exitReading: () => void
  saveScroll: (px: number) => void
}

export function useReaderState(): ReaderState {
  const [hydrated, setHydrated] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS)
  const [text, setTextState] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [chapter, setChapterState] = useState<ChapterMeta | null>(null)
  const initialScrollRef = useRef(0)

  // Hydrate from localStorage once on mount to avoid SSR mismatch.
  useEffect(() => {
    const storedSettings = safeGet(KEYS.settings)
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as Partial<ReaderSettings>
        setSettings({
          theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
          fontSize:
            typeof parsed.fontSize === 'number'
              ? Math.min(FONT_MAX, Math.max(FONT_MIN, parsed.fontSize))
              : DEFAULT_SETTINGS.fontSize,
          spacing: parsed.spacing ?? DEFAULT_SETTINGS.spacing,
          scrollSpeed: parsed.scrollSpeed ?? DEFAULT_SETTINGS.scrollSpeed,
          customBackground: typeof parsed.customBackground === 'string' ? parsed.customBackground : null,
          customOverlay: typeof parsed.customOverlay === 'number' ? Math.min(80, Math.max(0, parsed.customOverlay)) : DEFAULT_SETTINGS.customOverlay,
        })
      } catch {
        /* ignore malformed settings */
      }
    }

    const storedText = safeGet(KEYS.text)
    if (storedText) setTextState(storedText)

    const storedChapter = safeGet(KEYS.chapter)
    if (storedChapter) {
      try {
        const parsedChapter = JSON.parse(storedChapter) as ChapterMeta
        if (parsedChapter && typeof parsedChapter.sourceUrl === 'string') setChapterState(parsedChapter)
      } catch {
        /* ignore malformed chapter meta */
      }
    }

    const storedScroll = safeGet(KEYS.scroll)
    if (storedScroll) initialScrollRef.current = Number(storedScroll) || 0

    // Only resume reading mode if we actually have text to show.
    if (safeGet(KEYS.reading) === '1' && storedText && storedText.trim()) {
      setIsReading(true)
    }

    setHydrated(true)
  }, [])

  // Persist settings whenever they change (after hydration).
  useEffect(() => {
    if (!hydrated) return
    safeSet(KEYS.settings, JSON.stringify(settings))
  }, [settings, hydrated])

  const setTheme = useCallback((theme: ThemeId) => {
    setSettings((s) => ({ ...s, theme }))
  }, [])

  const setSpacing = useCallback((spacing: SpacingId) => {
    setSettings((s) => ({ ...s, spacing }))
  }, [])

  const setScrollSpeed = useCallback((scrollSpeed: ScrollSpeedId) => {
    setSettings((s) => ({ ...s, scrollSpeed }))
  }, [])

  const setCustomBackground = useCallback((customBackground: string | null) => {
    setSettings((s) => ({ ...s, customBackground }))
  }, [])

  const setCustomOverlay = useCallback((customOverlay: number) => {
    setSettings((s) => ({ ...s, customOverlay: Math.min(80, Math.max(0, customOverlay)) }))
  }, [])

  const increaseFont = useCallback(() => {
    setSettings((s) => ({ ...s, fontSize: Math.min(FONT_MAX, s.fontSize + FONT_STEP) }))
  }, [])

  const decreaseFont = useCallback(() => {
    setSettings((s) => ({ ...s, fontSize: Math.max(FONT_MIN, s.fontSize - FONT_STEP) }))
  }, [])

  const setText = useCallback((value: string) => {
    setTextState(value)
    safeSet(KEYS.text, value)
  }, [])

  const startReading = useCallback((value: string, nextChapter?: ChapterMeta | null) => {
    setTextState(value)
    safeSet(KEYS.text, value)
    setChapterState(nextChapter ?? null)
    if (nextChapter) {
      safeSet(KEYS.chapter, JSON.stringify(nextChapter))
    } else {
      safeSet(KEYS.chapter, '')
    }
    // New text => start from the top.
    initialScrollRef.current = 0
    safeSet(KEYS.scroll, '0')
    safeSet(KEYS.reading, '1')
    setIsReading(true)
  }, [])

  const exitReading = useCallback(() => {
    safeSet(KEYS.reading, '0')
    setIsReading(false)
  }, [])

  const saveScroll = useCallback((px: number) => {
    safeSet(KEYS.scroll, String(Math.round(px)))
  }, [])

  return {
    hydrated,
    settings,
    text,
    isReading,
    chapter,
    initialScroll: initialScrollRef.current,
    setTheme,
    setSpacing,
    setScrollSpeed,
    setCustomBackground,
    setCustomOverlay,
    increaseFont,
    decreaseFont,
    setText,
    startReading,
    exitReading,
    saveScroll,
  }
}
