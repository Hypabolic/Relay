# Changelog

## 0.1.0 — 2026-08-11

First public release of **Relay**, a Pi extension for continuing coding-agent sessions started in other harnesses.

### Features

- `/relay` tabbed session picker (Claude Code, Codex, Grok Build, OpenClaw)
- Project-scoped listing by default; **Ctrl+P** toggles all projects
- Trajectory-backed normalize + inert archive under `~/.pi/agent/relay/archives/`
- Deterministic handoff brief (not full transcript dump) + auto verify/continue turn
- Transcript tools: `relay_transcript_info`, `relay_transcript_search`, `relay_transcript_read`
- Startup offer for recent cwd-matched sessions (24h window): single select modal with session title
- Depends on `@hypabolic/trajectory` / `@hypabolic/trajectory-node` ^0.1.2 (listing titles + Grok Build)

### Install

```bash
pi install npm:@hypabolic/relay
# or
pi install npm:@hypabolic/relay@0.1.0
```
