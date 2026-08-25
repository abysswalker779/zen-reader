// Core types, theme definitions, and the manual text-processing engine
// for the Zen Reader. Everything here is framework-agnostic and pure.

export type ThemeId = 'chikari' | 'oled' | 'sepia' | 'light' | 'starry'
export type SpacingId = 'tight' | 'normal' | 'relaxed'
export type ScrollSpeedId = '0.5' | '1' | '2'

export interface ReaderTheme {
  id: ThemeId
  label: string
  /** Page background */
  bg: string
  /** Primary reading text */
  fg: string
  /** Secondary / meta text */
  muted: string
  /** Strong accent (active states, primary text) */
  accent: string
  /** Floating control surface background */
  chrome: string
  /** Control surface text */
  chromeFg: string
  /** Borders + progress track */
  border: string
  /** Progress fill */
  progress: string
  /** Small swatch preview used in the theme switcher */
  swatch: string
}

export const THEMES: Record<ThemeId, ReaderTheme> = {
  chikari: {
    id: 'chikari',
    label: 'Chikari Dark',
    bg: '#0e1117',
    fg: '#e6edf3',
    muted: '#8b949e',
    accent: '#58a6ff',
    chrome: '#161b22',
    chromeFg: '#e6edf3',
    border: '#30363d',
    progress: '#58a6ff',
    swatch: '#0e1117',
  },
  oled: {
    id: 'oled',
    label: 'OLED Black',
    bg: '#000000',
    fg: '#c9c9c9',
    muted: '#6f6f6f',
    accent: '#f2f2f2',
    chrome: '#141414',
    chromeFg: '#e8e8e8',
    border: '#2a2a2a',
    progress: '#e8e8e8',
    swatch: '#000000',
  },
  sepia: {
    id: 'sepia',
    label: 'Warm Sepia',
    bg: '#fbf0d9',
    fg: '#463522',
    muted: '#8c7a5e',
    accent: '#2f2416',
    chrome: '#f3e6c7',
    chromeFg: '#463522',
    border: '#e1d1a9',
    progress: '#8a6d3b',
    swatch: '#fbf0d9',
  },
  light: {
    id: 'light',
    label: 'Light',
    bg: '#ffffff',
    fg: '#1c1c1e',
    muted: '#8a8a8e',
    accent: '#0a0a0a',
    chrome: '#f6f6f7',
    chromeFg: '#1c1c1e',
    border: '#e6e6e8',
    progress: '#1c1c1e',
    swatch: '#ffffff',
  },
  starry: {
    id: 'starry',
    label: 'Starry Sky',
    bg: '#101827',
    fg: '#e8edf6',
    muted: '#9aa8bd',
    accent: '#9fc5ff',
    chrome: '#151f31',
    chromeFg: '#e8edf6',
    border: '#2b3a52',
    progress: '#9fc5ff',
    swatch: '#101827',
  },
}

export const THEME_ORDER: ThemeId[] = ['chikari', 'oled', 'sepia', 'light', 'starry']

export const SPACING: Record<SpacingId, { label: string; lineHeight: number; paragraphGap: string }> = {
  tight: { label: 'Tight', lineHeight: 1.45, paragraphGap: '0.9em' },
  normal: { label: 'Normal', lineHeight: 1.75, paragraphGap: '1.25em' },
  relaxed: { label: 'Relaxed', lineHeight: 2.1, paragraphGap: '1.6em' },
}

export const FONT_MIN = 15
export const FONT_MAX = 32
export const FONT_STEP = 1

export const SCROLL_SPEEDS: { id: ScrollSpeedId; label: string; pxPerSecond: number }[] = [
  { id: '0.5', label: '0.5x', pxPerSecond: 22 },
  { id: '1', label: '1x', pxPerSecond: 45 },
  { id: '2', label: '2x', pxPerSecond: 90 },
]

export interface ReaderSettings {
  theme: ThemeId
  fontSize: number
  spacing: SpacingId
  scrollSpeed: ScrollSpeedId
  customBackground: string | null
  customOverlay: number
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'chikari',
  fontSize: 20,
  spacing: 'normal',
  scrollSpeed: '1',
  customBackground: null,
  customOverlay: 55,
}

export interface ProcessedText {
  title: string | null
  paragraphs: string[]
  wordCount: number
}

/** Metadata attached to a chapter that was pulled in from a URL (Pillar 1). */
export interface ChapterMeta {
  sourceUrl: string
  prevUrl: string | null
  nextUrl: string | null
}

/**
 * Manual text-processing engine.
 *
 * Takes raw pasted text (with the messy line-breaks you get from copying out
 * of a browser or a doc) and turns it into clean reading paragraphs:
 *  - normalizes line endings and non-breaking spaces
 *  - collapses runs of spaces
 *  - splits into paragraphs on blank lines, and falls back to single
 *    line-breaks when the source has no blank lines at all
 *  - detects a plausible chapter title from the first short line
 */
export function processText(raw: string): ProcessedText {
  const normalized = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) {
    return { title: null, paragraphs: [], wordCount: 0 }
  }

  const hasBlankLines = /\n\s*\n/.test(normalized)
  const chunks = hasBlankLines ? normalized.split(/\n\s*\n/) : normalized.split(/\n/)

  let paragraphs = chunks.map((c) => c.replace(/\n/g, ' ').trim()).filter(Boolean)

  let title: string | null = null
  const first = paragraphs[0]
  // Treat a short opening line as a chapter title.
  if (first && first.length <= 80 && !/[.!?…]$/.test(first) && paragraphs.length > 1) {
    title = first
    paragraphs = paragraphs.slice(1)
  }

  const wordCount = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).filter(Boolean).length, 0)

  return { title, paragraphs, wordCount }
}

export const SAMPLE_TEXT = `The Cartographer of Fading Stars

Rain had not touched the city of Vell in three hundred days, and the astronomers had stopped counting.

Mira climbed the observatory stairs two at a time, her satchel of unfinished maps slapping against her hip. At the top, the great brass telescope waited like a sleeping animal, its lens fogged with the dust of a dry season that refused to end.

"You're late," said the old man without turning. He sat where he always sat, at the edge of the platform, feet dangling over a drop that would have frightened anyone else.

"The gate guards wanted a toll," Mira said. "I told them the sky doesn't charge admission."

He laughed at that, a dry sound like pages turning. "The sky charges everyone eventually. That's what we're here to measure."

She unrolled her latest chart across the cold stone floor and weighed the corners with river stones. Constellations she had drawn from memory now looked wrong to her, as though the stars had shifted a hair's width while she slept. It was not possible. And yet the old man had taught her that "not possible" was simply the name people gave to things they had not yet learned to see.

"Show me," he said.

Mira pointed to the northern quarter of her map, where a single star had begun to dim. Night after night it faded, and no one but the two of them seemed to notice. "It's going out," she whispered. "A whole star, going out."

The old man was quiet for a long time. When he finally spoke, his voice had lost its humor. "Then we had better finish the map," he said, "before there is nothing left to draw."`
