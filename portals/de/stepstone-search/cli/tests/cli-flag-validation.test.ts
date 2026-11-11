import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

describe("stepstone-cli error contract", () => {
  test("no command fails with a JSON error on stderr and nothing on stdout", async () => {
    const result = await runCLI([]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("NO_COMMAND");
  });

  test("a command named like an inherited property is an unknown command, not a crash", async () => {
    const result = await runCLI(["toString"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("BAD_CMD");
  });

  test("--help prints the help text to stdout and exits 0", async () => {
    const result = await runCLI(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE");
    expect(result.stderr).toBe("");
  });

  test("an unsupported --format fails before making a request", async () => {
    const result = await runCLI(["search", "--format", "tabl"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG");
  });

  test("a value-taking flag with no value fails instead of dropping the filter", async () => {
    const result = await runCLI(["search", "--query"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG");
  });

  test("a query with nothing searchable fails before making a request", async () => {
    const result = await runCLI(["search", "--query", "???"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG");
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
