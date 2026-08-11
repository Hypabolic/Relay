import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { readTranscript, searchTranscript } from "../src/search/query.js";
import type { BoundArchive } from "../src/types.js";

async function makeArchive(): Promise<BoundArchive> {
  const dir = await mkdtemp(join(tmpdir(), "relay-test-"));
  const lines = [
    JSON.stringify({
      index: 0,
      id: "a",
      kind: "message",
      role: "user",
      order: 0,
      content: "Please refactor the payment webhook handler",
      toolName: null,
      toolCallId: null,
      toolCalls: null,
      isError: null,
      timestamp: null,
    }),
    JSON.stringify({
      index: 1,
      id: "b",
      kind: "message",
      role: "assistant",
      order: 1,
      content: "I will open src/payments/webhook.ts next.",
      toolName: null,
      toolCallId: null,
      toolCalls: null,
      isError: null,
      timestamp: null,
    }),
  ];
  await writeFile(join(dir, "normalized.jsonl"), `${lines.join("\n")}\n`);
  await writeFile(
    join(dir, "meta.json"),
    JSON.stringify({
      schemaVersion: 1,
      archiveId: "t1",
      provider: "codex",
      nativeId: "n1",
      originalPath: "/tmp/x",
      cwd: "/proj",
      title: "payments",
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sizeBytes: 10,
      diagnostics: [],
    }),
  );
  return {
    archiveId: "t1",
    archiveDir: dir,
    meta: {
      schemaVersion: 1,
      archiveId: "t1",
      provider: "codex",
      nativeId: "n1",
      originalPath: "/tmp/x",
      cwd: "/proj",
      title: "payments",
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sizeBytes: 10,
      diagnostics: [],
    },
  };
}

const searchConfig = {
  maxResults: 20,
  maxCharsPerHit: 800,
  maxResponseChars: 12_000,
};

describe("searchTranscript", () => {
  it("finds inert matches", async () => {
    const bound = await makeArchive();
    const out = await searchTranscript(bound, { query: "webhook" }, searchConfig);
    assert.match(out, /INERT FOREIGN HISTORY/);
    assert.match(out, /webhook/i);
  });
});

describe("readTranscript", () => {
  it("reads by offset", async () => {
    const bound = await makeArchive();
    const out = await readTranscript(bound, { offset: 0, limit: 1 }, searchConfig);
    assert.match(out, /payment webhook/);
  });
});
