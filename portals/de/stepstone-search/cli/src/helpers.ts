// Data source: StepStone.de public job-search pages. No authentication required.
//
// robots.txt on stepstone.de disallows most query-string variations on /jobs/* (only a bare
// `?q=` with no other params is allowed) and disallows /search-results, /listing, and
// /public-api/ entirely (the JSON API that actually backs the search UI lives under
// /public-api/resultlist/ and is off-limits). The one fully compliant, static (no query
// string at all) pattern is the path-based search StepStone itself links to from category
// pages: /jobs/<title-slug>[/in-<city-slug>]. This CLI builds that URL and parses the
// server-rendered HTML — the search results are present in the initial HTML response, no
// client-side JS execution required.
//
// The markup is a React/Emotion app: class names like "res-xyz123" are Emotion-generated
// and NOT guaranteed stable across deploys, so parsing never keys off them. Anchors are
// `data-at="..."` and `data-genesis-element="..."` attributes, which behave like semantic
// test hooks and are the stable parsing surface used throughout this file.

export const BASE_URL = "https://www.stepstone.de"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

// An honest user-agent: this is a low-volume personal tool, not a browser.
const UA = "stepstone-search/1.0 (personal job-search tool, low volume)"

const ALLOWED_HOSTS = new Set(["www.stepstone.de", "stepstone.de"])

/** True only for an https URL on stepstone.de. Every request in this CLI goes through this check. */
export function isStepStoneUrl(input: string): boolean {
  try {
    const u = new URL(input)
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

const MAX_REDIRECTS = 5

function assertAllowedUrl(url: string): void {
  if (!isStepStoneUrl(url)) {
    throw new Error("Refusing to request a host other than stepstone.de")
  }
}

/** Resolve a redirect target and check it BEFORE any request is made to it. */
export function nextRedirectUrl(current: string, location: string | null): string {
  if (!location) throw new Error("Redirect without a Location header")
  const next = new URL(location, current).href
  assertAllowedUrl(next)
  return next
}

/** Strip terminal control characters (ESC, C0, C1, DEL) from remote text before printing it. */
export function stripControl(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
}

/**
 * Fetch search-result HTML with exponential backoff on 429/5xx. Returns "" on a 404.
 *
 * Only search pages are fetched. Job detail pages are deliberately not supported: StepStone
 * drops requests for them that do not look like a browser navigation, and this tool does not
 * work around that. Open a result's `url` in a browser to read the posting.
 */
export async function htmlFetch(startUrl: string): Promise<string> {
  let url = startUrl
  assertAllowedUrl(url)
  const maxRetries = 6
  let delay = 500
  let retries = 0
  let redirects = 0
  for (;;) {
    // Redirects are followed by hand so the target is checked before it is requested.
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    })
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      if (++redirects > MAX_REDIRECTS) throw new Error("Too many redirects")
      url = nextRedirectUrl(url, response.headers.get("location"))
      continue
    }
    if (response.status === 429 || response.status >= 500) {
      if (retries++ >= maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not `fromCharCode`) so
 * supplementary-plane code points decode correctly, and drops out-of-range values instead
 * of throwing.
 */
function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&") // last, so "&amp;lt;" stays "&lt;" instead of becoming "<"
}

/** Slugify free text into StepStone's kebab-case path-segment convention. */
export function slugify(text: string): string {
  return text
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Build the compliant, query-string-free search URL: /jobs/<title>[/in-<city>]. */
export function buildSearchUrl(query: string | undefined, location: string | undefined): string {
  let titleSlug = "jobs"
  if (query !== undefined) {
    titleSlug = slugify(query)
    if (!titleSlug) throw new Error(`--query "${query}" has no letters or digits to search for`)
  }
  let path = `/jobs/${titleSlug}`
  if (location !== undefined) {
    const citySlug = slugify(location)
    if (!citySlug) throw new Error(`--location "${location}" has no letters or digits to search for`)
    path += `/in-${citySlug}`
  }
  return `${BASE_URL}${path}`
}

/**
 * Extract the last "leaf" text node inside a bounded HTML window. StepStone's markup nests
 * the actual text either directly inside a `data-genesis-element="TEXT"` span or one level
 * deeper inside a `data-genesis-element="BASE"` div — both patterns appear depending on the
 * field, so this matches either and takes the last (innermost/rightmost) occurrence, which
 * is always the real text rather than an icon or wrapper element.
 */
function lastLeafText(window: string): string | null {
  const matches = [...window.matchAll(/data-genesis-element="(?:TEXT|BASE)"[^>]*>([^<]+)</g)]
  if (!matches.length) return null
  const text = decodeHtmlEntities(matches[matches.length - 1]![1]!).trim()
  return text || null
}

/**
 * Slice from a `data-at="..."` marker up to (but not including) the next `data-at="..."`,
 * trimmed back to the last complete `>` so the window never ends mid-tag.
 */
function windowFromMarker(chunk: string, markerIdx: number, fallbackLen = 3000): string {
  if (markerIdx < 0) return ""
  const nextAt = chunk.indexOf('data-at="', markerIdx + 30)
  let end = nextAt > 0 ? nextAt : markerIdx + fallbackLen
  const lastGt = chunk.lastIndexOf(">", end)
  if (lastGt > markerIdx) end = lastGt + 1
  return chunk.slice(markerIdx, end)
}

const CARD_MARKER = /data-at="job-item" data-testid="job-item"/

/** How many job-card openings the page contains, whether or not they parse. */
export function countJobCardMarkers(html: string): number {
  return html.split(CARD_MARKER).length - 1
}

/**
 * Parse the search-results page. Splits on each job card's opening marker and parses each
 * chunk independently so one malformed card cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(CARD_MARKER).slice(1)

  for (const raw of chunks) {
    const chunk = raw.slice(0, 20000)

    const hrefMatch = chunk.match(/data-genesis-element="ANCHOR" href="([^"]+)" data-testid="job-item-title"/)
    if (!hrefMatch) continue
    const href = hrefMatch[1]!
    const idMatch = href.match(/--(\d+)-inline\.html/)
    if (!idMatch) continue
    const id = idMatch[1]!
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`

    const titleIdx = chunk.indexOf('data-at="job-item-title"')
    const title = lastLeafText(windowFromMarker(chunk, titleIdx))
    if (!title) continue

    const companyIdx = chunk.indexOf('data-at="job-item-company-name"')
    const company = lastLeafText(windowFromMarker(chunk, companyIdx))

    const locIdx = chunk.indexOf('data-at="job-item-location"')
    const location = lastLeafText(windowFromMarker(chunk, locIdx))

    const timeIdx = chunk.indexOf('data-at="job-item-timeago"')
    const timeWindow = timeIdx >= 0 ? chunk.slice(timeIdx, timeIdx + 200) : ""
    const timeMatch = timeWindow.match(/<time[^>]*>([^<]*)</)
    const date = timeMatch ? decodeHtmlEntities(timeMatch[1]!).trim() || null : null

    results.push({ id, title, company, location, date, url })
  }

  return results
}
