import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import type { BoundArchive, RelayArchiveMeta, RelayProvenanceData } from "../types.js";
import { RELAY_PROVENANCE_TYPE } from "../types.js";

/** Process-local bind map: Pi session file path → archive */
const bindsBySessionFile = new Map<string, BoundArchive>();

/** Fallback when session file is ephemeral */
let lastBound: BoundArchive | undefined;

export function bindArchive(sessionFile: string | undefined, bound: BoundArchive): void {
  lastBound = bound;
  if (sessionFile) bindsBySessionFile.set(sessionFile, bound);
}

export function getBoundArchive(sessionFile: string | undefined): BoundArchive | undefined {
  if (sessionFile) {
    const hit = bindsBySessionFile.get(sessionFile);
    if (hit) return hit;
  }
  return lastBound;
}

export function clearBoundArchive(sessionFile: string | undefined): void {
  if (sessionFile) bindsBySessionFile.delete(sessionFile);
}

export async function loadMeta(archiveDir: string): Promise<RelayArchiveMeta> {
  const raw = await readFile(join(archiveDir, "meta.json"), "utf8");
  return JSON.parse(raw) as RelayArchiveMeta;
}

/** Restore bind from session provenance custom entries on session_start. */
export function restoreBindFromSession(ctx: ExtensionContext): BoundArchive | undefined {
  const sessionFile = ctx.sessionManager.getSessionFile();
  const existing = getBoundArchive(sessionFile);
  if (existing) return existing;

  try {
    const branch = ctx.sessionManager.getBranch();
    for (let i = branch.length - 1; i >= 0; i--) {
      const entry = branch[i] as { type?: string; customType?: string; data?: RelayProvenanceData };
      if (entry?.type === "custom" && entry.customType === RELAY_PROVENANCE_TYPE && entry.data) {
        const data = entry.data;
        if (!data.archiveDir || !data.archiveId) continue;
        const bound: BoundArchive = {
          archiveId: data.archiveId,
          archiveDir: data.archiveDir,
          meta: {
            schemaVersion: 1,
            archiveId: data.archiveId,
            provider: data.provider,
            nativeId: data.nativeId,
            originalPath: data.originalPath,
            cwd: data.cwd,
            title: data.title,
            importedAt: data.importedAt,
            updatedAt: data.importedAt,
            sizeBytes: 0,
            diagnostics: [],
          },
        };
        bindArchive(sessionFile, bound);
        return bound;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function provenanceData(bound: BoundArchive): RelayProvenanceData {
  return {
    archiveId: bound.archiveId,
    archiveDir: bound.archiveDir,
    provider: bound.meta.provider,
    nativeId: bound.meta.nativeId,
    originalPath: bound.meta.originalPath,
    title: bound.meta.title,
    importedAt: bound.meta.importedAt,
    cwd: bound.meta.cwd,
  };
}
