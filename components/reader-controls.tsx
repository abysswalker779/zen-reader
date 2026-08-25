'use client'

import { useState } from 'react'
import { ChevronLeft, Minus, Plus, Play, Pause, Gauge, Settings, X, Upload, Home, Search, Library } from 'lucide-react'
import {
  type ReaderTheme,
  THEME_ORDER,
  THEMES,
  SPACING,
  SCROLL_SPEEDS,
  FONT_MIN,
  FONT_MAX,
  type SpacingId,
} from '@/lib/reader'
import type { ReaderState } from '@/lib/use-reader-state'

interface Props {
  state: ReaderState
  theme: ReaderTheme
  chromeVisible: boolean
  autoScroll: boolean
  progress: number
  onExit: () => void
  onToggleAutoScroll: () => void
}

const SPACING_IDS: SpacingId[] = ['tight', 'normal', 'relaxed']

export function ReaderControls({
  state,
  theme,
  chromeVisible,
  autoScroll,
  progress,
  onExit,
  onToggleAutoScroll,
}: Props) {
  const { settings } = state
  const pct = Math.round(progress * 100)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => state.setCustomBackground(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  return (
    <>
      {/* Top bar */}
      <div
        className="fixed inset-x-0 top-0 z-20 transition-all duration-300"
        style={{
          transform: chromeVisible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? 'auto' : 'none',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]"
          style={{ backgroundColor: theme.chrome, borderColor: theme.border, color: theme.chromeFg }}
        >
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-medium transition-transform active:scale-95"
          >
            <ChevronLeft className="size-5" aria-hidden />
            Library
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums" style={{ color: theme.muted }}>{pct}%</span>
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open settings" className="flex size-9 items-center justify-center rounded-full border" style={{ borderColor: theme.border }}>
              <Settings className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {drawerOpen && <SettingsDrawer state={state} theme={theme} onClose={() => setDrawerOpen(false)} onUpload={handleUpload} />}

      {/* Bottom settings panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 transition-all duration-300"
        style={{
          transform: chromeVisible ? 'translateY(0)' : 'translateY(120%)',
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? 'auto' : 'none',
        }}
      >
        <div
          className="mx-auto flex max-w-2xl flex-col gap-4 border-t px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4"
          style={{ backgroundColor: theme.chrome, borderColor: theme.border, color: theme.chromeFg }}
        >
          {/* Theme switcher */}
          <Row label="Theme">
            <div className="flex gap-2">
              {THEME_ORDER.map((id) => {
                const t = THEMES[id]
                const active = settings.theme === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => state.setTheme(id)}
                    className="flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-medium transition-transform active:scale-95"
                    style={{
                      borderColor: active ? theme.chromeFg : theme.border,
                      backgroundColor: active ? theme.chromeFg : 'transparent',
                      color: active ? theme.chrome : theme.chromeFg,
                    }}
                    aria-pressed={active}
                  >
                    <span
                      className="size-4 rounded-full border"
                      style={{ backgroundColor: t.swatch, borderColor: theme.border }}
                      aria-hidden
                    />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </Row>

          {/* Font size */}
          <Row label="Text size">
            <div
              className="flex items-center gap-1 rounded-full border p-1"
              style={{ borderColor: theme.border }}
            >
              <IconBtn
                theme={theme}
                onClick={state.decreaseFont}
                disabled={settings.fontSize <= FONT_MIN}
                label="Decrease text size"
              >
                <Minus className="size-4" aria-hidden />
                <span className="text-xs font-semibold">A</span>
              </IconBtn>
              <span className="w-8 text-center text-xs tabular-nums" style={{ color: theme.muted }}>
                {settings.fontSize}
              </span>
              <IconBtn
                theme={theme}
                onClick={state.increaseFont}
                disabled={settings.fontSize >= FONT_MAX}
                label="Increase text size"
              >
                <span className="text-sm font-semibold">A</span>
                <Plus className="size-4" aria-hidden />
              </IconBtn>
            </div>
          </Row>

          {/* Line spacing */}
          <Row label="Line spacing">
            <Segmented
              theme={theme}
              options={SPACING_IDS.map((id) => ({ id, label: SPACING[id].label }))}
              value={settings.spacing}
              onChange={(id) => state.setSpacing(id as SpacingId)}
            />
          </Row>

          {/* Auto-scroll speed */}
          <Row label="Auto-scroll speed">
            <Segmented
              theme={theme}
              options={SCROLL_SPEEDS.map((s) => ({ id: s.id, label: s.label }))}
              value={settings.scrollSpeed}
              onChange={(id) => state.setScrollSpeed(id as typeof settings.scrollSpeed)}
            />
          </Row>
        </div>
      </div>

      {/* Always-available auto-scroll FAB */}
      <button
        type="button"
        onClick={onToggleAutoScroll}
        aria-pressed={autoScroll}
        aria-label={autoScroll ? 'Pause auto-scroll' : 'Start auto-scroll'}
        className="fixed bottom-[max(env(safe-area-inset-bottom),1.25rem)] right-4 z-30 flex items-center gap-2 rounded-full px-4 shadow-lg active:scale-95"
        style={{
          height: '3.25rem',
          backgroundColor: autoScroll ? theme.progress : theme.chrome,
          color: autoScroll ? theme.bg : theme.chromeFg,
          border: `1px solid ${theme.border}`,
          transform: chromeVisible ? 'translateY(-4rem)' : 'translateY(0)',
          transition: 'transform 0.3s ease, background-color 0.2s ease',
        }}
      >
        {autoScroll ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
        <span className="flex items-center gap-1 text-sm font-semibold">
          <Gauge className="size-4" aria-hidden />
          {SCROLL_SPEEDS.find((s) => s.id === settings.scrollSpeed)!.label}
        </span>
      </button>
    </>
  )
}

export function SettingsDrawer({ state, theme, onClose, onUpload }: { state: ReaderState; theme: ReaderTheme; onClose: () => void; onUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onUpload) return onUpload(event)
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => state.setCustomBackground(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Reader settings">
      <button type="button" aria-label="Close settings" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <aside className="absolute right-0 top-0 flex h-full w-[min(88vw,23rem)] flex-col gap-6 overflow-y-auto border-l p-5 pt-[max(env(safe-area-inset-top),1.25rem)] shadow-2xl" style={{ backgroundColor: theme.chrome, color: theme.chromeFg, borderColor: theme.border }}>
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] opacity-60">Reader</p><h2 className="mt-1 font-serif text-2xl font-semibold">Settings</h2></div><button type="button" onClick={onClose} aria-label="Close settings" className="flex size-9 items-center justify-center rounded-full border" style={{ borderColor: theme.border }}><X className="size-4" aria-hidden /></button></div>
        <section><p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">Theme</p><div className="grid grid-cols-2 gap-2">{THEME_ORDER.map((id) => { const t = THEMES[id]; const active = state.settings.theme === id; return <button key={id} type="button" onClick={() => state.setTheme(id)} aria-pressed={active} className="flex items-center gap-2 rounded-lg border p-2 text-left text-xs" style={{ borderColor: active ? theme.accent : theme.border, backgroundColor: active ? `${theme.accent}18` : 'transparent' }}><span className="size-4 rounded-full border" style={{ backgroundColor: t.swatch, borderColor: theme.border }} />{t.label}</button> })}</div></section>
        <section><p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">Theme customization</p><label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm" style={{ borderColor: theme.border }}><Upload className="size-4" aria-hidden /><span className="flex-1">Upload custom background</span><input type="file" accept="image/*" onChange={onUpload} className="sr-only" /></label>{state.settings.customBackground && <button type="button" onClick={() => state.setCustomBackground(null)} className="mt-2 text-xs underline opacity-70">Remove custom background</button>}<label className="mt-5 block text-sm">Dark overlay <span className="float-right tabular-nums opacity-60">{state.settings.customOverlay}%</span><input type="range" min="0" max="80" value={state.settings.customOverlay} onChange={(e) => state.setCustomOverlay(Number(e.target.value))} className="mt-3 w-full accent-current" /></label></section>
        <section><p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">Typography</p><div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: theme.border }}><span className="text-sm">Text size</span><div className="flex items-center gap-2"><IconBtn theme={theme} onClick={state.decreaseFont} disabled={state.settings.fontSize <= FONT_MIN} label="Decrease text size"><Minus className="size-4" /></IconBtn><span className="text-xs tabular-nums">{state.settings.fontSize}px</span><IconBtn theme={theme} onClick={state.increaseFont} disabled={state.settings.fontSize >= FONT_MAX} label="Increase text size"><Plus className="size-4" /></IconBtn></div></div></section>
        <section><p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">Reading behavior</p><Segmented theme={theme} options={SPACING_IDS.map((id) => ({ id, label: SPACING[id].label }))} value={state.settings.spacing} onChange={(id) => state.setSpacing(id as SpacingId)} /></section>
      </aside>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</span>
      {children}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  theme,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
  theme: ReaderTheme
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30"
      style={{ color: theme.chromeFg }}
    >
      {children}
    </button>
  )
}

function Segmented({
  options,
  value,
  onChange,
  theme,
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  theme: ReaderTheme
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border p-1"
      style={{ borderColor: theme.border }}
    >
      {options.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-transform active:scale-95"
            style={{
              backgroundColor: active ? theme.chromeFg : 'transparent',
              color: active ? theme.chrome : theme.chromeFg,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
