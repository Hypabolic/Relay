import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import {
  listClaudeCodeTrajectories,
  listCodexTrajectories,
  listGrokBuildTrajectories,
  listOpenClawTrajectories,
} from "@hypabolic/trajectory-node";

import type { RelayConfig, RelayProviderId, RelaySessionRef } from "../types.js";
import { extractProjectKey, matchesCwd, titleFromPath } from "./match.js";
import { enabledProviders, resolveProviderRoot } from "./registry.js";

const LIST_LIMIT = 50;

interface ListedItem {
  id: string;
  path: string;
  updatedAt: string;
  sizeBytes: number;
  title?: string;
}

async function listProvider(provider: RelayProviderId, root: string): Promise<ListedItem[]> {
  try {
    const page =
      provider === "claude-code"
        ? await listClaudeCodeTrajectories({ root, limit: LIST_LIMIT })
        : provider === "codex"
          ? await listCodexTrajectories({ root, limit: LIST_LIMIT })
          : provider === "grok-build"
            ? await listGrokBuildTrajectories({ root, limit: LIST_LIMIT })
            : await listOpenClawTrajectories({ root, limit: LIST_LIMIT });
    return page.items.map((item) => ({
      id: item.id,
      path: item.path,
      updatedAt: item.updatedAt,
      sizeBytes: item.sizeBytes,
      ...(item.title !== undefined && item.title !== "" ? { title: item.title } : {}),
    }));
  } catch {
    return [];
  }
}

function cwdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.cwd === "string" && obj.cwd.trim()) return obj.cwd.trim();
  if (obj.payload && typeof obj.payload === "object") {
    const payload = obj.payload as Record<string, unknown>;
    if (typeof payload.cwd === "string" && payload.cwd.trim()) return payload.cwd.trim();
  }
  if (typeof obj.session_meta === "object" && obj.session_meta) {
    const meta = obj.session_meta as Record<string, unknown>;
    if (typeof meta.cwd === "string" && meta.cwd.trim()) return meta.cwd.trim();
  }
  return null;
}

/**
 * Peek Codex JSONL for workspace cwd (full lines — first line can be >16KB).
 */
export async function peekCodexCwd(filePath: string): Promise<string | null> {
  const maxLines = 40;
  const maxBytes = 512_000;
  let bytesSeen = 0;

  try {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let lineNo = 0;
    for await (const line of rl) {
      bytesSeen += Buffer.byteLength(line, "utf8") + 1;
      lineNo++;
      if (!line.trim()) continue;
      try {
        const cwd = cwdFromUnknown(JSON.parse(line) as unknown);
        if (cwd) {
          rl.close();
          stream.destroy();
          return cwd;
        }
      } catch {
        // skip
      }
      if (lineNo >= maxLines || bytesSeen >= maxBytes) break;
    }
    rl.close();
    stream.destroy();
  } catch {
    return null;
  }
  return null;
}

export interface ListOptions {
  config: RelayConfig;
  cwd: string;
  projectScope: boolean;
  providers?: RelayProviderId[];
}

export async function listRelaySessions(options: ListOptions): Promise<RelaySessionRef[]> {
  const ids = options.providers ?? enabledProviders(options.config);
  const batches = await Promise.all(
    ids.map(async (provider) => {
      const root = resolveProviderRoot(provider, options.config);
      const items = await listProvider(provider, root);
      const refs: RelaySessionRef[] = [];
      for (const item of items) {
        let codexHeaderCwd: string | null = null;
        if (provider === "codex" && options.projectScope) {
          codexHeaderCwd = await peekCodexCwd(item.path);
        }
        const cwdMatch = matchesCwd(provider, item.path, options.cwd, { codexHeaderCwd });
        if (options.projectScope && !cwdMatch) continue;

        const projectKey =
          extractProjectKey(provider, item.path) ??
          (codexHeaderCwd ? codexHeaderCwd : undefined);

        const listingTitle = item.title?.trim();
        refs.push({
          provider,
          id: item.id,
          path: item.path,
          updatedAt: item.updatedAt,
          sizeBytes: item.sizeBytes,
          title: listingTitle || titleFromPath(item.path, item.id),
          cwdMatch,
          ...(listingTitle ? { titleFromListing: true } : {}),
          ...(projectKey === undefined ? {} : { projectKey }),
        });
      }
      return refs;
    }),
  );

  const all = batches.flat();
  all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  return all;
}

export async function listByProvider(
  options: ListOptions,
): Promise<Map<RelayProviderId, RelaySessionRef[]>> {
  const sessions = await listRelaySessions(options);
  const map = new Map<RelayProviderId, RelaySessionRef[]>();
  for (const session of sessions) {
    const list = map.get(session.provider) ?? [];
    list.push(session);
    map.set(session.provider, list);
  }
  return map;
}

export { enrichTitle } from "./title.js";
