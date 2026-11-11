# StepStone.de URL Reference

Public, unauthenticated pages used by this skill. No credentials required. **All URLs are
static, query-string-free paths** — see "Why no query string?" below for the reason.

## robots.txt summary (re-checked 2026-11-11)

The relevant rules from `https://www.stepstone.de/robots.txt`, all in the `User-agent: *` group:

```
Disallow: /jobs/vollzeit/
Disallow: /jobs/teilzeit/
Allow: /jobs/teilzeit/in-*
Disallow: /jobs/teilzeit/in-*?*
Allow: /jobs/teilzeit/in-*?q=*
Disallow: /jobs/home-office/
Disallow: /jobs/*?*
Allow: /jobs/*?q=*
Disallow: /jobs/*?q*&*
Disallow: /search-results
Disallow: /search-results/*
Disallow: /listing
Disallow: /listing/*
Disallow: /public-api/
```

- `/jobs/*` with **any** query string is disallowed, **except** a bare `?q=<value>` with no
  other parameters (the `Disallow: /jobs/*?q*&*` line blocks appending anything else via `&`).
  This CLI uses no query string at all (see below), so none of those rules are in play.
- The category paths `/jobs/vollzeit/`, `/jobs/home-office/` and `/jobs/teilzeit/` are
  disallowed. `/jobs/teilzeit/in-<city>` is allowed by the longer `Allow` line. The CLI refuses
  a query that is only one of those words (a `teilzeit` search needs a `--location`), and
  `isRobotsAllowedPath()` in `helpers.ts` enforces the same rules on every request and every
  redirect target.
- `/search-results` and `/listing` (the classic results-page routes) are fully disallowed.
- `/public-api/` is disallowed — this is the endpoint (`/public-api/resultlist/`) that actually
  backs the search UI's live results (visible in the page's client bundle), so it is off-limits
  even though it would be the "obvious" JSON API to call. A redirect to it is refused.
- Any other `/jobs/<slug>[/in-<city>]` path (path-segment search, no query string) is allowed.
  Job detail pages (`/stellenangebote--...`) are not disallowed either, but this CLI does not
  fetch them (see below).

## Why no query string?

Given the above, this CLI never constructs a `/jobs/*?...` URL. Instead it uses the path-based
search pattern that StepStone's own site links to from job-title/category landing pages:

```
GET https://www.stepstone.de/jobs/<title-slug>[/in-<city-slug>]
```

This is a fully static path (no `?`), so none of the query-string rules above apply to it.
Confirmed live with real, differently-filtered results for:
- `/jobs/product-owner` (no location)
- `/jobs/product-owner/in-berlin` (title + city)
- `/jobs/backend-entwickler-python/in-muenchen`
- `/jobs/asdkjaslkdjalksd-not-a-real-title` (garbage slug still 200s — StepStone does fuzzy
  matching on the slug, not exact lookup, so it degrades gracefully rather than 404ing)

Slugs are built by `slugify()` in `cli/src/helpers.ts`: Unicode-normalised and lowercased,
German umlauts/ß transliterated (`ä`→`ae`, `ö`→`oe`, `ü`→`ue`, `ß`→`ss`), other accented
letters folded to their base letter (`é`→`e`), everything else collapsed to hyphens. A query
or location with no letters or digits is an error, not a generic search.

**Trade-off:** because there is no compliant way to pass `page` or `jobage` params on this
path, this CLI only returns StepStone's single default results page per query (StepStone's own
page size, not user-configurable) and does not support `--page`/`--jobage`. `--limit` still caps
results client-side.

## Search results page structure

The search results are present in the **initial server-rendered HTML** — no client-side JS
execution needed. Each result is a card; cards are split on:

```
data-at="job-item" data-testid="job-item"
```

Within a card, per-field anchors (all `data-at="..."` attributes — see "Markup stability" below):

| Field | Anchor | Notes |
|-------|--------|-------|
| id, url | `data-testid="job-item-title"` anchor's `href` | `href` matches `--(\d+)-inline\.html`; the digits are the id |
| title | `data-at="job-item-title"` | text is the last `data-genesis-element="TEXT"` or `"BASE"` leaf in the window |
| company | `data-at="job-item-company-name"` | same leaf-text pattern |
| location | `data-at="job-item-location"` | same leaf-text pattern; can be a comma-separated list of cities for multi-location postings |
| date | `data-at="job-item-timeago"` | a German relative-time string (`vor 3 Tagen`, `vor 1 Woche`), **not** an ISO date — StepStone does not expose an absolute date/datetime attribute here. `null` on sponsored/pinned cards, which don't show a timeago. |

~25 results per default page (observed; not documented, may vary).

## Job detail pages (not fetched)

```
GET https://www.stepstone.de/stellenangebote--<slug>--<id>-inline.html
```

`<slug>` is free text that StepStone itself generates in search-result links. This CLI never
fetches these pages. Observed during development: a request for one without a browser-style
`Referer` header hangs or drops the connection (15-30s timeouts, zero bytes received), while
the same request with one succeeds. Sending that header would be a workaround for the site's
blocking, so this CLI does not fetch detail pages at all. The `url` field on each search result
is the link to open in a browser.

## Markup stability warning

This is a React app using Emotion CSS-in-JS. Class names like `res-du9bhi`, `job-ad-display-xxeiht`
are **generated per build and not guaranteed stable** — do not parse against them. Everything in
the parser keys off `data-at`, `data-genesis-element` and `data-testid` attributes instead (the
card boundary is `data-at="job-item" data-testid="job-item"` in either order, the title link is
the `<a>` tag carrying `data-testid="job-item-title"` with its `href` read from the same tag,
and the date is the text of the `<time>` element inside `data-at="job-item-timeago"`), which read
as intentional, semantic test/analytics hooks and were stable across all pages fetched during
development (search results, multiple queries). The field markers (`data-at="job-item-title"`,
`-company-name`, `-location`, `-timeago`) are still matched as written. Renaming
`data-at="job-item-title"` drops every card; renaming one of the other three leaves the cards but
makes that field `null` for all of them, so an all-null company, location or date is the symptom of
a rename. When the page has job cards but none parse, the CLI fails with `PARSE_FAILED` instead
of reporting "No results". If that happens, check whether these attributes were renamed or
restructured first.

## Notes

- No authentication required for search pages.
- The CLI backs off on 429/5xx with exponential backoff + jitter (max 6 retries), matching the
  other portal skills in this repo.
- Job IDs are purely numeric (e.g. `14255090`). The `url` on each search result is the link to the posting.
