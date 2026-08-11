import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  claudeProjectCandidates,
  encodeClaudeProjectDir,
  encodeGrokCwdDir,
  matchesCwd,
  titleFromPath,
} from "../src/providers/match.js";

describe("encodeClaudeProjectDir", () => {
  it("encodes absolute unix paths like Claude Code", () => {
    assert.equal(
      encodeClaudeProjectDir("/home/matthew/development/hypabolic/Relay"),
      "-home-matthew-development-hypabolic-Relay",
    );
  });
});

describe("claudeProjectCandidates", () => {
  it("includes cwd and parents", () => {
    const c = claudeProjectCandidates("/home/matthew/dev/app");
    assert.ok(c.includes("-home-matthew-dev-app"));
    assert.ok(c.includes("-home-matthew-dev"));
  });
});

describe("matchesCwd", () => {
  it("matches claude project path", () => {
    const path =
      "/home/u/.claude/projects/-home-u-work-repo/abc-def.jsonl";
    assert.equal(matchesCwd("claude-code", path, "/home/u/work/repo"), true);
    assert.equal(matchesCwd("claude-code", path, "/home/u/other"), false);
  });

  it("matches codex via header cwd", () => {
    assert.equal(
      matchesCwd("codex", "/tmp/rollout.jsonl", "/proj", {
        codexHeaderCwd: "/proj",
      }),
      true,
    );
  });
});

describe("titleFromPath", () => {
  it("falls back to shortened id", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    assert.match(titleFromPath(`/x/${id}.jsonl`, id), /…/);
  });
});

describe("grok cwd match", () => {
  it("matches URL-encoded session path", () => {
    const cwd = "/home/matthew/development/hypabolic/Relay";
    const enc = encodeGrokCwdDir(cwd);
    const path = `/home/matthew/.grok/sessions/${enc}/019feebd-baa6-7470-a0f4-43aba8ef5f90/chat_history.jsonl`;
    assert.equal(matchesCwd("grok-build", path, cwd), true);
    assert.equal(matchesCwd("grok-build", path, "/home/matthew/other"), false);
  });
});
