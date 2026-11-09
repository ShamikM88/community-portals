#!/usr/bin/env bun
// Self-contained CLI for searching jobs on StepStone.de (Germany). No external CLI
// framework, so it runs anywhere `bun` is available with zero install beyond the repo clone.
//
// See helpers.ts for why search uses a path-based URL (/jobs/<title>/in-<city>) instead of a
// query-string API: robots.txt disallows the query-string search endpoints and the JSON API
// that backs the UI, but explicitly does not disallow this path pattern.

import { runSearch, type SearchOpts } from "./commands/search.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `stepstone-cli — search jobs on StepStone.de (Germany)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <url>        (not supported, see DETAIL below)

SEARCH FLAGS
  --query, -q <text>      Job title / keywords, e.g. "Product Owner". Recommended.
  --location, -l <text>   City, e.g. "Berlin", "Muenchen". Optional.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

  Note: StepStone's robots.txt only allows a single compliant search URL per query (no
  --page or --jobage params — see url-reference.md). Each search returns one page of
  results (StepStone's own default page size); there is no page-2 URL that stays
  robots.txt-compliant on this path.

DETAIL
  Not supported. StepStone blocks plain requests for job detail pages and this tool does not
  work around that. Open the job's \`url\` from a search result in a browser instead.

EXAMPLES
  bun run src/cli.ts search -q "Product Owner" -l Berlin --format table
  bun run src/cli.ts search -q "Produktmanager Zahlungsverkehr" -l "Frankfurt am Main" --format table
  bun run src/cli.ts search -q "Product Manager" --format json
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
        return null
      }
      return val
    }

    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    process.stderr.write(
      JSON.stringify({
        error:
          "detail is not supported for StepStone: it blocks plain requests for job pages. Open the job's url from a search result in a browser.",
        code: "DETAIL_NOT_SUPPORTED",
      }) + "\n",
    )
    return 1
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
