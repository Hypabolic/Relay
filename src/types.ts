import type { TrajectorySource } from "@hypabolic/trajectory";

/** Providers Relay can resume from (Trajectory-backed foreign sources). */
export type RelayProviderId = Extract<
  TrajectorySource,
  "claude-code" | "codex" | "openclaw" | "grok-build"
>;

export interface ProviderConfig {
  enabled: boolean;
  /** Override store root; null/undefined uses default. */
  root?: string | null;
}

export interface SearchConfig {
  maxResults: number;
  maxCharsPerHit: number;
  maxResponseChars: number;
}

export interface RelayConfig {
  enabled: boolean;
  startupOffer: boolean;
  recentWindowMinutes: number;
  projectScopeDefault: boolean;
  maxHandoffChars: number;
  maxFileBytes: number;
  search: SearchConfig;
  providers: Record<RelayProviderId, ProviderConfig>;
}

export interface RelaySessionRef {
  provider: RelayProviderId;
  id: string;
  path: string;
  updatedAt: string;
  sizeBytes: number;
  /** Display title — prefer Trajectory listing title when present */
  title: string;
  /** Whether this row matched project-scope heuristics */
  cwdMatch: boolean;
  projectKey?: string;
  /** True when title came from Trajectory listing (not local scrape) */
  titleFromListing?: boolean;
}

export interface RelayArchiveMeta {
  schemaVersion: 1;
  archiveId: string;
  provider: RelayProviderId;
  nativeId: string;
  originalPath: string;
  cwd: string;
  title: string;
  importedAt: string;
  updatedAt: string;
  sizeBytes: number;
  trajectoryId?: string;
  normalizerVersion?: string;
  diagnostics: Array<{ code: string; message: string }>;
}

export interface BoundArchive {
  archiveId: string;
  archiveDir: string;
  meta: RelayArchiveMeta;
}

export const RELAY_PROVENANCE_TYPE = "relay-import";
export const RELAY_CONTEXT_MESSAGE_TYPE = "relay-handoff";

export interface RelayProvenanceData {
  archiveId: string;
  archiveDir: string;
  provider: RelayProviderId;
  nativeId: string;
  originalPath: string;
  title: string;
  importedAt: string;
  cwd: string;
}

/** Stable tab order */
export const PROVIDER_ORDER: readonly RelayProviderId[] = [
  "claude-code",
  "codex",
  "grok-build",
  "openclaw",
] as const;

export const PROVIDER_ALIASES: Record<string, RelayProviderId> = {
  claude: "claude-code",
  "claude-code": "claude-code",
  claudecode: "claude-code",
  codex: "codex",
  openclaw: "openclaw",
  claw: "openclaw",
  clawdbot: "openclaw",
  grok: "grok-build",
  "grok-build": "grok-build",
  grokbuild: "grok-build",
};

export function normalizeProviderId(raw: string | undefined): RelayProviderId | undefined {
  if (!raw) return undefined;
  return PROVIDER_ALIASES[raw.trim().toLowerCase()];
}
