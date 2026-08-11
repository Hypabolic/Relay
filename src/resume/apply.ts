import { readFile } from "node:fs/promises";

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import type { RelayConfig, RelaySessionRef } from "../types.js";
import { RELAY_CONTEXT_MESSAGE_TYPE, RELAY_PROVENANCE_TYPE } from "../types.js";
import { createArchive } from "./archive.js";
import { CONTINUE_STEER } from "./handoff.js";
import { bindArchive, provenanceData } from "./bind.js";

function branchIsEmpty(ctx: ExtensionContext): boolean {
  try {
    const branch = ctx.sessionManager.getBranch();
    return !branch.some((e) => {
      if (e.type !== "message") return false;
      const role = (e as { message?: { role?: string } }).message?.role;
      return role === "user" || role === "assistant";
    });
  } catch {
    return false;
  }
}

async function seedIntoCurrentSession(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  session: RelaySessionRef,
  archive: Awaited<ReturnType<typeof createArchive>>,
): Promise<void> {
  const sessionFile = ctx.sessionManager.getSessionFile();
  bindArchive(sessionFile, archive.bound);

  try {
    pi.appendEntry(RELAY_PROVENANCE_TYPE, provenanceData(archive.bound));
  } catch {
    // non-fatal
  }

  pi.sendMessage(
    {
      customType: RELAY_CONTEXT_MESSAGE_TYPE,
      content: archive.handoffMarkdown,
      display: true,
      details: {
        archiveId: archive.bound.archiveId,
        provider: session.provider,
        title: archive.bound.meta.title,
      },
    },
    { triggerTurn: false },
  );

  try {
    pi.setSessionName(`Relay: ${archive.bound.meta.title}`.slice(0, 80));
  } catch {
    // optional
  }

  ctx.ui.notify(`Relayed ${session.provider} session — verifying and continuing…`, "info");
  pi.sendUserMessage(CONTINUE_STEER);
}

export async function resumeSession(options: {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  session: RelaySessionRef;
  config: RelayConfig;
  /**
   * When true (default for /relay with newSession), open a fresh Pi session.
   * When false, seed the current session (startup offer / empty branch).
   */
  preferNewSession?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { pi, ctx, session, config } = options;

  if (ctx.mode !== "tui") {
    return { ok: false, error: "Relay requires interactive (TUI) mode" };
  }

  let transcriptBytes: Uint8Array;
  try {
    transcriptBytes = await readFile(session.path);
  } catch (err) {
    return {
      ok: false,
      error: `Failed to read transcript: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let archive: Awaited<ReturnType<typeof createArchive>>;
  try {
    archive = await createArchive({
      session,
      cwd: ctx.cwd,
      maxHandoffChars: config.maxHandoffChars,
      maxFileBytes: config.maxFileBytes,
      transcriptBytes,
    });
  } catch (err) {
    return {
      ok: false,
      error: `Normalize/archive failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Capture plain data before any session switch (withSession must not rely on live pi state).
  const handoffMarkdown = archive.handoffMarkdown;
  const provenance = provenanceData(archive.bound);
  const bound = archive.bound;
  const title = archive.bound.meta.title;
  const provider = session.provider;
  const empty = branchIsEmpty(ctx);

  const cmdCtx = ctx as ExtensionCommandContext;
  const canNewSession = typeof cmdCtx.newSession === "function";

  // Prefer in-place seed when the current branch is empty — avoids newSession
  // rebind hazards and matches startup-offer UX.
  if (empty || options.preferNewSession === false) {
    try {
      await seedIntoCurrentSession(pi, ctx, session, archive);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: `Seed failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (!canNewSession) {
    return {
      ok: false,
      error: "Cannot open a new session from this context; start an empty session and retry",
    };
  }

  try {
    const parentSession = ctx.sessionManager.getSessionFile();
    const result = await cmdCtx.newSession({
      ...(parentSession ? { parentSession } : {}),
      withSession: async (replacementCtx) => {
        // Only use replacementCtx — outer pi is stale after session_shutdown/rebind.
        const sessionFile = replacementCtx.sessionManager.getSessionFile();
        bindArchive(sessionFile, bound);

        try {
          await replacementCtx.sendMessage(
            {
              customType: RELAY_CONTEXT_MESSAGE_TYPE,
              content: handoffMarkdown,
              display: true,
              details: provenance,
            },
            { triggerTurn: false },
          );
        } catch (err) {
          replacementCtx.ui.notify(
            `Failed to inject handoff: ${err instanceof Error ? err.message : String(err)}`,
            "error",
          );
          return;
        }

        replacementCtx.ui.notify(
          `Relayed ${provider} session (${title.slice(0, 40)}) — verifying and continuing…`,
          "info",
        );

        try {
          await replacementCtx.sendUserMessage(CONTINUE_STEER);
        } catch (err) {
          replacementCtx.ui.notify(
            `Failed to start continue turn: ${err instanceof Error ? err.message : String(err)}`,
            "error",
          );
        }
      },
    });

    if (result.cancelled) {
      return { ok: false, error: "New session cancelled" };
    }
    return { ok: true };
  } catch (err) {
    // Fall back to in-place seed if newSession blows up
    try {
      await seedIntoCurrentSession(pi, ctx, session, archive);
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: `Resume failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
