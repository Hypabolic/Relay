import { formatAge } from "../providers/recent.js";
import { providerLabel } from "../providers/registry.js";
import type { RelaySessionRef } from "../types.js";

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sessionRowLabel(session: RelaySessionRef, nowMs?: number): string {
  return session.title || session.id;
}

export function sessionRowDescription(
  session: RelaySessionRef,
  options?: { showProvider?: boolean; showProject?: boolean; nowMs?: number },
): string {
  const parts: string[] = [];
  if (options?.showProvider) parts.push(providerLabel(session.provider));
  parts.push(formatAge(session.updatedAt, options?.nowMs));
  parts.push(formatSize(session.sizeBytes));
  if (options?.showProject && session.projectKey) {
    const key =
      session.projectKey.length > 32
        ? `${session.projectKey.slice(0, 14)}…${session.projectKey.slice(-10)}`
        : session.projectKey;
    parts.push(key);
  }
  parts.push(session.id.length > 12 ? `${session.id.slice(0, 8)}…` : session.id);
  return parts.join(" · ");
}
