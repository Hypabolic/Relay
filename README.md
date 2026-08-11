# Relay

**Continue coding sessions from Claude Code, Codex, Grok Build, or OpenClaw inside [Pi](https://github.com/badlogic/pi-mono).**

Relay lists foreign agent sessions with [Hypabolic Trajectory](https://github.com/Hypabolic/Trajectory) (≥0.1.2 listing titles), builds a short **handoff brief** (not a full transcript dump), starts you in a fresh Pi context, and exposes tools so the agent can **search the original transcript** when it needs more history.

## Install

```bash
pi install npm:@hypabolic/relay
# pin a version:
pi install npm:@hypabolic/relay@0.1.0

# from a local clone (dev)
pi install /absolute/path/to/Relay
```

Requires Node 22+ and Pi with extension support. Trajectory packages install as dependencies of this package.

## Usage

```
/relay                         # tabbed picker (providers with sessions)
/relay latest                  # newest session for this project
/relay claude                  # Claude Code tab
/relay claude <id-prefix>      # direct resume when unique
/relay codex
/relay grok
/relay openclaw
/relay yes | /relay no         # accept / dismiss startup offer
```

### Picker keys

| Key | Action |
| --- | --- |
| ↑↓ | Move |
| type | Filter the list |
| ←/→ or Tab | Provider tab |
| **Ctrl+P** | Toggle this project ↔ all projects |
| Enter | Resume |
| Esc | Cancel |

### Startup offer

On a **new empty** Pi session, if a foreign session for this project was active in the last **24 hours**, Relay shows **one** dialog: session **title**, provider · age, then Resume / Pick another… / Not now. Only the **most recent** session is one-click offered; “Pick another…” opens `/relay`. If the dialog can’t open, a small widget remains (`/relay yes`).

### What happens on resume

1. Transcript bytes are read **read-only** from the other tool’s store  
2. Trajectory **normalizes** the session  
3. An inert **archive** is written under `~/.pi/agent/relay/archives/<id>/`  
4. A deterministic **handoff.md** is seeded into the Pi session  
5. The agent is steered to **verify the repo** and continue  
6. Tools `relay_transcript_search` / `relay_transcript_read` / `relay_transcript_info` stay bound to that archive  

Foreign tool calls are **not** replayed as Pi tools. Transcript content is treated as untrusted inert history.

## Configuration

Optional `~/.pi/agent/relay.json` (merged with `.pi/relay.json` in a project):

```json
{
  "enabled": true,
  "startupOffer": true,
  "recentWindowMinutes": 10,
  "projectScopeDefault": true,
  "maxHandoffChars": 16000,
  "maxFileBytes": 52428800,
  "providers": {
    "claude-code": { "enabled": true, "root": null },
    "codex": { "enabled": true, "root": null },
    "grok-build": { "enabled": true, "root": null },
    "openclaw": { "enabled": true, "root": null }
  }
}
```

Root overrides also honor `TRAJECTORY_CLAUDE_CODE_ROOT`, `TRAJECTORY_CODEX_ROOT`, `TRAJECTORY_OPENCLAW_ROOT` when set.

## Development

```bash
npm install
npm run build
npm test
pi -e ./dist/index.js
# or after pi install of this path:
pi
```

Design notes: [SPEC.md](./SPEC.md).  
Adding Trajectory sources later: [docs/provider-extensibility.md](./docs/provider-extensibility.md).

## License

MIT
