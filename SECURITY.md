# Security Policy

## Reporting a vulnerability

Please report security findings privately via **[GitHub private vulnerability reporting](https://github.com/ai-job-search-dev/community-portals/security/advisories/new)** rather than a public issue. You will get a response within a few days, credit in the fix unless you prefer otherwise, and public disclosure coordinated with the patch.

Reports are handled by the maintainers (@jakob1379, @MadsLorentzen) together with the affected portal's code owners, as listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).

If the private form is unavailable, open a public issue that describes the *class* of problem without a working recipe, and note that you have details to share privately.

## Threat model, honestly stated

Every portal here is code that fork users install into `.agents/skills/` and run, and its skill frontmatter is a permission grant that Claude Code applies with no prompt. The guards answer that at the permission level: they bound what a portal can grant and what `bun install` can run. "Guard" is `tools/security_guards.py`, which CI runs on every PR.

| Surface | What is granted | Lifetime | Guard |
|---|---|---|---|
| Portal skill `allowed-tools` (`portals/<country>/<board>-search/SKILL.md`) | Exactly that portal's own `cli/src/cli.ts` and nothing else | Invoking turn | Checked by path, so a skill that grants another portal's CLI, or a glob, fails CI |
| Hooks (skill frontmatter `hooks`, !`command` lines) | None. A hook runs with no prompt the moment its event fires, which is the vector the Shai-Hulud worm used in August 2026. A !`command` line in a skill runs when it loads, the same way. | - | Any of them fails CI |
| Portal CLI manifests (`portals/**/package.json`) | No lifecycle scripts (`preinstall`, `postinstall`, ...), no `trustedDependencies`, no `workspaces` (whose packages bring their own scripts) and no `bunfig.toml` or `.npmrc` beside the manifest (either can point every dependency at another registry), so `bun install` runs no code from a source the repo did not review | - | Fails CI |

### What this does not do

- **The guards are loud, not impossible.** A PR can edit `tools/security_guards.py` or the workflow that runs it, so the guards catch accidents and casual attempts, not a determined author. They only block a merge once a ruleset on `main` makes them required checks and requires code-owner review; that ruleset and human review are the real backstop, not the guards.

## Scope notes

- This policy covers the portals under `portals/<country>/<board>-search/` and this repo's CI and guards (`.github/`, `tools/`, `tests/`). AI Job Search itself is covered by its own [security policy](https://github.com/ai-job-search-dev/ai-job-search/blob/master/SECURITY.md).
- Portal CLI skills make live requests only when you run them; CI never does.
- Community fork skills listed in the [forks index](https://github.com/ai-job-search-dev/ai-job-search/discussions/78) are **not** covered by this policy - review the code you copy, as the index itself says.
