import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  NORMALIZER_CONTRACT_VERSION,
  normalizeToHypabolic,
  normalizeToIR,
  type TrajectoryIR,
} from "@hypabolic/trajectory";

import { getAgentDir } from "../config.js";
import { enrichTitle } from "../providers/list.js";
import type { BoundArchive, RelayArchiveMeta, RelaySessionRef } from "../types.js";
import { buildHandoff } from "./handoff.js";

export function archivesRoot(): string {
  return join(getAgentDir(), "relay", "archives");
}

export interface CreateArchiveResult {
  bound: BoundArchive;
  ir: TrajectoryIR;
  handoffMarkdown: string;
  lastUserRequest?: string;
}

export async function createArchive(options: {
  session: RelaySessionRef;
  cwd: string;
  maxHandoffChars: number;
  maxFileBytes: number;
  transcriptBytes: Uint8Array;
}): Promise<CreateArchiveResult> {
  const { session, cwd, maxHandoffChars, maxFileBytes, transcriptBytes } = options;
  if (transcriptBytes.byteLength > maxFileBytes) {
    throw new Error(
      `Transcript is ${transcriptBytes.byteLength} bytes (limit ${maxFileBytes}). Raise maxFileBytes in relay.json if intentional.`,
    );
  }

  const ir = normalizeToIR({
    source: session.provider,
    transcriptBytes,
    sourceContext: { partial: false },
  });

  const title = (await enrichTitle(session)) || session.title;
  const archiveId = randomUUID();
  const archiveDir = join(archivesRoot(), archiveId);
  await mkdir(archiveDir, { recursive: true });

  const meta: RelayArchiveMeta = {
    schemaVersion: 1,
    archiveId,
    provider: session.provider,
    nativeId: session.id,
    originalPath: session.path,
    cwd,
    title,
    importedAt: new Date().toISOString(),
    updatedAt: session.updatedAt,
    sizeBytes: transcriptBytes.byteLength,
    normalizerVersion: NORMALIZER_CONTRACT_VERSION,
    diagnostics: ir.diagnostics.map((d) => ({ code: d.code, message: d.message })),
  };

  // Best-effort trajectory id from hypabolic projection
  try {
    const hyp = normalizeToHypabolic({
      source: session.provider,
      transcriptBytes,
      sourceContext: { partial: false },
    }) as { trajectory_id?: string };
    if (typeof hyp.trajectory_id === "string") meta.trajectoryId = hyp.trajectory_id;
  } catch {
    // optional
  }

  const handoff = buildHandoff({
    session: { ...session, title },
    ir,
    meta,
    maxChars: maxHandoffChars,
  });

  // Searchable normalized records (JSON array, one object per line for streaming search)
  const normalizedLines = ir.records.map((record, index) =>
    JSON.stringify({
      index,
      id: record.id,
      kind: record.kind,
      role: record.role,
      order: record.order,
      content: record.content ?? null,
      toolName: record.toolName ?? null,
      toolCallId: record.toolCallId ?? null,
      toolCalls: record.toolCalls ?? null,
      isError: record.isError ?? null,
      timestamp: record.timestamp ?? record.sourceTimestamp ?? null,
    }),
  );

  await Promise.all([
    writeFile(join(archiveDir, "transcript.raw"), transcriptBytes),
    writeFile(join(archiveDir, "normalized.jsonl"), `${normalizedLines.join("\n")}\n`, "utf8"),
    writeFile(join(archiveDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8"),
    writeFile(join(archiveDir, "handoff.md"), handoff.markdown, "utf8"),
  ]);

  return {
    bound: { archiveId, archiveDir, meta },
    ir,
    handoffMarkdown: handoff.markdown,
    ...(handoff.lastUserRequest === undefined
      ? {}
      : { lastUserRequest: handoff.lastUserRequest }),
  };
}
