import { describe, expect, test } from "bun:test";
import { ArgError, parseArgs } from "../src/args";

function fails(argv: string[]): string {
  try {
    parseArgs(argv);
  } catch (e) {
    expect(e).toBeInstanceOf(ArgError);
    return (e as ArgError).message;
  }
  throw new Error(`expected parseArgs(${JSON.stringify(argv)}) to throw`);
}

describe("parseArgs", () => {
  test("parses flags, aliases and --flag=value", () => {
    const a = parseArgs(["search", "-q", "Product Owner", "--location=Berlin", "-n", "5", "--format", "table"]);
    expect(a.command).toBe("search");
    expect(a.flags).toEqual({ query: "Product Owner", location: "Berlin", limit: 5 });
    expect(a.format).toBe("table");
  });

  test("format defaults to json", () => {
    expect(parseArgs(["search"]).format).toBe("json");
  });

  test("--help anywhere returns help, with or without a command", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["search", "--help"]).help).toBe(true);
  });

  test("no arguments gives no command (the caller reports it)", () => {
    expect(parseArgs([]).command).toBeUndefined();
  });

  test("an unknown command is returned for the caller to reject", () => {
    expect(parseArgs(["bogus"]).command).toBe("bogus");
  });

  test("malformed numbers are rejected, not truncated", () => {
    expect(fails(["search", "--limit", "3oops"])).toContain("--limit must be a whole number");
    expect(fails(["search", "--limit", "1.5"])).toContain("--limit");
  });

  test("a zero limit is valid (no results)", () => {
    expect(parseArgs(["search", "--limit", "0"]).flags.limit).toBe(0);
  });

  test("names like toString or constructor are never treated as commands or flags", () => {
    expect(parseArgs(["toString"]).command).toBe("toString");
    expect(parseArgs(["toString"]).positional).toEqual([]);
    expect(fails(["search", "--constructor", "x"])).toContain("Unknown flag");
    expect(fails(["search", "--toString", "x"])).toContain("Unknown flag");
  });

  test("absurdly long digit strings are rejected, not turned into Infinity", () => {
    expect(fails(["search", "--limit", "9".repeat(400)])).toContain("--limit must be a whole number from 0 to 10000");
    expect(fails(["search", "--limit", "10001"])).toContain("--limit");
  });

  test("an empty value is an error, not a silently dropped filter", () => {
    expect(fails(["search", "--query="])).toContain("--query needs a non-empty value");
    expect(fails(["search", "--location="])).toContain("--location needs a non-empty value");
  });

  test("a value-taking flag without a value is an error, not a dropped filter", () => {
    expect(fails(["search", "--query"])).toContain("--query needs a value");
    expect(fails(["search", "-q", "--format", "json"])).toContain("--query needs a value");
  });

  test("flags this portal does not support are unknown (robots.txt rules out --page and --jobage)", () => {
    expect(fails(["search", "--page", "2"])).toContain("Unknown flag");
    expect(fails(["search", "--jobage", "7"])).toContain("Unknown flag");
    expect(fails(["search", "stray"])).toContain("Unexpected argument");
  });

  test("an unsupported format is rejected before any request", () => {
    expect(fails(["search", "--format", "tabl"])).toContain("--format must be one of");
  });

  test("flags before the command are rejected", () => {
    expect(fails(["--query", "x", "search"])).toContain("Put the command first");
  });
});
