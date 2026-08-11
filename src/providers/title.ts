import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import type { RelayProviderId, RelaySessionRef } from "../types.js";
import { titleFromPath } from "./match.js";

/**
 * Local fallback title derivation when Trajectory listing does not supply `title`.
 * Trajectory ≥0.1.2 already skips harness injection for Codex/Claude/etc.;
 * prefer `item.title` / `titleFromListing` and only call this as backup.
 */

export function isHarnessUserText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 4) return true;

  const lower = t.toLowerCase();
  const noiseMarkers = [
    "# agents.md",
    "<instructions>",
    "</instructions>",
    "<environment_context>",
    "<skills_instructions>",
    "<skills>",
    "<permissions instructions>",
    "<collaboration",
    "filesystem sandboxing",
    "<cwd>",
    "you are a coding agent",
    "you are chatgpt",
    "# claude.md",
  ];
  for (const m of noiseMarkers) {
    if (lower.includes(m)) return true;
  }

  const tagCount = (t.match(/<[a-zA-Z/_-]+>/g) ?? []).length;
  if (tagCount >= 3 && t.length > 80) return true;
  if (t.length > 400 && !/[.?!\n]/.test(t.slice(0, 120))) return true;
  return false;
}

function blocksToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object") {
          const o = b as Record<string, unknown>;
          if (typeof o.text === "string") return o.text;
          if (typeof o.input_text === "string") return o.input_text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (o.content !== undefined) return blocksToText(o.content);
  }
  return "";
}

function cleanTitle(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= 80) return one;
  return `${one.slice(0, 77)}…`;
}

function candidateFromCodexRow(row: Record<string, unknown>): string | undefined {
  const type = row.type;
  const payload =
    row.payload && typeof row.payload === "object"
      ? (row.payload as Record<string, unknown>)
      : row;
  const role = payload.role ?? row.role;
  if (type === "response_item" || payload.type === "message") {
    if (role !== "user") return undefined;
    const text = blocksToText(payload.content ?? row.content);
    if (text && !isHarnessUserText(text)) return text;
  }
  return undefined;
}

function candidateFromClaudeRow(row: Record<string, unknown>): string | undefined {
  const type = row.type ?? row.role;
  if (type === "custom-title" || type === "ai-title" || type === "summary") {
    const t =
      (typeof row.customTitle === "string" && row.customTitle) ||
      (typeof row.aiTitle === "string" && row.aiTitle) ||
      (typeof row.summary === "string" && row.summary) ||
      (typeof row.title === "string" && row.title) ||
      "";
    if (t && !isHarnessUserText(t)) return t;
  }
  if (type !== "user" && row.role !== "user") return undefined;
  const message = row.message as Record<string, unknown> | undefined;
  let text = "";
  if (message) text = blocksToText(message.content ?? message);
  if (!text) text = blocksToText(row.content);
  if (text.includes("tool_use_id")) return undefined;
  if (text && !isHarnessUserText(text)) return text;
  return undefined;
}

function candidateFromGenericRow(row: Record<string, unknown>): string | undefined {
  const role = row.role ?? (row.message as { role?: string } | undefined)?.role;
  if (role && role !== "user") return undefined;
  const text =
    blocksToText(row.content) ||
    blocksToText((row.message as { content?: unknown } | undefined)?.content) ||
    (typeof row.text === "string" ? row.text : "");
  if (text && !isHarnessUserText(text)) return text;
  return undefined;
}

export async function deriveSessionTitle(
  provider: RelayProviderId,
  filePath: string,
  fallbackId: string,
): Promise<string> {
  const maxLines = 80;
  const maxBytes = 600_000;
  let bytes = 0;
  let n = 0;

  try {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      bytes += Buffer.byteLength(line, "utf8") + 1;
      n++;
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        let text: string | undefined;
        if (provider === "codex") text = candidateFromCodexRow(row);
        else if (provider === "claude-code") text = candidateFromClaudeRow(row);
        else text = candidateFromGenericRow(row);

        if (text && !isHarnessUserText(text)) {
          rl.close();
          stream.destroy();
          return cleanTitle(text);
        }
      } catch {
        // skip
      }
      if (n >= maxLines || bytes >= maxBytes) break;
    }
    rl.close();
    stream.destroy();
  } catch {
    // fall through
  }

  return titleFromPath(filePath, fallbackId);
}

/** Listing sometimes falls back to a short session id — not useful in a picker. */
export function isWeakListingTitle(title: string, id: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (t === id || t === "chat_history") return true;
  if (t.startsWith("rollout-")) return true;
  // bare uuid / uuid prefix (e.g. Trajectory shortSessionId → "019feebd")
  if (/^[0-9a-f]{6,12}$/i.test(t)) return true;
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(t)) return true;
  if (id.startsWith(t) && t.length <= 12) return true;
  return isHarnessUserText(t);
}

/**
 * Prefer strong Trajectory listing titles (0.1.2+).
 * Fall back to local scrape when missing/weak (short ids, rollout stems, noise).
 */
export async function enrichTitle(ref: RelaySessionRef): Promise<string> {
  if (
    ref.titleFromListing &&
    ref.title.trim() &&
    !isWeakListingTitle(ref.title, ref.id)
  ) {
    return ref.title;
  }
  if (ref.title && !isWeakListingTitle(ref.title, ref.id)) {
    return ref.title;
  }
  return deriveSessionTitle(ref.provider, ref.path, ref.id);
}
