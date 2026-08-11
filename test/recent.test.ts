import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatAge, isWithinWindow } from "../src/providers/recent.js";

describe("isWithinWindow", () => {
  const now = Date.parse("2026-01-15T12:00:00.000Z");

  it("accepts recent timestamps", () => {
    assert.equal(
      isWithinWindow("2026-01-15T11:55:00.000Z", 10 * 60_000, now),
      true,
    );
  });

  it("rejects old timestamps", () => {
    assert.equal(
      isWithinWindow("2026-01-15T10:00:00.000Z", 10 * 60_000, now),
      false,
    );
  });
});

describe("formatAge", () => {
  const now = Date.parse("2026-01-15T12:00:00.000Z");
  it("formats minutes", () => {
    assert.equal(formatAge("2026-01-15T11:57:00.000Z", now), "3m ago");
  });
  it("formats moments", () => {
    assert.equal(formatAge("2026-01-15T11:59:30.000Z", now), "moments ago");
  });
});
