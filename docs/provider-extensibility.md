# Provider extensibility plan

**Status:** design / ready to implement  
**Goal:** When Trajectory ships a new source (e.g. Grok, Cursor, Hermes listing), Relay should pick it up with **one registry entry + dependency bump**, not a scatter of edits across list/match/config/picker/types.

This document is normative for further Relay development. Prefer changes that move us toward this shape even when landing unrelated features.

---

## 1. Problem today

Resume/normalize/search is already source-agnostic:

```ts
normalizeToIR({ source: session.provider, transcriptBytes })
```

Friction is **discovery glue**, duplicated in several places:

| Location | Hardcoding |
| --- | --- |
| `types.ts` `RelayProviderId` | Closed extract of three sources |
| `PROVIDER_ALIASES` | Manual map |
| `config.ts` defaults | Explicit `providers` keys |
| `providers/registry.ts` | Static `PROVIDERS` array |
| `providers/list.ts` | `if` chain to named listers |
| `providers/match.ts` | Per-id cwd heuristics |
| `ui/picker.ts` | Tab order array literal `["claude-code","codex","openclaw"]` |

Adding a source touches most of these. That is small but **error-prone and not “trivial.”**

---

## 2. Target outcome

### 2.1 Definition of “trivial”

For a Trajectory source that already has:

1. `normalizeToIR` / `normalizeTo*` for that `source` id  
2. A Node listing function (or generic `listTrajectories(source, options)`)  
3. A known default store root  

Relay work is:

1. Bump `@hypabolic/trajectory` / `@hypabolic/trajectory-node`  
2. Add **one** `ProviderPlugin` object (or enable a built-in that was gated)  
3. Optionally add a **cwd match strategy** if the default strategies fail  
4. Tests: registry resolves + list smoke + match fixture  

No changes to handoff, archive, apply, search tools, startup offer, or picker implementation.

### 2.2 Non-goals

- Auto-enable every `ImplementedSources` entry without review (Pi itself must stay out; experimental sources may be off by default)  
- Reimplement parsers in Relay  
- Dynamic runtime plugin loading from user JS (v1 of this plan is **in-repo registry**, not a third-party plugin ABI)

---

## 3. Core abstraction: `ProviderPlugin`

Single module owns all per-source behavior. Everything else asks the registry.

```ts
// src/providers/types.ts (conceptual)

import type { TrajectorySource } from "@hypabolic/trajectory";

/** Sources Relay may resume. Subset of TrajectorySource; never "pi". */
export type RelaySourceId = Exclude<TrajectorySource, "pi">;

export interface ListedSession {
  id: string;
  path: string;
  updatedAt: string; // ISO
  sizeBytes: number;
  title?: string;
}

export interface ListContext {
  root: string;
  limit: number;
  cursor?: string;
  signal?: AbortSignal;
}

export interface MatchContext {
  cwd: string;
  /** Optional cheap probes already performed by listing layer */
  probes?: {
    headerCwd?: string | null;
  };
}

export type CwdMatchStrategy =
  | { kind: "always" } // only for explicit "all projects" or non-scoped tools
  | { kind: "path-includes-encoded-cwd"; encodings?: Array<"claude-dash" | "url" | "slug"> }
  | { kind: "path-project-segment"; parentDirName: string } // e.g. projects/<key>/
  | { kind: "header-cwd" } // use probes.headerCwd
  | { kind: "path-mentions-cwd" } // weak fallback
  | { kind: "custom"; match: (filePath: string, ctx: MatchContext) => boolean };

export interface ProviderPlugin {
  /** Must equal Trajectory source id string */
  readonly id: RelaySourceId;

  /** Picker tab label */
  readonly label: string;

  /** /relay args: "claude", "grok", … */
  readonly aliases: readonly string[];

  /** Default local store root (no listing root baked into Trajectory-node today) */
  defaultRoot(): string;

  /** Env vars checked before defaultRoot (first wins) */
  readonly envRootKeys?: readonly string[];

  /**
   * List sessions under root.
   * Prefer calling @hypabolic/trajectory-node; keep Relay free of JSONL layout knowledge.
   */
  list(ctx: ListContext): Promise<{
    items: readonly ListedSession[];
    nextCursor?: string | null;
  }>;

  /**
   * Ordered strategies; first decisive true wins, all false → no match.
   * Empty → treat as no cwd filter (only show in "all" mode, or never in project mode).
   */
  readonly cwdMatch: readonly CwdMatchStrategy[];

  /**
   * Optional: populate probes for match (e.g. Codex header peek).
   * Called only when projectScope && strategies need it.
   */
  probe?(path: string): Promise<MatchContext["probes"]>;

  /** Optional display title enrichment beyond path basename */
  enrichTitle?(item: ListedSession): Promise<string | undefined>;

  /**
   * When false, provider is compiled in but off until config enables it
   * (e.g. hermes while listing is empty).
   */
  readonly enabledByDefault?: boolean;

  /** Tab sort weight (lower = earlier). Default 100. */
  readonly order?: number;
}
```

### 3.1 Registry API

```ts
// src/providers/registry.ts

export function registerProvider(plugin: ProviderPlugin): void;
export function getProvider(id: string): ProviderPlugin | undefined;
export function allProviders(): readonly ProviderPlugin[];
export function resolveAlias(token: string): ProviderPlugin | undefined;
export function enabledProviders(config: RelayConfig): ProviderPlugin[];
export function resolveRoot(plugin: ProviderPlugin, config: RelayConfig): string;
```

Built-in plugins register at module load:

```ts
// src/providers/builtins/index.ts
import { registerProvider } from "../registry.js";
import { claudeCode } from "./claude-code.js";
import { codex } from "./codex.js";
import { openclaw } from "./openclaw.js";

registerProvider(claudeCode);
registerProvider(codex);
registerProvider(openclaw);
// future: registerProvider(grok); registerProvider(hermes);
```

Each builtin file is the **only** place that imports a source-specific Trajectory lister.

---

## 4. Refactors by layer

### 4.1 Types & config — open maps

**Before:** `Record<RelayProviderId, ProviderConfig>` with fixed keys.  
**After:**

```ts
export type RelaySourceId = string; // validated against registry at runtime

export interface RelayConfig {
  // …
  /**
   * Per-source overlays. Unknown keys allowed (forward-compatible when
   * user enables a source Relay learned after the config was written).
   */
  providers: Record<string, ProviderConfig>;
  /**
   * Optional allowlist. undefined = all registered plugins (respecting
   * enabledByDefault + per-provider.enabled).
   */
  only?: string[];
  /** Always exclude (default includes "pi" conceptually by never registering it) */
  exclude?: string[];
}
```

Defaults: generate from `allProviders()`:

```ts
function defaultProviderConfig(): Record<string, ProviderConfig> {
  return Object.fromEntries(
    allProviders().map((p) => [
      p.id,
      { enabled: p.enabledByDefault !== false, root: null },
    ]),
  );
}
```

Merge: deep-merge known keys; **preserve unknown provider keys** from user JSON.

### 4.2 List layer — no source switches

```ts
// list.ts
for (const plugin of enabledProviders(config)) {
  const root = resolveRoot(plugin, config);
  const page = await plugin.list({ root, limit });
  for (const item of page.items) {
    const probes = projectScope && plugin.probe
      ? await plugin.probe(item.path)
      : undefined;
    const cwdMatch = matchCwd(plugin, item.path, { cwd, probes });
    if (projectScope && !cwdMatch) continue;
    refs.push(toRef(plugin, item, cwdMatch));
  }
}
```

`normalizeToIR({ source: plugin.id as TrajectorySource, … })` — cast once at the Trajectory boundary after registry validation.

### 4.3 Match layer — strategies, not per-id functions

Implement `matchCwd(plugin, path, ctx)` as a pure interpreter of `CwdMatchStrategy[]`.

Move Claude encoding helpers to `match/encodings.ts` reusable by any plugin that opts into `"claude-dash"`.

Codex header peek becomes `plugin.probe` + `{ kind: "header-cwd" }`, not `if (provider === "codex")` in list.ts.

### 4.4 Picker — driven by data

```ts
const providerOrder = [...byProvider.keys()]
  .map((id) => getProvider(id)!)
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label))
  .map((p) => p.id);
```

No literal source id arrays in UI code.

### 4.5 Command args

```ts
const plugin = resolveAlias(token) ?? getProvider(token);
```

Aliases live only on the plugin.

### 4.6 Handoff / apply / search

Unchanged. They already take `session.provider: string` + path.  
Add a runtime assert: `getProvider(session.provider)` exists before normalize.

---

## 5. Trajectory alignment (upstream wishlist)

Relay is easier when Trajectory exposes a **uniform** listing surface. Track as soft dependencies (Relay can shim until they exist):

| Wishlist | Why |
| --- | --- |
| `listTrajectories({ source, root, limit, cursor })` on `@hypabolic/trajectory-node` | One call site; plugins become thin wrappers |
| Stable `ImplementedSources` + capability flags (`listing: boolean`) | Auto-discover candidates; skip hermes-until-ready without hardcode |
| Documented default roots per source in one JSON/manifest | `defaultRoot()` can read Trajectory instead of duplicating paths |
| Optional `cwd` / `projectKey` on listing items | Deletes most of Relay match/probe |
| New sources keep the same IR record shape | Handoff stays zero-touch |

Until then, each plugin’s `list()` may call a source-specific export; that is fine and still isolated.

---

## 6. Adding a new source (runbook)

Checklist for e.g. Grok when Trajectory lands it:

1. **Confirm Trajectory**  
   - [ ] `source: "grok"` (or final id) normalizes fixtures  
   - [ ] Node list API returns items with `id`, `path`, `updatedAt`, `sizeBytes`  
   - [ ] Default root known (`~/.grok/sessions` or whatever ships)

2. **Bump deps** in Relay `package.json`

3. **Add** `src/providers/builtins/grok.ts`:

   ```ts
   export const grok: ProviderPlugin = {
     id: "grok",
     label: "Grok",
     aliases: ["grok", "grok-build"],
     order: 40,
     defaultRoot: () => join(homedir(), ".grok", "sessions"),
     envRootKeys: ["TRAJECTORY_GROK_ROOT", "GROK_HOME"],
     async list({ root, limit, cursor }) {
       return listGrokTrajectories({ root, limit, cursor });
     },
     cwdMatch: [
       { kind: "path-includes-encoded-cwd", encodings: ["url", "slug"] },
       // adjust after inspecting real Grok paths
     ],
   };
   ```

4. **Register** in `builtins/index.ts`

5. **Tests**  
   - [ ] alias resolution  
   - [ ] match fixtures from real path samples (no home-dir CI)  
   - [ ] optional: normalize fixture → handoff contains safety block  

6. **Docs** — one line in README provider table  

7. **Ship** — no config schema version bump if `providers` map is open

Estimated effort after this plan: **&lt; 1 hour** for a well-behaved source; longer only if cwd layout is novel.

---

## 7. Implementation phases (when we choose to build it)

Do not block product features on this, but **prefer** landing slices in order:

### Phase A — Registry spine (no behavior change)

1. Introduce `ProviderPlugin` + registry + builtins extracted from current three providers  
2. `list.ts` / `match.ts` / `config.ts` / `picker.ts` / `command.ts` consume registry only  
3. Keep exported behavior identical; golden/unit tests green  

**Exit:** `git grep -E 'claude-code|codex|openclaw' src` only hits `builtins/*` and maybe tests.

### Phase B — Strategy matcher

1. Replace `matchesCwd` switch with strategy interpreter  
2. Codex probe moved onto plugin  
3. Fixture tests per strategy  

### Phase C — Open config

1. `providers: Record<string, ProviderConfig>`  
2. Defaults from registry  
3. Forward-compatible merge  

### Phase D — Trajectory generic list (optional)

1. If upstream adds `listTrajectories({ source })`, collapse builtin `list` methods to one helper  
2. Capability gate: skip sources with `listing: false`  

### Phase E — Gated “catalog” mode (optional)

1. Config `discoverTrajectorySources: true` registers any ImplementedSources minus exclude, using Trajectory manifest for roots  
2. Still require match strategy defaults (e.g. `path-mentions-cwd`) so we never show empty-hope tabs without list support  

---

## 8. Guardrails for ongoing development

When touching Relay, follow these so we do not regress:

1. **No new `if (provider === "…")` outside `builtins/`.**  
   If you need one, you are missing a plugin field or strategy.

2. **No new picker/command literal source lists.**  
   Always `allProviders()` / `enabledProviders()`.

3. **Normalize only through Trajectory** with `plugin.id` as source.  
   Never branch on source inside `resume/`.

4. **Cwd logic is data.**  
   Prefer a new `CwdMatchStrategy` variant over a one-off function in list.ts.

5. **Foreign ≠ all Trajectory sources.**  
   Never register `pi`. Prefer `Exclude<TrajectorySource, "pi">`.

6. **Empty listers stay off by default.**  
   `enabledByDefault: false` until list returns real data in manual smoke.

7. **Tests pin builtins, not the registry mechanism.**  
   Registry tests use a fake plugin; builtin tests cover real roots/match samples.

---

## 9. File layout (target)

```
src/providers/
  types.ts              # ProviderPlugin, strategies, ListedSession
  registry.ts           # register/get/enabled/resolveRoot/resolveAlias
  list.ts               # generic multi-provider list + scope filter
  match.ts              # strategy interpreter + encodings
  builtins/
    index.ts            # register all
    claude-code.ts
    codex.ts
    openclaw.ts
    # grok.ts           # when ready
    # hermes.ts         # when listing works
  recent.ts             # unchanged; uses list.ts
```

---

## 10. Success criteria

- Adding a documented Trajectory source with Node listing is a **single builtin file + register line + dep bump**.  
- `resume/`, `search/`, `ui/picker.ts` logic have **zero** source-id switches.  
- User config with a future provider key does not break parse.  
- README “Supported providers” can say: *built-ins listed below; new Trajectory sources land as small builtin plugins.*  

---

## 11. Relationship to SPEC.md

Product behavior in [SPEC.md](../SPEC.md) is unchanged (handoff, archive search, `/relay` tabs, startup offer).  
This plan only changes **how providers are wired**. When implementing Phase A+, update SPEC §5 (Providers) to point here and describe the plugin table instead of a fixed three-row matrix.

---

## 12. Suggested first PR (when ready)

Title: `refactor(providers): registry spine (behavior-preserving)`

- Phase A only  
- No README user-facing change required  
- Diff confined to `src/providers/**`, thin call-site updates, tests  
- Explicit non-goals in PR body: no new sources, no config schema break  

That PR makes every later source addition boring — which is the point.
