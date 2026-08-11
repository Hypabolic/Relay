import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isHarnessUserText, isWeakListingTitle } from "../src/providers/title.js";

describe("isHarnessUserText", () => {
  it("flags AGENTS.md injection", () => {
    assert.equal(
      isHarnessUserText(
        "# AGENTS.md instructions\n\n<INSTRUCTIONS>\n@/home/matthew/.codex/HYPA.md",
      ),
      true,
    );
  });

  it("flags environment_context blocks", () => {
    assert.equal(
      isHarnessUserText(
        "<environment_context>\n  <cwd>/home/matthew/dev</cwd>\n</environment_context>",
      ),
      true,
    );
  });

  it("allows real user prompts", () => {
    assert.equal(
      isHarnessUserText("Review this codebase and get ready to work on it."),
      false,
    );
  });
});

describe("isWeakListingTitle", () => {
  it("flags short id fallbacks from listing", () => {
    assert.equal(isWeakListingTitle("019feebd", "rollout-…019feebd…"), true);
    assert.equal(
      isWeakListingTitle("Review this codebase and get ready to work on it.", "x"),
      false,
    );
  });
});
