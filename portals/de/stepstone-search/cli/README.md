# stepstone-cli

CLI for searching jobs on **StepStone.de** (Germany), across any sector.

**Data source**: StepStone.de public search pages (`/jobs/<title>[/in-<city>]`).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Personal use, low volume.** StepStone's robots.txt disallows most search endpoints and its
> JSON API entirely; this CLI only uses the paths it explicitly permits. The site also blocks
> plain requests for job detail pages, so this CLI does not fetch them. Keep volume low, don't use it for bulk data collection, and run it on
> your own responsibility. See `../url-reference.md` for the full robots.txt analysis.

## Installation

```bash
cd .agents/skills/stepstone-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` recommended, `--location` optional) |
| `detail` | Not supported: fails with `DETAIL_NOT_SUPPORTED`. Open the `url` from a `search` result in a browser |

`search` accepts `--format json|table|plain` (default `json`).
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Product Owner roles in Berlin
bun run src/cli.ts search -q "Product Owner" -l "Berlin" --format table

# Product Manager roles anywhere in Germany
bun run src/cli.ts search -q "Product Manager" --format table
```

See `../SKILL.md` for the full flag reference and the personal-use note.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Job title / keywords, e.g. `"Product Owner"`. Recommended. |
| `--location` | `-l` | German city, e.g. `"Berlin"`. Optional. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

No `--jobage` or `--page` — see `../url-reference.md` for why (robots.txt allows at most a bare
`?q=<text>` on `/jobs/*` and no other query parameters, so this CLI uses the static path form
with no query string at all, which leaves no way to add them).

## Why this CLI's search URL has no query string

StepStone's robots.txt disallows almost every query-string variant on `/jobs/*` and disallows
the JSON API that backs its own search UI (`/public-api/resultlist/`) outright. The one
compliant, static pattern — `/jobs/<title-slug>/in-<city-slug>` — is what this CLI builds. Full
analysis in `../url-reference.md`.

## Why there is no detail command

StepStone silently drops requests for `/stellenangebote--...-inline.html` pages that do not look
like a browser navigation. Getting past that would mean imitating a browser, which this CLI does
not do: it identifies itself honestly and stays on the search pages robots.txt permits.
