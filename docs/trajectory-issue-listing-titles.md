# Draft GitHub issue: Trajectory listing titles for Codex (and peers)

**Repo:** https://github.com/Hypabolic/Trajectory  
**Type:** enhancement  
**Area:** listing / `@hypabolic/trajectory-node` / Codex adapter

---

## Title

listing: populate useful `title` for Codex (and other) sessions — skip harness injection

## Summary

Relay (and any session picker) needs a **human-useful title** per listed session. Today `@hypabolic/trajectory-node` listing items expose `id`, `path`, `updatedAt`, `sizeBytes` but **no `title`**, even though the listing contract documents optional `title`.

Consumers that scrape the first `role: user` text from Codex rollouts get **injected context**, not the user’s real prompt:

```text
# AGENTS.md instructions
<INSTRUCTIONS>
@/home/x/.codex/HYPA.md
...
<environment_context>
  <cwd>...</cwd>
```

Codex’s own `/resume` UI shows the real first user turn, e.g.:

```text
Review this codebase and get ready to work on it.
```

which appears later in the JSONL as a second `response_item` / `role: user` message.

## Contract

[`contracts/spec/listing.md`](https://github.com/Hypabolic/Trajectory/blob/main/contracts/spec/listing.md) already allows optional `title`. OpenClaw notes prefer `summary.json` (`generated_title` / `session_summary`). Codex has no equivalent field on the listing path today.

## Proposal

1. **Extend Node (and other) listing items** to fill `title` when cheaply available.
2. **Codex title algorithm** (suggested):
   - Scan early rollout records (bounded lines/bytes).
   - Prefer first `response_item` with `payload.role === "user"` whose text is **not** harness noise.
   - Noise heuristics: `# AGENTS.md`, `<INSTRUCTIONS>`, `<environment_context>`, `<skills_instructions>`, dense XML tag blocks, developer/system roles.
   - Fallback: `session_meta` id short form or filename stem.
3. **Claude Code:** prefer `summary` / `custom-title` / `ai-title` records when present; else first non-meta user text.
4. **Conformance:** fixture where first user row is injection and second is the real prompt; expected listing `title` is the real prompt.
5. Keep titles **privacy-safe** in sample CLIs (already summary-oriented); listing title is local metadata for pickers.

## Why

Without this, every downstream picker (Relay, CLIs, eval browsers) reimplements fragile per-source title scraping. Trajectory is the right layer: it already owns source-specific decode knowledge.

## Workarounds today

Relay derives titles client-side with noise filters (`src/providers/title.ts`). That should stay as a fallback until listing titles ship.

## Acceptance

- `listCodexTrajectories` returns `title` for fixtures/real rollouts matching Codex `/resume` quality for the common case.
- TS/`.NET`/Rust listing item types document `title?: string` consistently with the contract.
- Conformance case covers injection-then-real-user ordering.

---

*Prepared for filing from Hypabolic/Relay.*
