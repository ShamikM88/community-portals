import { describe, expect, test } from "bun:test";
import {
  buildSearchUrl,
  cleanDeep,
  countJobCardMarkers,
  decodeHtmlEntities,
  isRobotsAllowedPath,
  nextRedirectUrl,
  parseJobCards,
  SearchInputError,
  slugify,
  stripControl,
} from "../src/helpers";
import { renderPlain } from "../src/commands/search";
import { runCLI } from "./helpers";

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

describe("robots.txt paths", () => {
  test("ordinary search paths are allowed, including teilzeit with a city", () => {
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/product-owner")).toBe(true);
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/product-owner/in-berlin")).toBe(true);
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/teilzeit/in-berlin")).toBe(true);
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/product-owner-vollzeit")).toBe(true);
  });

  test("the disallowed categories, other routes and any query string are refused", () => {
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/vollzeit/in-berlin")).toBe(false);
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/vollzeit")).toBe(false);
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/home-office/in-berlin")).toBe(false);
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/teilzeit")).toBe(false);
    expect(isRobotsAllowedPath("https://www.stepstone.de/public-api/resultlist/")).toBe(false);
    expect(isRobotsAllowedPath("https://www.stepstone.de/search-results")).toBe(false);
    expect(isRobotsAllowedPath("https://www.stepstone.de/listing/x")).toBe(false);
    expect(isRobotsAllowedPath("https://www.stepstone.de/jobs/product-owner?q=x")).toBe(false);
  });

  test("a redirect to a disallowed path on the same host is refused before it is requested", () => {
    const current = "https://www.stepstone.de/jobs/product-owner/in-berlin";
    expect(() => nextRedirectUrl(current, "/public-api/resultlist/")).toThrow("robots.txt");
    expect(() => nextRedirectUrl(current, "/jobs/vollzeit/in-berlin")).toThrow("robots.txt");
    expect(() => nextRedirectUrl(current, "/jobs/product-owner?x=1")).toThrow("robots.txt");
  });

  test("a search that would build a disallowed URL is a BAD_ARG error, not a request", async () => {
    expect(() => buildSearchUrl("Vollzeit", "Berlin")).toThrow(SearchInputError);
    expect(() => buildSearchUrl("Home Office", "Berlin")).toThrow("robots.txt");
    expect(() => buildSearchUrl("Teilzeit", undefined)).toThrow("give a --location");
    expect(buildSearchUrl("Teilzeit", "Berlin")).toBe("https://www.stepstone.de/jobs/teilzeit/in-berlin");
    const result = await runCLI(["search", "--query", "Vollzeit"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG");
  });
});

describe("cleanDeep", () => {
  test("strips C1 and C0 controls from every string, including nested ones", () => {
    const cleaned = cleanDeep({ title: "a\u009bb\u001bc", nested: { list: ["x\u009by"] }, n: 3 });
    // Check the raw strings: JSON.stringify would escape a leftover ESC and hide it from the regex.
    for (const text of [cleaned.title, cleaned.nested.list[0]]) {
      expect(text).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    }
    expect(cleaned.title.startsWith("a")).toBe(true);
    expect(cleaned.title.endsWith("c")).toBe(true);
    expect(cleaned.n).toBe(3);
  });
});

describe("plain output", () => {
  test("keeps four lines per result and strips controls inside each field", () => {
    const out = renderPlain([
      { id: "1\u001b", title: "T\u001b[31m", company: "C\u001b", location: "L\u009b", date: "vor 1 Tag\u001b", url: "https://www.stepstone.de/x\u001b" },
    ]);
    expect(out.split("\n")).toHaveLength(4);
    // Newlines between the four lines are expected; every other control character is not.
    expect(out).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
    expect(renderPlain([])).toBe("No results.");
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

  test("reversed attribute order is still counted and parsed as a card boundary", () => {
    const reversed = '<div data-testid="job-item" data-at="job-item"><span>layout changed</span></div>';
    expect(countJobCardMarkers(reversed)).toBe(1);
    expect(countJobCardMarkers('<div data-at="job-item" class="x">only one attribute</div>')).toBe(1);
  });

  test("a CSS selector that mentions the attribute is not a card", () => {
    const css = '<style data-emotion="res x">.res-a [data-genesis-element="CARD"],.res-a [data-at="job-item"]{border-radius:4px;}</style>';
    expect(countJobCardMarkers(css)).toBe(0);
    expect(countJobCardMarkers(css + '<article id="job-item-1" data-at="job-item" data-testid="job-item"></article>')).toBe(1);
  });

  test("a page that mixes the two single-attribute forms counts every card", () => {
    const mixed = '<div data-at="job-item">a</div><div data-testid="job-item">b</div><div data-at="job-item" data-testid="job-item">c</div>';
    expect(countJobCardMarkers(mixed)).toBe(3);
  });

  test("a page with no cards at all has zero markers", () => {
    expect(countJobCardMarkers("<html><body>nothing here</body></html>")).toBe(0);
  });
});
