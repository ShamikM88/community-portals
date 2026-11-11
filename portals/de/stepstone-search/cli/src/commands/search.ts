import {
  buildSearchUrl,
  cleanDeep,
  countJobCardMarkers,
  htmlFetch,
  parseJobCards,
  SearchInputError,
  stripControl,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  limit?: number
  format: "json" | "table" | "plain"
}

export function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = stripControl(c.title || "").slice(0, 42).padEnd(42)
    const company = stripControl(c.company || "—").slice(0, 26).padEnd(26)
    const loc = stripControl(c.location || "—").slice(0, 24).padEnd(24)
    const date = stripControl(c.date || "—")
    return `${stripControl(c.id).padEnd(11)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(11) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(24) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

/** Four lines per result (title; company, location, date; id; url), separated by a blank line. */
export function renderPlain(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  return cards
    .map((c) =>
      [
        stripControl(c.title),
        `  ${stripControl(c.company || "—")} · ${stripControl(c.location || "—")} · ${stripControl(c.date || "—")}`,
        `  id: ${stripControl(c.id)}`,
        `  ${stripControl(c.url)}`,
      ].join("\n"),
    )
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildSearchUrl(opts.query, opts.location)
    const html = await htmlFetch(url)
    let cards = parseJobCards(html)
    const markers = countJobCardMarkers(html)
    if (markers > 0 && cards.length === 0) {
      writeError(
        `The page has ${markers} job cards but none could be parsed; StepStone's markup may have changed.`,
        "PARSE_FAILED",
      )
      return 1
    }
    if (cards.length < markers) {
      // Some cards did not parse: say so on stderr, keep the results we have.
      process.stderr.write(
        JSON.stringify({
          warning: `Parsed ${cards.length} of ${markers} job cards; StepStone's markup may have changed.`,
          code: "PARTIAL_PARSE",
        }) + "\n",
      )
    }
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(cards) + "\n")
    } else {
      process.stdout.write(JSON.stringify({ meta: { count: cards.length, url }, results: cleanDeep(cards) }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    if (e instanceof SearchInputError) {
      writeError(e.message, "BAD_ARG")
    } else {
      writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    }
    return 1
  }
}
