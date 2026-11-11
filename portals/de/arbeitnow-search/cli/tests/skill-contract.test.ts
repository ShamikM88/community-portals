import { describe, expect, test } from "bun:test";
import { join } from "path";

// Mirrors the repository's tests/test_portal_skills.py: every portal SKILL.md needs a
// `Query syntax:` line with a value on the same line, under the search command.
describe("SKILL.md contract", () => {
  test("states its query syntax under the search command", async () => {
    const skill = await Bun.file(join(import.meta.dir, "../../SKILL.md")).text();
    const start = skill.search(/^### Search job listings/m);
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = skill.slice(start + 1);
    const next = rest.search(/^### /m);
    const section = next < 0 ? rest : rest.slice(0, next);
    expect(section).toMatch(/^Query syntax:[ \t]*\S/m);
  });
});
