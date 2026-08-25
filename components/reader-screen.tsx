'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, WifiOff } from 'lucide-react'
import { THEMES, SPACING, SCROLL_SPEEDS, processText, type ChapterMeta, type ReaderTheme } from '@/lib/reader'
import type { ReaderState } from '@/lib/use-reader-state'
import { ReaderControls } from './reader-controls'
import { extractChapter, buildChapterText } from '@/lib/extract-client'
import { saveChapter, getChapter } from '@/lib/chapter-store'

export function ReaderScreen({ state }: { state: ReaderState }) {
  const theme = THEMES[state.settings.theme]
  const spacing = SPACING[state.settings.spacing]

  const processed = useMemo(() => processText(state.text), [state.text])

  const [progress, setProgress] = useState(0)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [autoScroll, setAutoScroll] = useState(false)

  const restoredRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const saveTickingRef = useRef(false)

  // --- Progress tracking + throttled position saving ---------------------
  const updateProgress = useCallback(() => {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    const y = window.scrollY
    setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      updateProgress()
      if (!saveTickingRef.current) {
        saveTickingRef.current = true
        requestAnimationFrame(() => {
          state.saveScroll(window.scrollY)
          saveTickingRef.current = false
        })
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateProgress)
    }
  }, [state, updateProgress])

  // --- Restore saved scroll position once content is laid out ------------
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const target = state.initialScroll
    // Wait a frame so paragraph layout (and font) is measured first.
    requestAnimationFrame(() => {
      window.scrollTo(0, target)
      updateProgress()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Hands-free auto-scroll -------------------------------------------
  useEffect(() => {
    if (!autoScroll) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return
    }

    const speed = SCROLL_SPEEDS.find((s) => s.id === state.settings.scrollSpeed)!.pxPerSecond
    let last = performance.now()
    let remainder = 0

    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      remainder += speed * dt
      const whole = Math.floor(remainder)
      if (whole >= 1) {
        window.scrollBy(0, whole)
        remainder -= whole
      }
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (window.scrollY >= max - 1) {
        setAutoScroll(false)
        return
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [autoScroll, state.settings.scrollSpeed])

  // Turning auto-scroll on collapses the chrome for a clean, hands-free view.
  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => {
      const next = !prev
      if (next) setChromeVisible(false)
      return next
    })
  }, [])

  const handleContentTap = useCallback(() => {
    setChromeVisible((v) => !v)
  }, [])

  const handleExit = useCallback(() => {
    setAutoScroll(false)
    state.exitReading()
  }, [state])

  // --- Pillar 1: chapter-to-chapter navigation ---------------------------
  const [navDirection, setNavDirection] = useState<'prev' | 'next' | null>(null)
  const [navError, setNavError] = useState<string | null>(null)

  const handleChapterNav = useCallback(
    async (direction: 'prev' | 'next', url: string) => {
      setNavDirection(direction)
      setNavError(null)
      try {
        const cached = await getChapter(url)
        if (cached) {
          const meta: ChapterMeta = { sourceUrl: cached.url, prevUrl: cached.prevUrl, nextUrl: cached.nextUrl }
          state.startReading(cached.text, meta)
          return
        }

        const result = await extractChapter(url)
        if (!result.ok) {
          setNavError(result.blocked ? 'Site protection detected. Copy text manually to bypass.' : result.message)
          return
        }

        const chapterText = buildChapterText(result.title, result.paragraphs)
        const meta: ChapterMeta = { sourceUrl: result.sourceUrl, prevUrl: result.prevUrl, nextUrl: result.nextUrl }
        void saveChapter({
          url: result.sourceUrl,
          title: result.title,
          text: chapterText,
          prevUrl: result.prevUrl,
          nextUrl: result.nextUrl,
          savedAt: Date.now(),
        })
        state.startReading(chapterText, meta)
      } finally {
        setNavDirection(null)
      }
    },
    [state],
  )

  const customBackground = state.settings.customBackground
  const isStarry = state.settings.theme === 'starry'

  return (
    <div
      className={`reader-surface no-tap-highlight min-h-dvh ${isStarry ? 'reader-starry' : ''}`}
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        backgroundImage: customBackground ? `linear-gradient(rgba(0, 0, 0, ${state.settings.customOverlay / 100}), rgba(0, 0, 0, ${state.settings.customOverlay / 100})), url("${customBackground}")` : undefined,
        backgroundAttachment: customBackground ? 'fixed' : undefined,
        backgroundSize: customBackground ? 'cover' : undefined,
        backgroundPosition: customBackground ? 'center' : undefined,
        backgroundRepeat: customBackground ? 'no-repeat' : undefined,
      }}
    >
      {/* Fixed reading-progress bar */}
      <div
        className="fixed inset-x-0 top-0 z-30 h-1"
        style={{ backgroundColor: theme.border }}
        role="progressbar"
        aria-label="Reading progress"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full origin-left"
          style={{
            backgroundColor: theme.progress,
            transform: `scaleX(${progress})`,
            transition: autoScroll ? 'none' : 'transform 0.1s linear',
          }}
        />
      </div>

      {/* Reading surface — tap anywhere to toggle the controls */}
      <article
        onClick={handleContentTap}
        className="mx-auto w-full max-w-2xl cursor-pointer px-6 pb-[45dvh] pt-[max(env(safe-area-inset-top),3.5rem)]"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: `${state.settings.fontSize}px`,
          lineHeight: spacing.lineHeight,
        }}
      >
        {processed.title && (
          <h1
            className="mb-8 text-balance font-semibold"
            style={{ color: theme.accent, fontSize: '1.4em', lineHeight: 1.25 }}
          >
            {processed.title}
          </h1>
        )}
        {processed.paragraphs.map((p, i) => (
          <p key={i} style={{ marginBottom: spacing.paragraphGap }} className="text-pretty">
            {p}
          </p>
        ))}
        {processed.paragraphs.length === 0 && (
          <p style={{ color: theme.muted }}>No text to read. Go back and paste a chapter.</p>
        )}

        {state.chapter && (state.chapter.prevUrl || state.chapter.nextUrl) && (
          <nav
            onClick={(e) => e.stopPropagation()}
            aria-label="Chapter navigation"
            className="mt-10 flex items-center gap-3 border-t pt-6"
            style={{ borderColor: theme.border, fontFamily: 'var(--font-sans)' }}
          >
            <ChapterNavButton
              theme={theme}
              direction="prev"
              url={state.chapter.prevUrl}
              loading={navDirection === 'prev'}
              disabled={navDirection !== null}
              onNavigate={handleChapterNav}
            />
            <ChapterNavButton
              theme={theme}
              direction="next"
              url={state.chapter.nextUrl}
              loading={navDirection === 'next'}
              disabled={navDirection !== null}
              onNavigate={handleChapterNav}
            />
          </nav>
        )}
      </article>

      {navError && (
        <div
          onClick={(e) => e.stopPropagation()}
          role="alert"
          className="fixed inset-x-4 top-16 z-40 mx-auto flex max-w-md items-start gap-2 rounded-2xl border p-3 text-sm shadow-2xl"
          style={{ backgroundColor: theme.chrome, color: theme.chromeFg, borderColor: theme.border }}
        >
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="flex-1">{navError}</p>
          <button type="button" onClick={() => setNavError(null)} aria-label="Dismiss" className="shrink-0 text-xs underline opacity-70">
            Dismiss
          </button>
        </div>
      )}

      <ReaderControls
        state={state}
        theme={theme}
        chromeVisible={chromeVisible}
        autoScroll={autoScroll}
        progress={progress}
        onExit={handleExit}
        onToggleAutoScroll={toggleAutoScroll}
      />
    </div>
  )
}

function ChapterNavButton({
  theme,
  direction,
  url,
  loading,
  disabled,
  onNavigate,
}: {
  theme: ReaderTheme
  direction: 'prev' | 'next'
  url: string | null
  loading: boolean
  disabled: boolean
  onNavigate: (direction: 'prev' | 'next', url: string) => void
}) {
  const isPrev = direction === 'prev'
  return (
    <button
      type="button"
      disabled={!url || disabled}
      onClick={() => url && onNavigate(direction, url)}
      className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 ${isPrev ? '' : 'flex-row-reverse'}`}
      style={{ borderColor: theme.border, color: theme.chromeFg ?? theme.fg }}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : isPrev ? (
        <ChevronLeft className="size-4" aria-hidden />
      ) : (
        <ChevronRight className="size-4" aria-hidden />
      )}
      {url ? (isPrev ? 'Previous Chapter' : 'Next Chapter') : isPrev ? 'No previous chapter' : 'No next chapter'}
    </button>
  )
}
