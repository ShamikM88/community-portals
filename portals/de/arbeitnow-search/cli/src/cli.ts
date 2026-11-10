#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Arbeitnow's public job-board API (Germany-focused,
// includes English-speaking / remote-friendly listings). No external CLI framework, so it
// runs anywhere `bun` is available with zero install beyond the repo clone.
//
// See helpers.ts: the API has no server-side keyword/location search, only pagination —
// this CLI fetches one page and filters client-side.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { ArgError, parseArgs, type ParsedArgs } from "./args.js"
import { writeError } from "./helpers.js"

const HELP = `arbeitnow-cli — search jobs on Arbeitnow (Germany-focused, incl. English-speaking / remote)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords, matched against title, company, and tags. Recommended.
  --location, -l <text>   Substring match against the location field, e.g. "Berlin".
  --jobage <days>         Only jobs posted within N days (uses the API's created_at field).
  --page <n>              1-indexed server page to fetch (~176 jobs/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side, applied after filtering).
  --format <fmt>          json (default) | table | plain.

  Note: Arbeitnow's API has NO server-side search — --query/--location/--jobage all filter
  the ONE page fetched by --page, client-side. To search more broadly, call search again
  with a higher --page (jobs are in reverse-chronological order, so higher pages are older).

DETAIL
  <url>   The full "url" field from a search result. Bare job slugs cannot be turned into a
          URL on their own (the URL also needs the company slug) — always pass the URL.

EXAMPLES
  bun run src/cli.ts search -q "Product Owner" --format table
  bun run src/cli.ts search -q "Product Manager" -l Berlin --jobage 14 --format table
  bun run src/cli.ts search --page 2 --format json
  bun run src/cli.ts detail "https://www.arbeitnow.com/jobs/companies/awin/machine-learning-engineer-berlin-berlin-munchen-bavaria-180645" --format plain
`

async function main(): Promise<number> {
  let args: ParsedArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    if (e instanceof ArgError) {
      writeError(e.message, e.code)
      return 1
    }
    throw e
  }

  if (args.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (!args.command) {
    writeError("No command given. Use search or detail, or --help.", "NO_COMMAND")
    return 1
  }

  if (args.command === "search") {
    const f = args.flags
    const opts: SearchOpts = {
      query: f.query as string | undefined,
      location: f.location as string | undefined,
      jobageDays: f.jobage as number | undefined,
      page: (f.page as number | undefined) ?? 1,
      limit: f.limit as number | undefined,
      format: args.format as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (args.command === "detail") {
    const id = args.positional[0]
    if (!id) {
      writeError("detail requires a <url>", "NO_ID")
      return 1
    }
    const opts: DetailOpts = { id, format: args.format as DetailOpts["format"] }
    return runDetail(opts)
  }

  writeError(`Unknown command "${args.command}"`, "BAD_CMD")
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
