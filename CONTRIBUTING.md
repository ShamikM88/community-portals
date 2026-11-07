# Contributing

This repo exists so the community can drive what it needs. [AI Job Search](https://github.com/ai-job-search-dev/ai-job-search) stays market-neutral and declines country-specific portals (see its [CONTRIBUTING.md](https://github.com/ai-job-search-dev/ai-job-search/blob/master/CONTRIBUTING.md)). They land here instead, owned by the people who use them.

## The one rule everything follows from

**The people who use a portal own it.** Owners review changes to their portal and keep it working against its board. The maintainers (@jakob1379, @MadsLorentzen) review what enters the repo and own the repo's own files, but they do not maintain your portal for you.

## Layout

```
portals/<country>/<board>-search/
```

- `<country>` is the board's home market as a lowercase [ISO 3166-1 alpha-2](https://www.iso.org/iso-3166-country-codes.html) code (`dk`, `se`, `de`). Boards with no home market (LinkedIn, aggregators) go in `portals/global/`.
- `<board>-search` is the folder `/add-portal` generates. It must be unique across the whole repo, not just its country: installing copies it flat into `.agents/skills/`, where two `jobs-search` folders would collide.
- One board per folder. A board that serves several countries lives under its home market.

## Add a portal

1. Generate it with `/add-portal` in your AI Job Search checkout. That command is the portal contract.
2. Copy the generated `.agents/skills/<board>-search/` folder to `portals/<country>/<board>-search/` here.
3. Add yourself as its owner in `.github/CODEOWNERS` (see below).
4. Open a PR with a [Conventional Commits](https://www.conventionalcommits.org/) title, e.g. `feat(dk): add jobindex-search`. One portal per PR.

Every PR is read before it merges. The bar is not code quality. It is these five things:

1. **The contract.** `search` (`--format json|table|plain`) and `detail` (`--format json|plain`, `table` optional) commands, JSON errors on stderr with exit 1, backoff on 429/5xx, zero runtime dependencies, and tests. Declare any deviation in the PR ("this board has no pagination, so `--page` isn't supported").
2. **A safety pass.** No install or lifecycle scripts, no `trustedDependencies`, `bunfig.toml` or `.npmrc`, no requests beyond the board you declare, nothing reading environment variables or files beyond what the skill needs.
3. **Honest scoping.** A personal-use note where the board's terms call for one. Anything metered or needing an API key ships `enabled: false`.
4. **robots.txt and terms respected.** Document what the site allows and what the skill stays off. Boards that block automated access stay on the WebSearch fallback rather than getting a workaround.
5. **Search only.** Portals read postings. Nothing here fills in or submits applications.

Run what CI runs, in the portal's `cli/` folder: `bun install`, `bun run typecheck`, `bun test`. Tests stay network-free; CI makes no live portal requests, on purpose.

**License:** by contributing, you license your contribution under this repo's [MIT license](LICENSE), as upstream. Keep the license and attribution of anything you bring from a fork.

**Credit norm**, as upstream: a change that incorporates your code gets a `Co-authored-by` trailer; a change written from your report gets a named mention.

## How ownership works

Ownership is GitHub's native [code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) feature. `.github/CODEOWNERS` maps each portal folder to its owners:

```
* @jakob1379 @MadsLorentzen
/portals/dk/jobindex-search/ @alice @bob
/portals/global/freehire-search/ @jakob1379 @MadsLorentzen # unmaintained since 2026-11
```

- **The first line is the fallback.** The maintainers own everything not listed further down, including `.github/CODEOWNERS` itself. The last matching line wins, so a portal's own line overrides it.
- **A portal can have several owners.** List them on one line. GitHub requests a review from all of them, and an approval from any one of them is enough. Several owners means a portal survives one of them going quiet, and new co-owners are welcome: open a PR adding your handle to the line.
- **Owners get the Write role on this repo.** GitHub only requests reviews from owners who can write to the repo, so when your first portal merges, a maintainer invites you as an outside collaborator with Write on this repo only. You don't join the organization, and you don't get access to any other repo. Write access exists so you can review: changes to `main` still go through a reviewed PR, and your approval only counts for the portals you own.
- **Changes to `.github/CODEOWNERS` are approved by a maintainer.** GitHub reads the owners from `main`, not from the PR, so nobody can make themselves an owner and approve their own change in one step.

### Step down

Open a PR that removes your handle from your portal's line. Opening it is your consent, and a maintainer approves and merges it (GitHub does not let anyone approve their own PR). If you were the last owner, replace the line's owners with the maintainers and the `# unmaintained since YYYY-MM` comment.

### Unmaintained portals

A portal without owners stays in the repo, marked `# unmaintained since YYYY-MM` in `.github/CODEOWNERS` and owned by the maintainers so nobody else can approve changes to it. It still works until its board changes. The maintainers keep it from rotting into something unsafe, nothing more.

**Adopt one** with a PR that replaces the maintainers on its line with your handle and drops the comment. Fixing it in the same PR is a good way to show you mean it.

### Inactive owners

If an owner has not responded to review requests for 6 months, or their portal stays broken against its board, a maintainer opens a PR removing them and mentions them on it. Without an objection within 14 days, it merges. Their portal becomes unmaintained if they were its last owner. Coming back is a PR adding your handle again.

## Questions

Ask in the AI Job Search [Discussions](https://github.com/ai-job-search-dev/ai-job-search/discussions). Full market and language forks are listed in [Community forks & adaptations](https://github.com/ai-job-search-dev/ai-job-search/discussions/78).
