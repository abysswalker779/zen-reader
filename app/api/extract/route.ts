import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { processText } from '@/lib/reader'

export const maxDuration = 30

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const NEXT_PATTERN = /(next\s*chapter|next\s*episode|next\s*part|^next$|»|›|→)/i
const PREV_PATTERN = /(prev(ious)?\s*chapter|prev(ious)?\s*episode|prev(ious)?\s*part|^prev(ious)?$|«|‹|←)/i

const BLOCK_MARKERS = [
  'just a moment',
  'attention required',
  'checking your browser',
  'enable javascript and cookies',
  'cf-browser-verification',
  'captcha',
  'access denied',
  'are you a human',
  'ddos protection by cloudflare',
]

interface ExtractSuccess {
  ok: true
  title: string | null
  paragraphs: string[]
  wordCount: number
  prevUrl: string | null
  nextUrl: string | null
  sourceUrl: string
}

interface ExtractFailure {
  ok: false
  blocked: boolean
  message: string
}

function findChapterLink(doc: Document, baseUrl: string, pattern: RegExp): string | null {
  const anchors = Array.from(doc.querySelectorAll('a[href]'))
  for (const a of anchors) {
    const text = (a.textContent || '').trim()
    const rel = a.getAttribute('rel') || ''
    const aria = a.getAttribute('aria-label') || ''
    if (!pattern.test(text) && !pattern.test(rel) && !pattern.test(aria)) continue
    const href = a.getAttribute('href')
    if (!href) continue
    try {
      const resolved = new URL(href, baseUrl)
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue
      return resolved.toString()
    } catch {
      continue
    }
  }
  return null
}

function looksBlocked(status: number, html: string, title: string): boolean {
  if (status === 403 || status === 503 || status === 429) return true
  const haystack = `${title} ${html.slice(0, 4000)}`.toLowerCase()
  return BLOCK_MARKERS.some((marker) => haystack.includes(marker))
}

export async function POST(request: Request) {
  let targetUrl: string
  try {
    const body = await request.json()
    targetUrl = String(body?.url || '').trim()
  } catch {
    return Response.json({ ok: false, blocked: false, message: 'Invalid request.' } satisfies ExtractFailure, { status: 400 })
  }

  if (!targetUrl) {
    return Response.json({ ok: false, blocked: false, message: 'No URL provided.' } satisfies ExtractFailure, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('bad protocol')
  } catch {
    return Response.json({ ok: false, blocked: false, message: "That doesn't look like a valid URL." } satisfies ExtractFailure, { status: 400 })
  }

  let html: string
  let finalUrl = parsedUrl.toString()

  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    })
    finalUrl = res.url || finalUrl

    if (!res.ok && res.status !== 200) {
      // Grab a small sample for block-signature checks even on non-ok responses.
      const sample = await res.text().catch(() => '')
      if (looksBlocked(res.status, sample, '')) {
        return Response.json(
          { ok: false, blocked: true, message: 'Site protection detected. Copy text manually to bypass.' } satisfies ExtractFailure,
          { status: 200 },
        )
      }
      return Response.json(
        { ok: false, blocked: false, message: `The site responded with an error (${res.status}).` } satisfies ExtractFailure,
        { status: 200 },
      )
    }

    html = await res.text()

    if (looksBlocked(res.status, html, '')) {
      return Response.json(
        { ok: false, blocked: true, message: 'Site protection detected. Copy text manually to bypass.' } satisfies ExtractFailure,
        { status: 200 },
      )
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'TimeoutError'
    return Response.json(
      {
        ok: false,
        blocked: false,
        message: isAbort ? 'The request took too long. Try again or paste the text manually.' : 'Could not reach that URL.',
      } satisfies ExtractFailure,
      { status: 200 },
    )
  }

  try {
    // Parse once for chapter-navigation links (Readability mutates/strips the DOM it parses).
    const linkDom = new JSDOM(html, { url: finalUrl })
    const nextUrl = findChapterLink(linkDom.window.document, finalUrl, NEXT_PATTERN)
    const prevUrl = findChapterLink(linkDom.window.document, finalUrl, PREV_PATTERN)
    const pageTitle = linkDom.window.document.title || ''
    linkDom.window.close()

    // Parse again with a fresh document for content extraction.
    const contentDom = new JSDOM(html, { url: finalUrl })
    const article = new Readability(contentDom.window.document).parse()
    contentDom.window.close()

    if (!article || !article.textContent || article.textContent.trim().length < 40) {
      return Response.json(
        {
          ok: false,
          blocked: false,
          message: 'Could not find readable chapter content on that page.',
        } satisfies ExtractFailure,
        { status: 200 },
      )
    }

    const processed = processText(article.textContent)
    const title = (article.title || processed.title || pageTitle || null)?.trim() || null

    return Response.json(
      {
        ok: true,
        title,
        paragraphs: processed.paragraphs,
        wordCount: processed.wordCount,
        prevUrl: prevUrl && prevUrl !== finalUrl ? prevUrl : null,
        nextUrl: nextUrl && nextUrl !== finalUrl ? nextUrl : null,
        sourceUrl: finalUrl,
      } satisfies ExtractSuccess,
      { status: 200 },
    )
  } catch {
    return Response.json(
      { ok: false, blocked: false, message: 'Something went wrong while formatting that page.' } satisfies ExtractFailure,
      { status: 200 },
    )
  }
}
