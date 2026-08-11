# Contributing to Relay

Thanks for helping improve Relay — a [Pi](https://pi.dev) extension that continues coding sessions from Claude Code, Codex, Grok Build, and OpenClaw via [Trajectory](https://github.com/Hypabolic/Trajectory).

## Code of conduct (short)

- Be respectful and concise.
- Never paste production transcripts, API keys, tokens, or personal data into issues/PRs.
- Prefer sanitized fixtures and redacted paths.

## Ways to contribute

| Kind | How |
| --- | --- |
| Bug report | [Bug report](https://github.com/Hypabolic/Relay/issues/new?template=bug_report.yml) |
| Feature idea | [Feature request](https://github.com/Hypabolic/Relay/issues/new?template=feature_request.yml) |
| Question | [Question](https://github.com/Hypabolic/Relay/issues/new?template=question.yml) |
| Code / docs PR | Fork → branch → PR using the PR template |

Search [existing issues](https://github.com/Hypabolic/Relay/issues) before opening a new one.

## Development setup

**Requirements:** Node.js 22+, npm, git. Pi is optional for unit tests; useful for manual TUI checks.

```bash
git clone https://github.com/Hypabolic/Relay.git
cd Relay
npm ci
npm test          # build + unit tests
npm run typecheck
```

### Run against a live Pi

```bash
npm run build
pi -e ./dist/index.js
# or install the path package:
pi install "$PWD"
```

Exercise `/relay`, startup offer (empty session + recent foreign session in cwd), and transcript search tools after a resume.

## Project layout

| Path | Role |
| --- | --- |
| `src/` | Extension entry, providers, resume/archive, search tools, TUI |
| `test/` | Node test-runner unit tests |
| `SPEC.md` | Product behaviour (source of truth for UX/features) |
| `CHANGELOG.md` | User-facing release notes |
| `docs/publishing.md` | Tags, npm bootstrap, OIDC |
| `docs/provider-extensibility.md` | How to add Trajectory sources without scattershot `if`s |

### Architecture notes

- **Discovery/normalize** = Trajectory (`@hypabolic/trajectory` + `-node`). Do not hand-roll Claude/Codex parsers.
- **Resume** = handoff brief + inert archive + search tools — not full transcript dump, not foreign tool replay.
- Prefer changes that move toward the [provider registry spine](./docs/provider-extensibility.md): no new `if (provider === "…")` outside builtins.

## Coding standards

- TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- ESM only (`"type": "module"`); import paths use `.js` extensions in source.
- Keep peer deps on Pi packages as `"*"`; do not bundle `@earendil-works/pi-*`.
- Match existing naming and file placement; small focused commits preferred.

## Tests

```bash
npm test
```

Add or extend unit tests for:

- cwd matching / title heuristics  
- config merge  
- handoff caps / safety labels  
- search/read tools  

Manual TUI checks for picker keys, startup offer copy, and resume seed when UI-related.

## Pull requests

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
3. Ensure `npm test` and `npm run typecheck` pass.
4. Fill out the PR template; link issues with `Fixes #N` when applicable.
5. Keep PRs reviewable — split large refactors from behaviour changes when you can.

Maintainers may ask for SPEC.md updates when behaviour changes.

## Releases (maintainers)

See [docs/publishing.md](./docs/publishing.md).

- **SemVer**; git tag `vX.Y.Z` is the npm version.
- **One publish per version** (laptop bootstrap *or* CI — not both).
- Do not force-push release tags after npm has the version.

## Security

- Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/Hypabolic/Relay/security/advisories/new) when possible.
- Do not open public issues that include secrets or private session content.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE) covering this repository.
