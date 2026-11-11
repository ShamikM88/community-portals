import { cleanDeep, htmlFetch, isArbeitnowUrl, isDisallowedPath, parseJobDetail, stripControl, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

function toUrl(input: string): string | null {
  const url = input.startsWith("http")
    ? input
    : input.startsWith("/jobs/companies/")
      ? `https://www.arbeitnow.com${input}`
      : null
  return url && isArbeitnowUrl(url) && !isDisallowedPath(url) ? url : null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const url = toUrl(opts.id)
  if (!url) {
    writeError(
      `"${opts.id}" is not an arbeitnow.com job URL (apply pages are excluded). Arbeitnow job slugs alone can't be turned into a URL (the URL also needs the company slug) — pass the full "url" field from a search result instead.`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(url)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, url)
    if (!job) {
      writeError("Could not find JobPosting structured data on that page", "PARSE_FAILED")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.datePosted ? `Posted: ${job.datePosted}` : "",
        job.validThrough ? `Valid through: ${job.validThrough}` : "",
        job.benefits ? `Benefits: ${job.benefits}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(stripControl(lines.join("\n"), true) + "\n")
    } else {
      process.stdout.write(JSON.stringify(cleanDeep(job, true), null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
