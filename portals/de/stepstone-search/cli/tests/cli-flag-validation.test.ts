import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

describe("stepstone-cli error contract", () => {
  test("no command prints help and fails", async () => {
    const result = await runCLI([]);
    expect(result.exitCode).toBe(1);
  });

  test("detail is not supported and says so with JSON on stderr", async () => {
    const result = await runCLI(["detail", "https://www.stepstone.de/stellenangebote--Slug--14255090-inline.html"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("DETAIL_NOT_SUPPORTED");
  });

  test("an invalid numeric flag fails before making a request", async () => {
    const result = await runCLI(["search", "--query", "test", "--limit", "not-a-number"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    const error = JSON.parse(result.stderr);
    expect(error.code).toBe("BAD_ARG");
  });

  test("unknown command fails with JSON on stderr", async () => {
    const result = await runCLI(["bogus"]);
    expect(result.exitCode).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.code).toBe("BAD_CMD");
  });
});
