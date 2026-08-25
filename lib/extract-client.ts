// Thin client for the /api/extract scraping engine (Pillar 1).

export interface ExtractSuccess {
  ok: true
  title: string | null
  paragraphs: string[]
  wordCount: number
  prevUrl: string | null
  nextUrl: string | null
  sourceUrl: string
}

export interface ExtractFailure {
  ok: false
  blocked: boolean
  message: string
}

export type ExtractResult = ExtractSuccess | ExtractFailure

export async function extractChapter(url: string): Promise<ExtractResult> {
  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      return { ok: false, blocked: false, message: 'The extractor is unavailable right now.' }
    }
    const data = (await res.json()) as ExtractResult
    return data
  } catch {
    return { ok: false, blocked: false, message: 'Network error while extracting that page. Check your connection.' }
  }
}

/** Reconstruct plain reading text from an extraction result so it flows through the same manual text-processing engine. */
export function buildChapterText(title: string | null, paragraphs: string[]): string {
  const body = paragraphs.join('\n\n')
  return title ? `${title}\n\n${body}` : body
}
