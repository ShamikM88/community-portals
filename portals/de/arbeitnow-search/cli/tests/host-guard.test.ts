import { describe, expect, test } from "bun:test";
import { isArbeitnowUrl } from "../src/helpers";
import { runCLI } from "./helpers";

describe("host guard", () => {
  test("accepts Arbeitnow's regional domains, which the API really returns", () => {
    expect(isArbeitnowUrl("https://www.arbeitnow.co.uk/jobs/companies/lendable/tpm-london-371639")).toBe(true);
    expect(isArbeitnowUrl("https://www.arbeitnow.fr/jobs/companies/acme/x-1")).toBe(true);
    expect(isArbeitnowUrl("https://www.arbeitnow.ch/jobs/companies/acme/x-1")).toBe(true);
    expect(isArbeitnowUrl("https://www.arbeitnow.nl/jobs/companies/acme/x-1")).toBe(true);
    expect(isArbeitnowUrl("https://arbeitnow.co.uk/jobs/companies/acme/x-1")).toBe(true);
  });

  test("accepts arbeitnow.com over https", () => {
    expect(isArbeitnowUrl("https://www.arbeitnow.com/jobs/companies/acme/some-job-12345")).toBe(true);
    expect(isArbeitnowUrl("https://www.arbeitnow.com/api/job-board-api?page=1")).toBe(true);
    expect(isArbeitnowUrl("https://arbeitnow.com/jobs/companies/acme/x")).toBe(true);
  });

  test("rejects other hosts, look-alikes, userinfo tricks and plain http", () => {
    expect(isArbeitnowUrl("https://example.com/jobs/companies/acme/x")).toBe(false);
    expect(isArbeitnowUrl("https://arbeitnow.com.evil.com/jobs/companies/acme/x")).toBe(false);
    expect(isArbeitnowUrl("https://evil-arbeitnow.com/x")).toBe(false);
    expect(isArbeitnowUrl("https://www.arbeitnow.co.uk.evil.com/x")).toBe(false);
    expect(isArbeitnowUrl("https://www.arbeitnow.xyz/x")).toBe(false);
    expect(isArbeitnowUrl("https://www.arbeitnow.com@evil.com/x")).toBe(false);
    expect(isArbeitnowUrl("http://www.arbeitnow.com/jobs/companies/acme/x")).toBe(false);
    expect(isArbeitnowUrl("not a url")).toBe(false);
  });

  test("detail refuses a URL on another host before making any request", async () => {
    const result = await runCLI(["detail", "https://example.com/jobs/companies/acme/some-job-12345"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("BAD_ID");
  });
});
