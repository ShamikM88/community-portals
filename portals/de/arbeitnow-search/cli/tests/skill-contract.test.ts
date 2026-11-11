import { describe, expect, test } from "bun:test";
import { join } from "path";

// Mirrors the repository's tests/test_portal_skills.py: every portal SKILL.md needs a
// `Query syntax:` line under the search command.
describe("SKILL.md contract", () => {
  test("states its query syntax", async () => {
    const skill = await Bun.file(join(import.meta.dir, "../../SKILL.md")).text();
    expect(skill).toMatch(/^Query syntax:\s*\S/m);
  });
});
