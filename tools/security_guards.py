#!/usr/bin/env python3
"""Supply-chain guards for the portals every fork user installs and runs.

Run from anywhere: python tools/security_guards.py [root]

Ported from AI Job Search's tools/security_guards.py (checks 3 and 4):
https://github.com/ai-job-search-dev/ai-job-search/blob/master/tools/security_guards.py

These guards make the dangerous changes LOUD, not impossible: a PR that
intentionally needs one of them must update this file in the same diff, so
the change is explicit and reviewable rather than buried.

Checks:
1. portals/**/package.json — no npm/bun lifecycle scripts (preinstall,
   install, postinstall, preprepare, prepare, postprepare, prepack), no
   trustedDependencies, no workspaces, and no bunfig.toml or .npmrc beside
   the manifest. Catches code execution smuggled into `bun install`, and a
   registry swap.
2. Skill frontmatter — a portals/<country>/<portal>/SKILL.md may grant in
   `allowed-tools` exactly its own CLI, as installed into a fork at
   .agents/skills/<portal>/, and nothing else. Claude Code pre-approves these
   for the turn that invokes the skill, with no prompt, regardless of
   workspace trust, so the frontmatter is a permission allowlist. Catches
   bare Bash and glob grants. The same files may carry no frontmatter `hooks`
   and no !`command` dynamic-context line: both run a command when the skill
   loads, before any prompt.

Stdlib only. Exit 0 on success, 1 with a failure list otherwise.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors: list[str] = []

FORBIDDEN_SCRIPTS = {
    "preinstall", "install", "postinstall", "preprepare", "prepare", "postprepare", "prepack",
}
INSTALL_CONFIG_FILES = ("bunfig.toml", ".npmrc")

# !`command` (which may span lines) and ```! fenced blocks run when the skill
# loads and splice their output into the prompt, with no permission check.
DYNAMIC_CONTEXT = re.compile(r"```!|!`[^`]+`")
PORTAL_SEGMENT = re.compile(r"[a-z0-9-]+")
# Characters str.splitlines() breaks on but YAML 1.2 keeps inside a line; a
# line this guard splits and YAML does not is a grant this guard never sees.
FOREIGN_LINE_BREAK = re.compile("[\x0b\x0c\x1c-\x1e\x85\u2028\u2029]")


def _key(name: str) -> str:
    """Frontmatter key spelling-insensitive: hooks, Hooks, ..."""
    return name.lower().replace("-", "").replace("_", "")

_FRONTMATTER_KEY = re.compile(r"^([A-Za-z0-9_-]+):\s*(.*)$")


def _frontmatter(text: str):
    """Parse the YAML-ish frontmatter the repo's skills use, stdlib only.

    Returns (dict, problems), or (None, []) when the file has no frontmatter.
    Each value is the raw text of its `key:` line plus every indented line
    under it (a leading `- ` dropped), so whatever scalar or list YAML builds
    from those lines, its tokens are all in the value this guard checks.
    Indented lines never start a key, so a folded description mentioning
    "Bash" cannot be mistaken for a grant. A line outside that shape is a
    problem, not a skip: a real YAML parser may read it as a grant.
    """
    text = text.lstrip("\ufeff")  # a BOM from a Windows editor is not content
    nl_lines = text.split("\n")
    close = next((i for i in range(1, len(nl_lines)) if nl_lines[i].rstrip() == "---"), len(nl_lines))
    foreign = FOREIGN_LINE_BREAK.search("\n".join(nl_lines[: close + 1]))
    if foreign:
        return {}, [f"character {foreign.group()!r} that YAML and this guard split into lines differently"]
    lines = text.splitlines()
    if not lines or lines[0].rstrip() != "---":
        return None, []
    end = next((i for i in range(1, len(lines)) if lines[i].rstrip() == "---"), None)
    if end is None:
        return None, []
    data: dict = {}
    problems: list[str] = []
    key = None
    for number, raw in enumerate(lines[1:end], start=2):
        if not raw.strip() or raw.startswith("#"):
            continue
        if raw[:1] in (" ", "\t"):
            if key is None:
                problems.append(f"line {number}: indented line outside any key: {raw!r}")
                continue
            stripped = raw.strip()
            if stripped.startswith("- "):
                stripped = stripped[2:]
            data[key] = (data[key] + ", " + stripped) if data[key] else stripped
            continue
        match = _FRONTMATTER_KEY.match(raw)
        if not match:
            problems.append(f"line {number}: unsupported frontmatter syntax: {raw!r}")
            key = None
            continue
        key, value = match.group(1), match.group(2).strip()
        if key in data:
            problems.append(f"line {number}: duplicate key {key!r}")
        data[key] = "" if value in (">", "|", ">-", "|-") else value
    return data, problems


def _tool_entries(value: str) -> list:
    """Split an `allowed-tools` value as Claude Code does: on commas and whitespace outside parens."""
    value = value.strip()
    if value.startswith("[") and value.endswith("]"):  # YAML flow list
        value = value[1:-1]
    entries, depth, current = [], 0, []
    for char in value:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(depth - 1, 0)
        if (char == "," or char.isspace()) and depth == 0:
            entries.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    entries.append("".join(current).strip())
    return [entry for entry in entries if entry]


def _own_cli_grant(rel: str) -> set:
    """The two spellings of 'this portal skill may run its own CLI'."""
    parts = rel.split("/")
    if (
        len(parts) == 4
        and parts[0] == "portals"
        and parts[3] == "SKILL.md"
        and all(PORTAL_SEGMENT.fullmatch(part) for part in parts[1:3])
    ):
        cli = f"bun run .agents/skills/{parts[2]}/cli/src/cli.ts"
        return {f"Bash({cli} *)", f"Bash({cli}:*)"}
    return set()


def check_skill_tool_grants() -> None:
    skills = [p for p in ROOT.glob("portals/**/SKILL.md") if "node_modules" not in p.parts]
    for path in sorted(skills):
        rel = path.relative_to(ROOT).as_posix()
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"{rel}: unreadable (must be UTF-8): {exc}")
            continue
        for match in DYNAMIC_CONTEXT.finditer(text):
            errors.append(
                f"{rel}: dynamic-context line {match.group(0)!r}. Claude Code runs a !`command` "
                "when the skill loads and splices its output into the prompt, with no "
                "permission check, so this is a pre-approved shell command. Move it into a step "
                "the model runs, where the user's settings decide."
            )
        data, problems = _frontmatter(text)
        if data is None:
            errors.append(f"{rel}: missing or unterminated frontmatter (expected --- ... ---)")
            continue
        for problem in problems:
            errors.append(
                f"{rel}: frontmatter {problem}. This guard reads only plain `key: value` lines "
                "and fails closed on anything else, which Claude Code might read as a grant."
            )
        if "hooks" in {_key(k) for k in data}:
            errors.append(
                f"{rel}: frontmatter `hooks`. A skill hook runs its command with no prompt "
                "whenever its event fires while the skill is active; portals ship no hooks."
            )
        permitted = _own_cli_grant(rel)
        for entry in _tool_entries(data.get("allowed-tools", "")):
            if entry in permitted:
                continue
            errors.append(
                f"{rel}: allowed-tools entry not in the reviewed allowlist: {entry!r}. "
                "Claude Code pre-approves allowed-tools for the turn that invokes the "
                "skill, with no prompt and regardless of workspace trust, so this line is "
                "a permission allowlist. Bare Bash means any command. A portal skill at "
                "portals/<country>/<portal>/SKILL.md may grant only "
                "Bash(bun run .agents/skills/<portal>/cli/src/cli.ts *)."
            )


def _reject_duplicate_keys(pairs):
    seen, duplicates = set(), set()
    for key, _ in pairs:
        (duplicates if key in seen else seen).add(key)
    duplicates = sorted(duplicates)
    if duplicates:
        raise ValueError(f"duplicate key(s) {duplicates}; bun and this guard disagree on which wins")
    return dict(pairs)


def check_package_manifests() -> None:
    manifests = [
        p for p in ROOT.glob("portals/**/package.json") if "node_modules" not in p.parts
    ]
    for manifest in sorted(manifests):
        relpath = manifest.relative_to(ROOT)
        try:
            data = json.loads(
                manifest.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys
            )
        except (OSError, ValueError) as exc:
            errors.append(f"{relpath}: unreadable or invalid JSON: {exc}")
            continue
        if not isinstance(data, dict):
            errors.append(f"{relpath}: top-level JSON value must be an object")
            continue
        scripts = data.get("scripts", {})
        if not isinstance(scripts, dict):
            errors.append(f"{relpath}: scripts must be an object")
            continue
        bad = FORBIDDEN_SCRIPTS & set(scripts)
        if bad:
            errors.append(
                f"{relpath}: lifecycle script(s) {sorted(bad)} are forbidden - they execute "
                "arbitrary code during `bun install` on every fork user's machine."
            )
        if "trustedDependencies" in data:
            errors.append(
                f"{relpath}: trustedDependencies is forbidden - it re-enables dependency "
                "lifecycle scripts that bun blocks by default."
            )
        if "workspaces" in data:
            errors.append(
                f"{relpath}: workspaces is forbidden - each workspace package brings its own "
                "lifecycle scripts, which this check never reads, into `bun install`."
            )
        for name in INSTALL_CONFIG_FILES:
            config = manifest.parent / name
            if config.exists():
                errors.append(
                    f"{config.relative_to(ROOT)}: a {name} beside a portal manifest is forbidden - "
                    "it reconfigures `bun install` itself (registry, scopes, trusted packages) for "
                    "every fork user."
                )


def main() -> int:
    global ROOT
    if len(sys.argv) > 1:
        ROOT = Path(sys.argv[1]).resolve()
    check_package_manifests()
    check_skill_tool_grants()
    if errors:
        print(f"security_guards: {len(errors)} failure(s)")
        for err in errors:
            print(f"  - {err}")
        return 1
    print("security_guards: OK (package manifests, skill allowed-tools, load-time commands)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
