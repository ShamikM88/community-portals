<!-- One portal per PR, titled as a Conventional Commit: `feat(dk): add jobindex-search`,
     `fix(global): back off on linkedin 429`. Fixing, adopting or stepping down from a
     portal? Delete the sections that don't apply. See CONTRIBUTING.md. -->

## What changed and why

## Portal

- **Board:** <!-- name and URL -->
- **Folder:** `portals/<country>/<board>-search/`
- **Owners:** <!-- your handle(s), as listed in .github/CODEOWNERS -->

## The five checks

- [ ] **The contract.** `search` (`--format json|table|plain`) and `detail` (`--format json|plain`, `table` optional), JSON errors on stderr with exit 1, backoff on 429/5xx, zero runtime dependencies, tests. Any deviation is declared below.
- [ ] **A safety pass.** No install or lifecycle scripts, no `trustedDependencies`, `bunfig.toml` or `.npmrc`, no requests beyond the declared board, nothing reading environment variables or files beyond what the skill needs.
- [ ] **Honest scoping.** A personal-use note where the board's terms call for one. Anything metered or needing an API key ships `enabled: false`.
- [ ] **robots.txt and terms respected.** Documented what the site allows and what the skill stays off. Boards that block automated access stay on the WebSearch fallback rather than getting a workaround.
- [ ] **Search only.** Portals read postings. Nothing fills in or submits applications.

## Ownership

- [ ] The folder has a line in `.github/CODEOWNERS` with my handle, and its `<board>-search` name is unique across the repo.

## Deviations from the contract

## Verification
<!-- What you ran in the portal's cli/ folder: bun install, bun run typecheck, bun test.
     Tests stay network-free. -->
