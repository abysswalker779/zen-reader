'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  Clipboard,
  Home,
  Search,
  Library,
  Settings,
  Link2,
  X,
  Loader2,
  ShieldAlert,
  AlertCircle,
  PenLine,
} from 'lucide-react'
import { THEMES, SAMPLE_TEXT, processText } from '@/lib/reader'
import type { ReaderState } from '@/lib/use-reader-state'
import { SettingsDrawer } from '@/components/reader-controls'
import { extractChapter, buildChapterText } from '@/lib/extract-client'
import { saveChapter } from '@/lib/chapter-store'

const STATUS_MESSAGES = ['Fetching URL…', 'Stripping ads & clutter…', 'Formatting text…']

type ExtractState = 'idle' | 'loading' | 'blocked' | 'error'

export function InputScreen({ state }: { state: ReaderState }) {
  const theme = THEMES[state.settings.theme]
  const [value, setValue] = useState(state.text)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // --- Pillar 1: URL extraction ------------------------------------------
  const [urlValue, setUrlValue] = useState('')
  const [extractState, setExtractState] = useState<ExtractState>('idle')
  const [extractMessage, setExtractMessage] = useState('')
  const [statusIndex, setStatusIndex] = useState(0)
  const [sourceLabel, setSourceLabel] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearInterval(statusTimerRef.current)
    }
  }, [])

  const handleExtract = async () => {
    const url = urlValue.trim()
    if (!url || extractState === 'loading') return

    setExtractState('loading')
    setStatusIndex(0)
    setExtractMessage('')
    statusTimerRef.current = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1))
    }, 900)

    const result = await extractChapter(url)

    if (statusTimerRef.current) {
      clearInterval(statusTimerRef.current)
      statusTimerRef.current = null
    }

    if (result.ok) {
      const chapterText = buildChapterText(result.title, result.paragraphs)
      const chapterMeta = { sourceUrl: result.sourceUrl, prevUrl: result.prevUrl, nextUrl: result.nextUrl }
      setExtractState('idle')
      void saveChapter({
        url: result.sourceUrl,
        title: result.title,
        text: chapterText,
        prevUrl: result.prevUrl,
        nextUrl: result.nextUrl,
        savedAt: Date.now(),
      })
      state.startReading(chapterText, chapterMeta)
      return
    }

    setExtractState(result.blocked ? 'blocked' : 'error')
    setExtractMessage(result.message)
  }

  const handleClearUrl = () => {
    setUrlValue('')
    setExtractState('idle')
    setExtractMessage('')
  }

  const handleSwitchToManual = () => {
    setSourceLabel(urlValue.trim())
    setExtractState('idle')
    setExtractMessage('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const preview = processText(value)
  const canRead = preview.paragraphs.length > 0
  const minutes = Math.max(1, Math.round(preview.wordCount / 220))

  const handleStart = () => {
    if (!canRead) return
    state.startReading(value)
  }

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) {
        setValue(clip)
        state.setText(clip)
      }
    } catch {
      /* clipboard blocked — user can paste manually */
    }
  }

  return (
    <main
      className="reader-surface no-tap-highlight min-h-dvh px-5 pb-28 pt-[max(env(safe-area-inset-top),2rem)]"
      style={{ backgroundColor: theme.bg, color: theme.fg }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <header className="mb-6 flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: theme.chrome, color: theme.accent }}
          >
            <BookOpen className="size-5" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold leading-none" style={{ color: theme.accent }}>
              Zen Reader
            </h1>
            <p className="mt-1 text-sm" style={{ color: theme.muted }}>
              Paste a chapter. Read without the noise.
            </p>
          </div>
        </header>

        {/* Pillar 1: Paste URL Extractor */}
        <section aria-labelledby="url-extractor-label">
          <label id="url-extractor-label" htmlFor="chapter-url" className="mb-2 block text-sm font-medium" style={{ color: theme.muted }}>
            Paste Novel Chapter URL
          </label>
          <div
            className="flex items-center gap-2 rounded-2xl border pl-4 pr-2"
            style={{ backgroundColor: theme.chrome, borderColor: theme.border }}
          >
            <Link2 className="size-4 shrink-0" style={{ color: theme.muted }} aria-hidden />
            <input
              id="chapter-url"
              type="url"
              inputMode="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExtract()
              }}
              placeholder="https://your-favorite-novel-site.com/chapter-1"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:opacity-50"
              style={{ color: theme.fg }}
              disabled={extractState === 'loading'}
            />
            {urlValue.length > 0 && (
              <button
                type="button"
                onClick={handleClearUrl}
                aria-label="Clear URL"
                className="flex size-8 shrink-0 items-center justify-center rounded-full active:opacity-70"
                style={{ color: theme.muted }}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleExtract}
            disabled={!urlValue.trim() || extractState === 'loading'}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: theme.accent, color: theme.bg }}
          >
            {extractState === 'loading' ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {STATUS_MESSAGES[statusIndex]}
              </>
            ) : (
              <>
                Extract &amp; Read
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>

          {extractState === 'blocked' && (
            <div
              className="mt-3 flex items-start gap-3 rounded-2xl border p-3 text-sm"
              style={{ borderColor: theme.border, backgroundColor: theme.chrome }}
              role="alert"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" style={{ color: theme.accent }} aria-hidden />
              <div className="flex-1">
                <p style={{ color: theme.fg }}>{extractMessage}</p>
                <button
                  type="button"
                  onClick={handleSwitchToManual}
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2"
                  style={{ color: theme.accent }}
                >
                  <PenLine className="size-3.5" aria-hidden />
                  Switch to Manual Paste
                </button>
              </div>
            </div>
          )}

          {extractState === 'error' && (
            <div
              className="mt-3 flex items-start gap-3 rounded-2xl border p-3 text-sm"
              style={{ borderColor: theme.border, backgroundColor: theme.chrome }}
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: theme.muted }} aria-hidden />
              <p style={{ color: theme.fg }}>{extractMessage}</p>
            </div>
          )}
        </section>

        <div className="my-6 flex items-center gap-3 text-xs" style={{ color: theme.muted }}>
          <span className="h-px flex-1" style={{ backgroundColor: theme.border }} />
          OR PASTE MANUALLY
          <span className="h-px flex-1" style={{ backgroundColor: theme.border }} />
        </div>

        <label htmlFor="chapter" className="mb-2 text-sm font-medium" style={{ color: theme.muted }}>
          Chapter text
        </label>

        {sourceLabel && (
          <div
            className="mb-2 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
            style={{ borderColor: theme.border, color: theme.muted }}
          >
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Source: {sourceLabel}</span>
            <button
              type="button"
              onClick={() => setSourceLabel(null)}
              aria-label="Remove source label"
              className="ml-auto shrink-0 active:opacity-70"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            id="chapter"
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              state.setText(e.target.value)
            }}
            placeholder="Paste raw copied text or a chapter draft here…"
            spellCheck={false}
            className="min-h-[46dvh] w-full resize-none rounded-2xl border p-4 font-serif text-base leading-relaxed outline-none transition-colors placeholder:opacity-60 focus:ring-2"
            style={{
              backgroundColor: theme.chrome,
              color: theme.fg,
              borderColor: theme.border,
              // @ts-expect-error CSS custom prop for focus ring color
              '--tw-ring-color': theme.border,
              caretColor: theme.accent,
            }}
          />
          {value.length === 0 && (
            <button
              type="button"
              onClick={handlePaste}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-transform active:scale-95"
              style={{ borderColor: theme.border, color: theme.muted }}
            >
              <Clipboard className="size-3.5" aria-hidden />
              Paste
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: theme.muted }}>
          <span>
            {canRead
              ? `${preview.paragraphs.length} paragraphs · ${preview.wordCount.toLocaleString()} words · ~${minutes} min`
              : 'Waiting for text…'}
          </span>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setValue('')
                state.setText('')
              }}
              className="underline underline-offset-2 active:opacity-70"
            >
              Clear
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={!canRead}
          className="mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: theme.accent, color: theme.bg }}
        >
          Start Reading
          <ArrowRight className="size-5" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => {
            setValue(SAMPLE_TEXT)
            state.setText(SAMPLE_TEXT)
          }}
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-transform active:scale-[0.98]"
          style={{ borderColor: theme.border, color: theme.muted }}
        >
          <Sparkles className="size-4" aria-hidden />
          Load a sample chapter
        </button>
      </div>

      <nav
        className="fixed inset-x-4 z-30 mx-auto flex max-w-xl items-center justify-around rounded-2xl border p-2 shadow-2xl backdrop-blur-xl"
        style={{ bottom: 'max(env(safe-area-inset-bottom), 1rem)', backgroundColor: `${theme.chrome}ee`, borderColor: theme.border }}
        aria-label="Primary navigation"
      >
        {[[Home, 'Home'], [Search, 'Search'], [Library, 'Library'], [Settings, 'Settings']].map(([Icon, label], i) => (
          <button
            key={label as string}
            type="button"
            onClick={label === 'Settings' ? () => setSettingsOpen(true) : undefined}
            aria-label={label as string}
            className="flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-[10px]"
            style={{ color: i === 0 ? theme.accent : theme.muted }}
          >
            <Icon className="size-4" aria-hidden />
            {label as string}
          </button>
        ))}
      </nav>

      {settingsOpen && <SettingsDrawer state={state} theme={theme} onClose={() => setSettingsOpen(false)} />}
    </main>
  )
}
