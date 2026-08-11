import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { RelayConfig, RelayProviderId } from "../types.js";
import { PROVIDER_ORDER } from "../types.js";

export interface ProviderDef {
  id: RelayProviderId;
  /** Short tab label */
  label: string;
  /** CLI / arg aliases */
  aliases: string[];
  defaultRoot(): string;
  envRootKeys: string[];
}

function openClawDefaultRoot(): string {
  const env =
    process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
  if (env) return env;
  const modern = join(homedir(), ".openclaw");
  if (existsSync(modern)) return modern;
  return join(homedir(), ".clawdbot");
}

function grokDefaultRoot(): string {
  const home = process.env.GROK_HOME?.trim();
  if (home) return join(home, "sessions");
  return join(homedir(), ".grok", "sessions");
}

export const PROVIDERS: readonly ProviderDef[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    aliases: ["claude", "claude-code", "claudecode"],
    defaultRoot: () => join(homedir(), ".claude", "projects"),
    envRootKeys: ["TRAJECTORY_CLAUDE_CODE_ROOT", "TRAJECTORY_CLAUDE_ROOT"],
  },
  {
    id: "codex",
    label: "Codex",
    aliases: ["codex"],
    defaultRoot: () => join(homedir(), ".codex", "sessions"),
    envRootKeys: ["TRAJECTORY_CODEX_ROOT"],
  },
  {
    id: "grok-build",
    label: "Grok",
    aliases: ["grok", "grok-build", "grokbuild"],
    defaultRoot: grokDefaultRoot,
    envRootKeys: ["TRAJECTORY_GROK_BUILD_ROOT", "TRAJECTORY_GROK_ROOT", "GROK_HOME"],
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    aliases: ["openclaw", "claw", "clawdbot"],
    defaultRoot: openClawDefaultRoot,
    envRootKeys: ["TRAJECTORY_OPENCLAW_ROOT", "OPENCLAW_STATE_DIR", "CLAWDBOT_STATE_DIR"],
  },
] as const;

export function providerDef(id: RelayProviderId): ProviderDef {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown provider: ${id}`);
  return found;
}

export function resolveProviderRoot(id: RelayProviderId, config: RelayConfig): string {
  const def = providerDef(id);
  const configured = config.providers[id]?.root;
  if (typeof configured === "string" && configured.trim()) return configured.trim();

  // GROK_HOME is the product home; listing root is …/sessions
  if (id === "grok-build") {
    for (const key of def.envRootKeys) {
      const value = process.env[key]?.trim();
      if (!value) continue;
      if (key === "GROK_HOME") return join(value, "sessions");
      return value;
    }
    return def.defaultRoot();
  }

  for (const key of def.envRootKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return def.defaultRoot();
}

export function enabledProviders(config: RelayConfig): RelayProviderId[] {
  return PROVIDER_ORDER.filter((id) => config.providers[id]?.enabled !== false);
}

export function providerLabel(id: RelayProviderId): string {
  return providerDef(id).label;
}

export function providersWithSessions(
  byProvider: Map<RelayProviderId, unknown[]>,
): RelayProviderId[] {
  return PROVIDER_ORDER.filter((id) => (byProvider.get(id)?.length ?? 0) > 0);
}
