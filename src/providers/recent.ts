import type { RelayConfig, RelaySessionRef } from "../types.js";
import { listRelaySessions } from "./list.js";

export function isWithinWindow(
  updatedAtIso: string,
  windowMs: number,
  nowMs: number = Date.now(),
): boolean {
  const updated = Date.parse(updatedAtIso);
  if (Number.isNaN(updated)) return false;
  const age = nowMs - updated;
  // Allow small future skew (5 min)
  if (age < -5 * 60_000) return false;
  return age <= windowMs;
}

export interface StartupCandidates {
  /** Newest session within the window (the one we offer to one-click resume). */
  primary: RelaySessionRef;
  /** How many cwd-matched sessions fall inside the recency window. */
  recentCount: number;
  /** All cwd-matched sessions in the window, newest first (capped). */
  recent: RelaySessionRef[];
}

/**
 * Startup offer policy for multiple sessions:
 * - One-click offer = **single most recent** cwd-matched session in the window.
 * - If several qualify, `recentCount > 1` and the UI offers “Pick another…”
 *   which opens the full `/relay` picker (not a second modal of N sessions).
 */
export async function findStartupCandidates(
  cwd: string,
  config: RelayConfig,
  nowMs: number = Date.now(),
): Promise<StartupCandidates | undefined> {
  const windowMs = Math.max(1, config.recentWindowMinutes) * 60_000;
  const sessions = await listRelaySessions({
    config,
    cwd,
    projectScope: true,
  });
  const recent = sessions.filter((s) => isWithinWindow(s.updatedAt, windowMs, nowMs));
  if (recent.length === 0) return undefined;
  // listRelaySessions is already updatedAt desc
  return {
    primary: recent[0]!,
    recentCount: recent.length,
    recent: recent.slice(0, 20),
  };
}

/** @deprecated use findStartupCandidates */
export async function findRecentStartupCandidate(
  cwd: string,
  config: RelayConfig,
  nowMs: number = Date.now(),
): Promise<RelaySessionRef | undefined> {
  const found = await findStartupCandidates(cwd, config, nowMs);
  return found?.primary;
}

export function formatAge(updatedAtIso: string, nowMs: number = Date.now()): string {
  const updated = Date.parse(updatedAtIso);
  if (Number.isNaN(updated)) return "unknown age";
  const secs = Math.max(0, Math.floor((nowMs - updated) / 1000));
  if (secs < 60) return "moments ago";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
