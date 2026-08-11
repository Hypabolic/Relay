import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { ProviderConfig, RelayConfig, RelayProviderId, SearchConfig } from "./types.js";

const DEFAULT_SEARCH: SearchConfig = {
  maxResults: 20,
  maxCharsPerHit: 800,
  maxResponseChars: 12_000,
};

const DEFAULT_PROVIDER: ProviderConfig = { enabled: true, root: null };

export function defaultConfig(): RelayConfig {
  return {
    enabled: true,
    startupOffer: true,
    // Most-recent cwd session offer window. 10m is too tight for real switches;
    // 24h matches "I was working here earlier today".
    recentWindowMinutes: 24 * 60,
    projectScopeDefault: true,
    maxHandoffChars: 16_000,
    maxFileBytes: 52_428_800,
    search: { ...DEFAULT_SEARCH },
    providers: {
      "claude-code": { ...DEFAULT_PROVIDER },
      codex: { ...DEFAULT_PROVIDER },
      "grok-build": { ...DEFAULT_PROVIDER },
      openclaw: { ...DEFAULT_PROVIDER },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeProvider(
  base: ProviderConfig,
  overlay: unknown,
): ProviderConfig {
  if (!isObject(overlay)) return base;
  const next: ProviderConfig = {
    enabled: typeof overlay.enabled === "boolean" ? overlay.enabled : base.enabled,
  };
  if (overlay.root === null || typeof overlay.root === "string") {
    next.root = overlay.root as string | null;
  } else if (base.root !== undefined) {
    next.root = base.root;
  }
  return next;
}

function mergeSearch(base: SearchConfig, overlay: unknown): SearchConfig {
  if (!isObject(overlay)) return base;
  return {
    maxResults:
      typeof overlay.maxResults === "number" ? overlay.maxResults : base.maxResults,
    maxCharsPerHit:
      typeof overlay.maxCharsPerHit === "number"
        ? overlay.maxCharsPerHit
        : base.maxCharsPerHit,
    maxResponseChars:
      typeof overlay.maxResponseChars === "number"
        ? overlay.maxResponseChars
        : base.maxResponseChars,
  };
}

export function mergeConfig(base: RelayConfig, overlay: unknown): RelayConfig {
  if (!isObject(overlay)) return base;
  const providers = { ...base.providers };
  if (isObject(overlay.providers)) {
    for (const key of Object.keys(providers) as RelayProviderId[]) {
      providers[key] = mergeProvider(providers[key]!, overlay.providers[key]);
    }
  }
  return {
    enabled: typeof overlay.enabled === "boolean" ? overlay.enabled : base.enabled,
    startupOffer:
      typeof overlay.startupOffer === "boolean" ? overlay.startupOffer : base.startupOffer,
    recentWindowMinutes:
      typeof overlay.recentWindowMinutes === "number"
        ? overlay.recentWindowMinutes
        : base.recentWindowMinutes,
    projectScopeDefault:
      typeof overlay.projectScopeDefault === "boolean"
        ? overlay.projectScopeDefault
        : base.projectScopeDefault,
    maxHandoffChars:
      typeof overlay.maxHandoffChars === "number"
        ? overlay.maxHandoffChars
        : base.maxHandoffChars,
    maxFileBytes:
      typeof overlay.maxFileBytes === "number" ? overlay.maxFileBytes : base.maxFileBytes,
    search: mergeSearch(base.search, overlay.search),
    providers,
  };
}

function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

export function getAgentDir(): string {
  return process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent");
}

/** Load user + optional project config. */
export function loadConfig(cwd?: string): RelayConfig {
  let config = defaultConfig();
  config = mergeConfig(config, readJsonFile(join(getAgentDir(), "relay.json")));
  if (cwd) {
    config = mergeConfig(config, readJsonFile(join(cwd, ".pi", "relay.json")));
  }
  return config;
}
