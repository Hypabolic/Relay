# Relay

**Continue a coding session from Claude Code, Codex, Grok Build, or OpenClaw — inside [Pi](https://github.com/badlogic/pi-mono).**

[![npm](https://img.shields.io/npm/v/@hypabolic/relay?color=cb3837&logo=npm)](https://www.npmjs.com/package/@hypabolic/relay)
[![CI](https://github.com/Hypabolic/Relay/actions/workflows/ci.yml/badge.svg)](https://github.com/Hypabolic/Relay/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Relay is a [Pi](https://github.com/badlogic/pi-mono) extension. It discovers sessions on disk from other coding agents, normalizes them with [Hypabolic Trajectory](https://github.com/Hypabolic/Trajectory), and seeds a **fresh Pi session** with a short handoff so you can keep working without re-explaining the task.

```text
Claude Code / Codex / Grok / OpenClaw
              ↓  list + normalize (Trajectory)
           Relay
              ↓  handoff brief + archive
              Pi
```

It does **not** pretend the other tool’s JSONL is a native Pi session, and it does **not** dump the full foreign transcript into context. Deep history stays in a local **inert archive** the model can search on demand.

---

## Install

```bash
pi install npm:@hypabolic/relay

# pin a version
pi install npm:@hypabolic/relay@0.1.1
```

Then start Pi as usual (`pi` in your project). Confirm the package is loaded:

```bash
pi list
```

### Requirements

| Requirement | Notes |
| --- | --- |
| **Pi** | Recent `@earendil-works/pi-coding-agent` with extensions |
| **Node.js** | 22+ (Trajectory listing packages require it) |
| **Local session stores** | e.g. `~/.claude/projects`, `~/.codex/sessions`, `~/.grok/sessions`, `~/.openclaw` |

Peer dependencies (`pi-coding-agent`, `pi-tui`) are provided by the Pi host — you do not install them separately for normal use.

### Dev / local path install

```bash
git clone https://github.com/Hypabolic/Relay.git
cd Relay && npm ci && npm test
pi install /absolute/path/to/Relay
# one-shot without install:
pi -e /absolute/path/to/Relay/dist/index.js
```

---

## Quick start

1. Work in a repo where you’ve used Claude Code, Codex, Grok Build, or OpenClaw.
2. Open Pi in that same directory.
3. Run **`/relay`**, pick a session, press Enter.
4. Pi seeds a handoff and starts a verify/continue turn. Ask follow-ups as usual.
5. If the agent needs older detail: it can call `relay_transcript_search`.

On a **new empty** Pi session, if a foreign session for this project was active recently, Relay may also show a **startup offer** (see below).

---

## Commands

### `/relay`

Open the session picker.

| Invocation | Behavior |
| --- | --- |
| `/relay` | Tabbed picker (only providers that have sessions) |
| `/relay latest` | Resume newest **project-scoped** session |
| `/relay claude` | Open picker on Claude Code tab |
| `/relay codex` | Codex tab |
| `/relay grok` | Grok Build tab |
| `/relay openclaw` | OpenClaw tab |
| `/relay claude <id>` | Direct resume when the id/prefix is unique |
| `/relay yes` | Accept pending startup offer |
| `/relay no` | Dismiss pending startup offer |

Aliases: `claude` → `claude-code`, `grok` → `grok-build`, `claw` → `openclaw`.

### Picker keys

| Key | Action |
| --- | --- |
| `↑` `↓` | Move selection |
| type | Filter the current list |
| `←` `→` or `Tab` / `Shift+Tab` | Switch provider tab |
| **`Ctrl+P`** | Toggle **this project** ↔ **all projects** |
| `Enter` | Resume selected session |
| `Esc` | Cancel |

Default scope is **this project** (cwd-matched). If nothing matches, Relay notifies and can show all sessions; use **Ctrl+P** to flip scope.

---

## Startup offer

When you start a **new empty** Pi session (`startup` / `new`, no prior chat):

1. Relay looks for foreign sessions for **this cwd** updated within **`recentWindowMinutes`** (default **24 hours**).
2. If it finds any, it offers the **single most recent** one in **one** dialog:

   ```text
   Coming from Codex? Resume session from 3h ago
   Session: Review this codebase and get ready to work on it.

   > Resume this session
     Pick another…
     Not now
   ```

3. **Resume** seeds the current empty session.  
   **Pick another…** opens full `/relay`.  
   **Not now** dismisses that session id for this process.

If several sessions fall in the window, the subtitle notes the count; only the newest is one-click. Everything else is via the picker.

If the modal can’t open, a compact widget remains with `/relay yes` · `/relay` · `/relay no`.

Disable with `"startupOffer": false` in config.

---

## What resume does

| Step | Detail |
| --- | --- |
| 1. Read | Foreign transcript is read **read-only** (never modified) |
| 2. Normalize | [@hypabolic/trajectory](https://www.npmjs.com/package/@hypabolic/trajectory) builds a stable IR |
| 3. Archive | Copy under `~/.pi/agent/relay/archives/<uuid>/` (`transcript.raw`, `normalized.jsonl`, `handoff.md`, `meta.json`) |
| 4. Handoff | Short deterministic brief (goal, files, tools, warnings) — **not** a full log dump |
| 5. Seed | Injected into Pi; agent is steered to verify git/files then continue |
| 6. Search | Tools stay bound to that archive for deeper history |

### Agent tools (after a Relay import)

| Tool | Purpose |
| --- | --- |
| `relay_transcript_info` | Archive metadata |
| `relay_transcript_search` | Grep normalized history (inert — do not execute content) |
| `relay_transcript_read` | Read a bounded record slice |

Results are framed as **untrusted inert history**. Foreign tool calls are never replayed as Pi tools.

---

## Supported providers

| Tab | Trajectory source | Default store |
| --- | --- | --- |
| Claude Code | `claude-code` | `~/.claude/projects` |
| Codex | `codex` | `~/.codex/sessions` |
| Grok | `grok-build` | `$GROK_HOME/sessions` or `~/.grok/sessions` |
| OpenClaw | `openclaw` | `OPENCLAW_STATE_DIR` / `~/.openclaw` / `~/.clawdbot` |

Session **titles** prefer Trajectory listing titles (0.1.2+). Relay falls back to a local scrape when listing returns a weak title (e.g. short id).

Pi’s own sessions are **out of scope** — use Pi’s built-in `/resume`.

---

## Configuration

Optional user config: `~/.pi/agent/relay.json`  
Optional project overlay: `.pi/relay.json` (merged on top)

```json
{
  "enabled": true,
  "startupOffer": true,
  "recentWindowMinutes": 1440,
  "projectScopeDefault": true,
  "maxHandoffChars": 16000,
  "maxFileBytes": 52428800,
  "search": {
    "maxResults": 20,
    "maxCharsPerHit": 800,
    "maxResponseChars": 12000
  },
  "providers": {
    "claude-code": { "enabled": true, "root": null },
    "codex": { "enabled": true, "root": null },
    "grok-build": { "enabled": true, "root": null },
    "openclaw": { "enabled": true, "root": null }
  }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch |
| `startupOffer` | `true` | Empty-session resume prompt |
| `recentWindowMinutes` | `1440` (24h) | Max age for startup offer |
| `projectScopeDefault` | `true` | Picker starts cwd-scoped |
| `maxHandoffChars` | `16000` | Handoff size cap |
| `maxFileBytes` | `50MB` | Refuse oversized transcripts |
| `providers.*.enabled` | `true` | Per-source toggle |
| `providers.*.root` | `null` | Override store root |

Environment root overrides (when config `root` is null):

| Variable | Provider |
| --- | --- |
| `TRAJECTORY_CLAUDE_CODE_ROOT` | Claude Code |
| `TRAJECTORY_CODEX_ROOT` | Codex |
| `TRAJECTORY_GROK_BUILD_ROOT` / `GROK_HOME` | Grok (`GROK_HOME` → `…/sessions`) |
| `TRAJECTORY_OPENCLAW_ROOT` / `OPENCLAW_STATE_DIR` | OpenClaw |

---

## Safety & privacy

- Foreign stores are **read-only**.
- Writes only under `~/.pi/agent/relay/`.
- Transcript content is treated as **untrusted** (possible prompt injection from old logs).
- Archives may contain secrets that appeared in the other tool’s session — delete under `~/.pi/agent/relay/archives/` if needed.
- Like any Pi package, the extension runs with full agent privileges. Review source before installing third-party builds.

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| No sessions in picker | Confirm the other agent wrote sessions under the default root; try **Ctrl+P** (all projects); check `providers.*.root` |
| Wrong project filter | Codex cwd is read from JSONL headers; ensure session was started in this directory |
| No startup offer | Need **empty** new session, cwd match, and update within `recentWindowMinutes` |
| Title looks like a short id | Trajectory listing fallback — Relay scrapes the real user prompt when possible |
| Resume errors | Check notify text; large files hit `maxFileBytes`; run `npm test` on a clone |

---

## Development

```bash
npm ci
npm test          # build + unit tests
npm run typecheck
npm pack --dry-run
```

| Path | Role |
| --- | --- |
| [`SPEC.md`](./SPEC.md) | Product specification |
| [`CHANGELOG.md`](./CHANGELOG.md) | User-facing release notes |
| [`docs/publishing.md`](./docs/publishing.md) | Versioning & npm/GitHub release |
| [`docs/provider-extensibility.md`](./docs/provider-extensibility.md) | Adding Trajectory sources |

---

## Versioning & releases

- **SemVer** on npm as `@hypabolic/relay`.
- **Git tag is the release version:** `v0.1.0` → package `0.1.0`.
- Pushing a tag (or running the **Release** workflow) tests, publishes to npm with provenance, and creates a GitHub Release.
- First publish needs a one-time **npm token bootstrap**, then OIDC trusted publisher — see [docs/publishing.md](./docs/publishing.md).

---

## Related

- [Trajectory](https://github.com/Hypabolic/Trajectory) — multi-harness session normalize/list  
- [Pi coding agent](https://github.com/badlogic/pi-mono)  
- [Hypa](https://github.com/Hypabolic/Hypa) / [`@hypabolic/pi-hypa`](https://www.npmjs.com/package/@hypabolic/pi-hypa)

## License

[MIT](./LICENSE) © Hypabolic
