import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultConfig, mergeConfig } from "../src/config.js";

describe("mergeConfig", () => {
  it("overlays provider enablement and roots", () => {
    const base = defaultConfig();
    const merged = mergeConfig(base, {
      startupOffer: false,
      recentWindowMinutes: 15,
      providers: {
        codex: { enabled: false },
        "claude-code": { root: "/custom/claude" },
      },
    });
    assert.equal(merged.startupOffer, false);
    assert.equal(merged.recentWindowMinutes, 15);
    assert.equal(merged.providers.codex.enabled, false);
    assert.equal(merged.providers["claude-code"].root, "/custom/claude");
    assert.equal(merged.providers.openclaw.enabled, true);
  });
});
