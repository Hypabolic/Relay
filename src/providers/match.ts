import { basename, dirname, resolve } from "node:path";

import type { RelayProviderId } from "../types.js";

/**
 * Claude Code stores projects under directories whose names encode the absolute
 * cwd with path separators replaced (commonly `-` or URL-ish forms).
 */
export function encodeClaudeProjectDir(cwd: string): string {
  const normalized = resolve(cwd).replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    return `-${normalized.slice(1).replaceAll("/", "-")}`;
  }
  return normalized.replaceAll("/", "-").replaceAll(":", "-");
}

/** Grok Build uses URL-encoded absolute cwd as the sessions subdirectory name. */
export function encodeGrokCwdDir(cwd: string): string {
  const normalized = resolve(cwd).replace(/\\/g, "/");
  return encodeURIComponent(normalized);
}

export function claudeProjectCandidates(cwd: string): string[] {
  const resolved = resolve(cwd);
  const out = new Set<string>();
  out.add(encodeClaudeProjectDir(resolved));
  let current = resolved;
  for (let i = 0; i < 6; i++) {
    const parent = dirname(current);
    if (parent === current) break;
    out.add(encodeClaudeProjectDir(parent));
    current = parent;
  }
  for (const c of [...out]) {
    if (c.startsWith("-")) out.add(c.slice(1));
  }
  return [...out];
}

export function grokCwdCandidates(cwd: string): string[] {
  const resolved = resolve(cwd);
  const out = new Set<string>();
  out.add(encodeGrokCwdDir(resolved));
  let current = resolved;
  for (let i = 0; i < 6; i++) {
    const parent = dirname(current);
    if (parent === current) break;
    out.add(encodeGrokCwdDir(parent));
    current = parent;
  }
  return [...out];
}

export function extractProjectKey(provider: RelayProviderId, filePath: string): string | undefined {
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (provider === "claude-code") {
    const projectsIdx = parts.lastIndexOf("projects");
    if (projectsIdx >= 0 && parts[projectsIdx + 1]) return parts[projectsIdx + 1];
  }
  if (provider === "openclaw") {
    const agentsIdx = parts.lastIndexOf("agents");
    if (agentsIdx >= 0 && parts[agentsIdx + 1]) return parts[agentsIdx + 1];
  }
  if (provider === "grok-build") {
    // …/sessions/<url-encoded-cwd>/<uuid>/chat_history.jsonl
    const sessionsIdx = parts.lastIndexOf("sessions");
    if (sessionsIdx >= 0 && parts[sessionsIdx + 1]) return parts[sessionsIdx + 1];
  }
  if (provider === "codex") {
    return undefined;
  }
  return undefined;
}

export function matchesCwd(
  provider: RelayProviderId,
  filePath: string,
  cwd: string,
  options?: { codexHeaderCwd?: string | null },
): boolean {
  if (provider === "claude-code") {
    const key = extractProjectKey(provider, filePath);
    if (!key) return false;
    return claudeProjectCandidates(cwd).includes(key);
  }

  if (provider === "grok-build") {
    const key = extractProjectKey(provider, filePath);
    if (!key) return false;
    return grokCwdCandidates(cwd).includes(key);
  }

  if (provider === "codex") {
    if (options?.codexHeaderCwd) {
      try {
        return resolve(options.codexHeaderCwd) === resolve(cwd);
      } catch {
        return options.codexHeaderCwd.includes(cwd) || cwd.includes(options.codexHeaderCwd);
      }
    }
    return false;
  }

  if (provider === "openclaw") {
    const key = extractProjectKey(provider, filePath);
    if (key && key.length > 2) {
      // weak: agent id isn't cwd — fall through false for project scope unless path encodes cwd
    }
    const resolved = resolve(cwd).replace(/\\/g, "/");
    const encoded = encodeClaudeProjectDir(resolved);
    const path = filePath.replace(/\\/g, "/");
    return path.includes(encoded) || path.includes(encodeURIComponent(resolved));
  }

  return false;
}

/** Best-effort title from path when listing has no title. */
export function titleFromPath(filePath: string, id: string): string {
  const base = basename(filePath, ".jsonl");
  if (base && base !== id && base !== "chat_history") return base;
  return id.length >= 36 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
