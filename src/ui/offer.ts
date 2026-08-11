import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

import { formatAge } from "../providers/recent.js";
import { providerLabel } from "../providers/registry.js";
import type { RelaySessionRef } from "../types.js";

export type OfferChoice = "yes" | "list" | "no";

const dismissedKeys = new Set<string>();

export function offerKey(session: RelaySessionRef): string {
  return `${session.provider}:${session.id}`;
}

export function wasDismissed(session: RelaySessionRef): boolean {
  return dismissedKeys.has(offerKey(session));
}

export function dismissOffer(session: RelaySessionRef): void {
  dismissedKeys.add(offerKey(session));
}

export function clearOfferWidget(ctx: ExtensionContext): void {
  try {
    ctx.ui.setWidget("relay-offer", undefined);
  } catch {
    // ignore
  }
}

function displayTitle(session: RelaySessionRef): string {
  const t = session.title?.trim();
  if (t && t !== session.id && !t.startsWith("rollout-")) return t;
  return session.id.length > 36 ? `${session.id.slice(0, 8)}…` : session.id;
}

function shortTitle(session: RelaySessionRef, max = 72): string {
  const t = displayTitle(session);
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Non-blocking footer tip only — used when a modal select is not available. */
export function showOfferWidget(
  ctx: ExtensionContext,
  session: RelaySessionRef,
  options?: { recentCount?: number },
): void {
  const age = formatAge(session.updatedAt);
  const tool = providerLabel(session.provider);
  const title = shortTitle(session);
  try {
    ctx.ui.setWidget("relay-offer", (_tui, theme) => {
      const countNote =
        options?.recentCount && options.recentCount > 1
          ? theme.fg("dim", ` (${options.recentCount} recent)`)
          : "";
      const line1 =
        theme.fg("accent", `Coming from ${tool}? `) +
        theme.fg("muted", `Resume session from ${age}`) +
        countNote;
      const line2 =
        theme.fg("dim", "Session: ") + theme.fg("accent", title);
      const line3 =
        theme.fg("accent", "/relay yes") +
        theme.fg("dim", " resume  ·  ") +
        theme.fg("accent", "/relay") +
        theme.fg("dim", " pick another  ·  ") +
        theme.fg("accent", "/relay no") +
        theme.fg("dim", " dismiss");
      return new Text([line1, line2, line3].join("\n"));
    });
  } catch {
    // optional
  }
}

/**
 * Single modal for the startup offer. Title is the primary line.
 * Does not also show a widget/toast — caller should only fall back to widget
 * if this returns undefined (select unavailable).
 */
export async function confirmOffer(
  ctx: ExtensionContext,
  session: RelaySessionRef,
  options?: { recentCount?: number },
): Promise<OfferChoice | undefined> {
  const age = formatAge(session.updatedAt);
  const tool = providerLabel(session.provider);
  const title = shortTitle(session, 100);

  const more =
    options?.recentCount && options.recentCount > 1
      ? `\n(${options.recentCount} recent sessions in this project — choose “Pick another” to browse)`
      : "";

  // Instruction + labeled session title. Single surface — no stacked widget/toast.
  const prompt = [
    `Coming from ${tool}? Resume session from ${age}`,
    `Session: ${title}`,
    more.trimStart(),
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  try {
    const choice = await ctx.ui.select(prompt, [
      "Resume this session",
      "Pick another…",
      "Not now",
    ]);
    if (choice === "Resume this session") return "yes";
    if (choice === "Pick another…") return "list";
    if (choice === "Not now") return "no";
    return undefined;
  } catch {
    return undefined;
  }
}
