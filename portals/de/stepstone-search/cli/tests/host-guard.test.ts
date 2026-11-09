import { describe, expect, test } from "bun:test";
import { isStepStoneUrl } from "../src/helpers";

describe("host guard", () => {
  test("accepts stepstone.de over https", () => {
    expect(isStepStoneUrl("https://www.stepstone.de/jobs/product-owner/in-berlin")).toBe(true);
    expect(isStepStoneUrl("https://stepstone.de/jobs/product-owner")).toBe(true);
  });

  test("rejects other hosts, look-alikes, userinfo tricks and plain http", () => {
    expect(isStepStoneUrl("https://example.com/jobs/product-owner")).toBe(false);
    expect(isStepStoneUrl("https://stepstone.de.evil.com/jobs/product-owner")).toBe(false);
    expect(isStepStoneUrl("https://evil-stepstone.de/jobs")).toBe(false);
    expect(isStepStoneUrl("https://www.stepstone.de@evil.com/jobs")).toBe(false);
    expect(isStepStoneUrl("http://www.stepstone.de/jobs/product-owner")).toBe(false);
    expect(isStepStoneUrl("not a url")).toBe(false);
  });
});
