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

## [0.1.0] — 2026-08-11

First public release.

### Added

- **`/relay`** tabbed session picker for Claude Code, Codex, Grok Build, and OpenClaw
- Project-scoped listing by default; **Ctrl+P** toggles all projects
- Direct args: `latest`, `<provider>`, `<provider> <id>`, `yes` / `no`
- Trajectory-backed normalize (`@hypabolic/trajectory` ^0.1.2) and inert archives under `~/.pi/agent/relay/archives/`
- Deterministic handoff brief + verify/continue steer (no full transcript dump)
- Agent tools: `relay_transcript_info`, `relay_transcript_search`, `relay_transcript_read`
- Startup offer for recent cwd-matched sessions (default 24h window)
  - Single select modal: “Coming from …?” + labeled **Session:** title
  - Most-recent one-click; “Pick another…” opens full picker when multiple qualify
- Config via `~/.pi/agent/relay.json` and project `.pi/relay.json`
- Listing title preference from Trajectory; local scrape fallback for weak titles

### Security

- Foreign session stores are read-only
- Transcript content treated as untrusted inert history
- Size caps on handoff, archive input, and search responses

---

[Unreleased]: https://github.com/Hypabolic/Relay/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Hypabolic/Relay/releases/tag/v0.1.0
