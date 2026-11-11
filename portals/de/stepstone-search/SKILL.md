---
name: stepstone-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Germany, find German job
  listings on StepStone, or asks anything about
  the German job market via StepStone — even if they don't say "stepstone" explicitly.
  Invoke for open positions, job vacancies, hiring in Germany, or German-market roles in
  any sector. Trigger phrases include: stepstone, jobsuche, stellenangebote, stellenanzeige,
  jobs in deutschland, stellenmarkt, jobboerse, jobbörse, job search germany, german jobs,
  jobs in berlin, jobs in munich, jobs in muenchen, jobs in frankfurt, jobs in hamburg,
  jobs in cologne, jobs in koeln, product owner jobs germany, product manager jobs germany,
  english speaking jobs germany, jobs deutschland, arbeit finden, offene stellen.
context: fork
enabled: false  # German portal - ships opt-in; /setup enables it when your market is Germany, or set true here yourself
allowed-tools: Bash(bun run .agents/skills/stepstone-search/cli/src/cli.ts *)
---

# StepStone Search Skill

Search live German job listings from StepStone.de. No authentication needed, **zero runtime
dependencies** — it runs with just `bun`.

## Personal use, low volume

StepStone's `robots.txt` disallows most of the site's query-string search endpoints and its
JSON API entirely (`/public-api/resultlist/`); this skill only uses the paths it explicitly
permits (see `url-reference.md` for the exact rules). StepStone also blocks plain requests for
job detail pages, so this skill does not fetch them and does not work around the block. The
robots.txt rules and the blocking are signs the site does not want heavy automated traffic.
**Keep volume low, don't use this for bulk data collection, and run it
on your own responsibility.**

## When to use this skill

- Search for job openings in Germany by job title/keyword, optionally filtered by city
- Explore the German job market for a given role type

## Commands

### Search job listings

```bash
bun run .agents/skills/stepstone-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — job title / keywords, e.g. `"Product Owner"`. Recommended.
- `--location <text>` / `-l <text>` — a German city, e.g. `"Berlin"`, `"Muenchen"`. Optional — omit for all of Germany.
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

Query syntax: no phrase quoting and no OR. The query becomes a URL slug (quotes and punctuation turn into hyphens, so `"product owner"` and `product owner` search the same way, and a word like OR is just another word in the slug), which StepStone fuzzy-matches.

> **Categories that are refused.** StepStone's robots.txt disallows `/jobs/vollzeit/` and `/jobs/home-office/` with or without a city, and `/jobs/teilzeit/` without a city. A query that is only `Vollzeit` or `Home Office` fails with `BAD_ARG` whatever `--location` says; `Teilzeit` is accepted only together with `--location`. Add words, for example `"Product Owner Vollzeit"`.

> **No `--jobage` or `--page`.** StepStone's robots.txt only allows a single, query-string-free
> search URL per query (see `url-reference.md`) — there is no robots.txt-compliant way to
> request a second page or filter by posting age via URL parameters on this path. Each search
> returns StepStone's own default single page of results (observed ~25).

### Job detail (not supported)

`detail` exists only to fail clearly: it prints `{ "error": "...", "code": "DETAIL_NOT_SUPPORTED" }`
to stderr and exits `1`. StepStone drops requests for job pages that do not look like a browser
navigation, and this skill does not imitate one. Open the `url` from a `search` result in a
browser to read the full posting.

## Usage examples

```bash
# Product Owner roles in Berlin
bun run .agents/skills/stepstone-search/cli/src/cli.ts search -q "Product Owner" -l "Berlin" --format table

# Product Manager roles anywhere in Germany
bun run .agents/skills/stepstone-search/cli/src/cli.ts search -q "Product Manager" --format table

# Payments-specific search
bun run .agents/skills/stepstone-search/cli/src/cli.ts search -q "Produktmanager Zahlungsverkehr" -l "Frankfurt am Main" --format table
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use |
| `table` | Quick human-readable scanning |
| `plain` | Plain text, four lines per result (title, company · location · date, id, url) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Query keywords are **English or German** — StepStone does fuzzy matching on the URL slug, so
  either works ("Product Owner" and "Produktmanager" both return relevant results); English
  keywords are fine when you only want English-speaking roles.
- The `date` field holds **German relative-time strings** (`vor 3 Tagen`, `vor 1
  Woche`), not ISO dates — StepStone does not expose an absolute posting date anywhere in the
  markup this CLI can reach.
- Results can list multiple cities for one posting (multi-location roles) — `location` may be a
  comma-separated string.
- See `url-reference.md` for the full robots.txt analysis and the markup anchors used on search pages.
