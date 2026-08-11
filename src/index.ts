/**
 * Relay — continue foreign coding-agent sessions inside Pi.
 *
 * /relay                  open tabbed session picker
 * /relay latest           newest cwd-matched session
 * /relay <provider> [id]  focus tab or direct resume
 * /relay yes|no           accept/dismiss startup offer
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { runRelayCommand, maybeStartupOffer } from "./command.js";
import { restoreBindFromSession } from "./resume/bind.js";
import { registerTranscriptTools } from "./search/tools.js";
import { registerProvenanceRenderer } from "./ui/provenance-card.js";

export default function relay(pi: ExtensionAPI): void {
  registerProvenanceRenderer(pi);
  registerTranscriptTools(pi);

  pi.registerCommand("relay", {
    description:
      "Continue a session from Claude Code, Codex, Grok, or OpenClaw (Trajectory-backed)",
    handler: async (args, ctx) => {
      await runRelayCommand(pi, args, ctx);
    },
  });

  pi.on("session_start", async (event, ctx) => {
    // Re-bind archive tools after reload / resume of a Relay session
    restoreBindFromSession(ctx);

    if (event.reason !== "startup" && event.reason !== "new") return;
    if (ctx.mode !== "tui" || !ctx.hasUI) return;

    // Defer so the TUI has finished first paint (microtask is often too early).
    setTimeout(() => {
      void maybeStartupOffer(pi, ctx).catch((err) => {
        console.error("Relay startup offer failed:", err);
      });
    }, 400);
  });
}
