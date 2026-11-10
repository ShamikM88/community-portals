import { describe, expect, test } from "bun:test";
import { decodeHtmlEntities, isDisallowedPath, nextRedirectUrl, stripControl } from "../src/helpers";
import { runCLI } from "./helpers";

describe("redirects are checked before they are requested", () => {
  const current = "https://www.arbeitnow.com/jobs/companies/acme/some-job-1";

  test("a same-host redirect, absolute or relative, is allowed", () => {
    expect(nextRedirectUrl(current, "https://www.arbeitnow.com/jobs/companies/acme/other-2")).toBe(
      "https://www.arbeitnow.com/jobs/companies/acme/other-2",
    );
    expect(nextRedirectUrl(current, "/jobs/companies/acme/other-2")).toBe("https://www.arbeitnow.com/jobs/companies/acme/other-2");
  });

  test("a redirect to another Arbeitnow regional domain is allowed", () => {
    expect(nextRedirectUrl(current, "https://www.arbeitnow.co.uk/jobs/companies/acme/other-2")).toBe(
      "https://www.arbeitnow.co.uk/jobs/companies/acme/other-2",
    );
  });

  test("an off-host redirect, a downgrade to http, or a missing Location is refused", () => {
    expect(() => nextRedirectUrl(current, "https://example.com/x")).toThrow("Refusing");
    expect(() => nextRedirectUrl(current, "https://arbeitnow.com.evil.com/x")).toThrow("Refusing");
    expect(() => nextRedirectUrl(current, "http://www.arbeitnow.com/x")).toThrow("Refusing");
    expect(() => nextRedirectUrl(current, null)).toThrow("Location");
  });

  test("a redirect into an apply page is refused", () => {
    expect(() => nextRedirectUrl(current, "/jobs/companies/acme/apply")).toThrow("apply page");
  });
});

describe("apply pages are never requested", () => {
  test("apply paths are disallowed, job pages are not", () => {
    expect(isDisallowedPath("https://www.arbeitnow.com/jobs/companies/acme/apply")).toBe(true);
    expect(isDisallowedPath("https://www.arbeitnow.com/jobs/companies/acme/some-job-1/apply")).toBe(true);
    expect(isDisallowedPath("https://www.arbeitnow.com/jobs/companies/acme/some-job-1")).toBe(false);
    expect(isDisallowedPath("https://www.arbeitnow.com/api/job-board-api?page=1")).toBe(false);
  });

  test("detail refuses an apply URL before making any request", async () => {
    const result = await runCLI(["detail", "https://www.arbeitnow.com/jobs/companies/acme/apply"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("BAD_ID");
  });
});

describe("stripControl", () => {
  test("removes escape sequences and other control characters", () => {
    expect(stripControl("Safe\u001b[31m red \u001b]0;title\u0007 \u009b text")).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(stripControl("a\nb")).toBe("a b");
  });

  test("keepNewlines keeps line breaks and tabs but still removes escapes", () => {
    expect(stripControl("line1\nline2\tx\u001b[2J", true)).toBe("line1\nline2\tx[2J");
  });
});

describe("decodeHtmlEntities", () => {
  test("does not decode twice: &amp;lt; stays as the text &lt;", () => {
    expect(decodeHtmlEntities("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
    expect(decodeHtmlEntities("a &amp; b &lt; c")).toBe("a & b < c");
  });
});
