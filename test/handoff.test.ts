import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TrajectoryIR } from "@hypabolic/trajectory";

import { buildHandoff } from "../src/resume/handoff.js";
import type { RelayArchiveMeta, RelaySessionRef } from "../src/types.js";

function fakeIr(overrides?: Partial<TrajectoryIR>): TrajectoryIR {
  return {
    source: "claude-code",
    sourceName: "claude-code",
    groupId: "g1",
    groupResolved: true,
    records: [
      {
        id: "1",
        kind: "message",
        role: "user",
        order: 0,
        sourceTimestamp: null,
        timestamp: null,
        content: "Please fix the auth redirect in src/auth.ts",
        provenance: {
          stableSourceRecordId: "1",
          sourceIdentityKind: "synthetic",
          sourceOrderId: "0",
          componentKey: "c",
          componentIndex: 0,
          componentTypeOrdinal: 0,
        },
        hashes: { contentSha256: "a", recordSha256: "b" },
      },
      {
        id: "2",
        kind: "message",
        role: "assistant",
        order: 1,
        sourceTimestamp: null,
        timestamp: null,
        content: "I will inspect src/auth.ts and update the callback URL.",
        provenance: {
          stableSourceRecordId: "2",
          sourceIdentityKind: "synthetic",
          sourceOrderId: "1",
          componentKey: "c",
          componentIndex: 1,
          componentTypeOrdinal: 0,
        },
        hashes: { contentSha256: "c", recordSha256: "d" },
      },
    ],
    diagnostics: [],
    execution: { modelInvocations: [], workflowInvocations: [] },
    config: {
      bounds: {
        toolArguments: { maxCharacters: 1000 },
        toolResults: { maxCharacters: 1000, strategy: "head" },
      },
      filters: { toolResults: "include" },
      sourceContext: { baseByteOffset: 0n, partial: false },
    },
    ...overrides,
  };
}

describe("buildHandoff", () => {
  const session: RelaySessionRef = {
    provider: "claude-code",
    id: "sess-1",
    path: "/tmp/s.jsonl",
    updatedAt: "2026-01-15T12:00:00.000Z",
    sizeBytes: 100,
    title: "auth fix",
    cwdMatch: true,
  };

  const meta: RelayArchiveMeta = {
    schemaVersion: 1,
    archiveId: "arch-1",
    provider: "claude-code",
    nativeId: "sess-1",
    originalPath: "/tmp/s.jsonl",
    cwd: "/proj",
    title: "auth fix",
    importedAt: "2026-01-15T12:01:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    sizeBytes: 100,
    diagnostics: [],
  };

  it("includes safety, last user request, and search pointers", () => {
    const { markdown, lastUserRequest } = buildHandoff({
      session,
      ir: fakeIr(),
      meta,
      maxChars: 16_000,
    });
    assert.match(markdown, /untrusted inert history/i);
    assert.match(markdown, /relay_transcript_search/);
    assert.match(markdown, /src\/auth\.ts/);
    assert.ok(lastUserRequest?.includes("auth redirect"));
  });

  it("respects maxChars", () => {
    const { markdown } = buildHandoff({
      session,
      ir: fakeIr(),
      meta,
      maxChars: 400,
    });
    assert.ok(markdown.length <= 400);
    assert.match(markdown, /truncated/i);
  });
});
