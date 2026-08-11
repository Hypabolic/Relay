# Changelog

All notable changes to **@hypabolic/relay** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

The **git tag is the release version** (`vX.Y.Z` → npm `X.Y.Z`). See [docs/publishing.md](./docs/publishing.md).

---

## [Unreleased]

### Planned

- Provider registry spine (see `docs/provider-extensibility.md`)

---

## [0.1.1] — 2026-08-11

### Fixed

- First **installable** public release on npm (`0.1.0` hit a registry ghost state: name reserved, packument 404).
- Local bootstrap: no `publishConfig.provenance` (provenance remains CI-only via OIDC).

### Added

Same feature set as the 0.1.0 cut:

- `/relay` picker (Claude Code, Codex, Grok Build, OpenClaw)
- Startup offer with labeled session title
- Trajectory normalize + inert archive + search tools
- Config via `~/.pi/agent/relay.json`

### Install

```bash
pi install npm:@hypabolic/relay
# or
pi install npm:@hypabolic/relay@0.1.1
```

---

## [0.1.0] — 2026-08-11

Initial tag/attempt. **Do not use** — install **0.1.1** instead.

---

[Unreleased]: https://github.com/Hypabolic/Relay/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Hypabolic/Relay/releases/tag/v0.1.1
[0.1.0]: https://github.com/Hypabolic/Relay/releases/tag/v0.1.0
