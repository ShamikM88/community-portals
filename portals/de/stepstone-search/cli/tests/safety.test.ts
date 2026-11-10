import { describe, expect, test } from "bun:test";
import {
  buildSearchUrl,
  countJobCardMarkers,
  decodeHtmlEntities,
  nextRedirectUrl,
  parseJobCards,
  slugify,
  stripControl,
} from "../src/helpers";

describe("redirects are checked before they are requested", () => {
  const current = "https://www.stepstone.de/jobs/product-owner/in-berlin";

  test("a same-host redirect, absolute or relative, is allowed", () => {
    expect(nextRedirectUrl(current, "https://www.stepstone.de/jobs/product-owner")).toBe(
      "https://www.stepstone.de/jobs/product-owner",
    );
    expect(nextRedirectUrl(current, "/jobs/product-manager")).toBe("https://www.stepstone.de/jobs/product-manager");
  });

  test("an off-host redirect, a downgrade to http, or a missing Location is refused", () => {
    expect(() => nextRedirectUrl(current, "https://example.com/x")).toThrow("Refusing");
    expect(() => nextRedirectUrl(current, "https://stepstone.de.evil.com/x")).toThrow("Refusing");
    expect(() => nextRedirectUrl(current, "http://www.stepstone.de/x")).toThrow("Refusing");
    expect(() => nextRedirectUrl(current, null)).toThrow("Location");
  });
});

describe("stripControl", () => {
  test("removes escape sequences and other control characters", () => {
    expect(stripControl("Safe\u001b[31m red \u001b]0;title\u0007 \u009b text")).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(stripControl("a\nb")).toBe("a b");
  });
});

describe("decodeHtmlEntities", () => {
  test("does not decode twice: &amp;lt; stays as the text &lt;", () => {
    expect(decodeHtmlEntities("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
    expect(decodeHtmlEntities("a &amp; b &lt; c")).toBe("a & b < c");
  });
});

describe("slugify and buildSearchUrl", () => {
  test("decomposed umlauts are transliterated like precomposed ones", () => {
    expect(slugify("München")).toBe("muenchen");
    expect(slugify("München")).toBe("muenchen");
    expect(slugify("Café Manager")).toBe("cafe-manager");
  });

  test("a query or location with nothing searchable is an error, not a generic search", () => {
    expect(() => buildSearchUrl("???", undefined)).toThrow("has no letters or digits");
    expect(() => buildSearchUrl("Product Owner", "***")).toThrow("has no letters or digits");
    expect(buildSearchUrl(undefined, undefined)).toBe("https://www.stepstone.de/jobs/jobs");
  });
});

describe("a markup change is loud, not 'no results'", () => {
  test("cards present but none parseable is detectable", () => {
    const html = '<div data-at="job-item" data-testid="job-item"><span>layout changed</span></div>'.repeat(3);
    expect(countJobCardMarkers(html)).toBe(3);
    expect(parseJobCards(html)).toHaveLength(0);
  });

  test("a page with no cards at all has zero markers", () => {
    expect(countJobCardMarkers("<html><body>nothing here</body></html>")).toBe(0);
  });
});
