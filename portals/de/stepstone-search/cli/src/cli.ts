#!/usr/bin/env bun
// Self-contained CLI for searching jobs on StepStone.de (Germany). No external CLI
// framework, so it runs anywhere `bun` is available with zero install beyond the repo clone.
//
// See helpers.ts for why search uses a path-based URL (/jobs/<title>/in-<city>) instead of a
// query-string API: robots.txt disallows the query-string search endpoints and the JSON API
// that backs the UI, but explicitly does not disallow this path pattern.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { ArgError, parseArgs, type ParsedArgs } from "./args.js"
import { writeError } from "./helpers.js"

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
    writeError("No command given. Use search, or --help.", "NO_COMMAND")
    return 1
  }

  if (args.command === "search") {
    const f = args.flags
    const opts: SearchOpts = {
      query: f.query as string | undefined,
      location: f.location as string | undefined,
      limit: f.limit as number | undefined,
      format: args.format as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (args.command === "detail") {
    writeError(
      "detail is not supported for StepStone: it blocks plain requests for job pages. Open the job's url from a search result in a browser.",
      "DETAIL_NOT_SUPPORTED",
    )
    return 1
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
