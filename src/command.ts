import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";

import { loadConfig } from "./config.js";
import { listByProvider, listRelaySessions, enrichTitle } from "./providers/list.js";
import { findStartupCandidates } from "./providers/recent.js";
import { resumeSession } from "./resume/apply.js";
import type { RelayProviderId, RelaySessionRef } from "./types.js";
import { normalizeProviderId } from "./types.js";
import { showRelayPicker } from "./ui/picker.js";
import {
  clearOfferWidget,
  confirmOffer,
  dismissOffer,
  showOfferWidget,
  wasDismissed,
} from "./ui/offer.js";

/** Pending startup offer session for /relay yes */
let pendingOffer: RelaySessionRef | undefined;

export function getPendingOffer(): RelaySessionRef | undefined {
  return pendingOffer;
}

export function setPendingOffer(session: RelaySessionRef | undefined): void {
  pendingOffer = session;
}

function parseArgs(args: string): {
  provider?: RelayProviderId;
  ref?: string;
  flag?: "yes" | "no" | "latest" | "list";
} {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  const first = parts[0]!.toLowerCase();
  if (first === "yes" || first === "no" || first === "latest" || first === "list") {
    return { flag: first };
  }
  const provider = normalizeProviderId(first);
  if (provider) {
    return {
      provider,
      ...(parts[1] ? { ref: parts.slice(1).join(" ") } : {}),
    };
  }
  return { ref: parts.join(" ") };
}

async function withLoader<T>(
  ctx: ExtensionCommandContext,
  label: string,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T | null> {
  return ctx.ui.custom<T | null>((tui, theme, _kb, done) => {
    const loader = new BorderedLoader(tui, theme, label);
    loader.onAbort = () => done(null);
    work(loader.signal)
      .then(done)
      .catch((err) => {
        console.error(err);
        done(null);
      });
    return loader;
  });
}

async function resolveDirectRef(
  ctx: ExtensionCommandContext,
  provider: RelayProviderId | undefined,
  ref: string,
  projectScope: boolean,
): Promise<RelaySessionRef | undefined> {
  const config = loadConfig(ctx.cwd);
  const sessions = await listRelaySessions({
    config,
    cwd: ctx.cwd,
    projectScope,
    ...(provider ? { providers: [provider] } : {}),
  });
  const q = ref.toLowerCase();
  const exact = sessions.filter(
    (s) => s.id.toLowerCase() === q || s.path === ref || s.path.endsWith(ref),
  );
  if (exact.length === 1) return exact[0];
  const prefix = sessions.filter(
    (s) => s.id.toLowerCase().startsWith(q) || s.title.toLowerCase().includes(q),
  );
  if (prefix.length === 1) return prefix[0];
  return undefined;
}

export async function runRelayCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("Relay requires interactive mode", "error");
    return;
  }

  const config = loadConfig(ctx.cwd);
  if (!config.enabled) {
    ctx.ui.notify("Relay is disabled in config", "warning");
    return;
  }

  const parsed = parseArgs(args);

  if (parsed.flag === "no") {
    if (pendingOffer) dismissOffer(pendingOffer);
    pendingOffer = undefined;
    clearOfferWidget(ctx);
    ctx.ui.notify("Relay offer dismissed", "info");
    return;
  }

  if (parsed.flag === "yes") {
    const session = pendingOffer;
    clearOfferWidget(ctx);
    pendingOffer = undefined;
    if (!session) {
      ctx.ui.notify("No pending Relay offer — try /relay", "warning");
      return;
    }
    const result = await resumeSession({ pi, ctx, session, config });
    if (!result.ok) ctx.ui.notify(result.error, "error");
    return;
  }

  if (parsed.flag === "latest") {
    const session = await withLoader(ctx, "Finding latest foreign session…", async () => {
      const sessions = await listRelaySessions({
        config,
        cwd: ctx.cwd,
        projectScope: true,
      });
      return sessions[0] ?? null;
    });
    if (!session) {
      ctx.ui.notify("No foreign sessions for this project", "warning");
      return;
    }
    const result = await resumeSession({ pi, ctx, session, config });
    if (!result.ok) ctx.ui.notify(result.error, "error");
    return;
  }

  // Direct provider + id
  if (parsed.ref && parsed.provider) {
    const session = await withLoader(ctx, "Resolving session…", async () => {
      const hit =
        (await resolveDirectRef(ctx, parsed.provider, parsed.ref!, true)) ??
        (await resolveDirectRef(ctx, parsed.provider, parsed.ref!, false));
      return hit ?? null;
    });
    if (!session) {
      ctx.ui.notify(`No session matched ${parsed.provider} ${parsed.ref}`, "warning");
      // fall through to picker with provider tab
    } else {
      const result = await resumeSession({ pi, ctx, session, config });
      if (!result.ok) ctx.ui.notify(result.error, "error");
      return;
    }
  }

  const preferProject = config.projectScopeDefault;

  async function loadMap(projectScope: boolean) {
    const map = await listByProvider({ config, cwd: ctx.cwd, projectScope });
    for (const [, list] of map) {
      for (const s of list.slice(0, 15)) {
        s.title = await enrichTitle(s);
      }
    }
    return map;
  }

  let projectScope = preferProject;
  let loaded = await withLoader(ctx, "Listing foreign sessions…", async () =>
    loadMap(projectScope),
  );

  if (!loaded || loaded.size === 0) {
    if (projectScope) {
      // Keep default semantics honest: we wanted project scope, but found none.
      // Fall back to all only after telling the user — they can Ctrl+P back.
      ctx.ui.notify(
        "No sessions matched this project — showing all. Ctrl+P filters to project.",
        "warning",
      );
      projectScope = false;
      loaded = await withLoader(ctx, "Listing all foreign sessions…", async () =>
        loadMap(false),
      );
    }
  }

  if (!loaded || loaded.size === 0) {
    ctx.ui.notify("No foreign sessions found under default stores", "warning");
    return;
  }

  clearOfferWidget(ctx);
  const picked = await showRelayPicker(ctx, {
    byProvider: loaded,
    ...(parsed.provider ? { initialProvider: parsed.provider } : {}),
    projectScope,
    onToggleScope: async (next) => loadMap(next),
  });

  if (!picked) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  try {
    const result = await resumeSession({ pi, ctx, session: picked.session, config });
    if (!result.ok) ctx.ui.notify(result.error, "error");
  } catch (err) {
    ctx.ui.notify(
      `Resume crashed: ${err instanceof Error ? err.message : String(err)}`,
      "error",
    );
    console.error("Relay resume error", err);
  }
}

export async function maybeStartupOffer(
  pi: ExtensionAPI,
  ctx: import("@earendil-works/pi-coding-agent").ExtensionContext,
): Promise<void> {
  const config = loadConfig(ctx.cwd);
  if (!config.enabled || !config.startupOffer) return;
  if (ctx.mode !== "tui") return;

  // empty branch only
  try {
    const branch = ctx.sessionManager.getBranch();
    const hasChat = branch.some((e) => {
      if (e.type !== "message") return false;
      const role = (e as { message?: { role?: string } }).message?.role;
      return role === "user" || role === "assistant";
    });
    if (hasChat) return;
  } catch {
    return;
  }

  const found = await findStartupCandidates(ctx.cwd, config);
  if (!found || wasDismissed(found.primary)) return;

  const candidate = found.primary;
  candidate.title = await enrichTitle(candidate);
  pendingOffer = candidate;

  // One UI surface only: modal select with session title.
  // Widget is a fallback if select is unavailable (no toast — avoids triple copy).
  const choice = await confirmOffer(ctx, candidate, {
    recentCount: found.recentCount,
  });

  if (choice === undefined) {
    showOfferWidget(ctx, candidate, { recentCount: found.recentCount });
    return;
  }
  if (choice === "no") {
    dismissOffer(candidate);
    pendingOffer = undefined;
    clearOfferWidget(ctx);
    return;
  }
  if (choice === "list") {
    clearOfferWidget(ctx);
    pendingOffer = undefined;
    const cmd = ctx as ExtensionCommandContext;
    if (typeof cmd.newSession === "function") {
      await runRelayCommand(pi, "", cmd);
    } else {
      ctx.ui.notify("Run /relay to browse sessions", "info");
    }
    return;
  }
  // yes — seed the current empty session in place
  clearOfferWidget(ctx);
  pendingOffer = undefined;
  const result = await resumeSession({
    pi,
    ctx,
    session: candidate,
    config,
    preferNewSession: false,
  });
  if (!result.ok) ctx.ui.notify(result.error, "error");
}
