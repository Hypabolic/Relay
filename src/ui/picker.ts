import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

import type { RelayProviderId, RelaySessionRef } from "../types.js";
import { PROVIDER_ORDER } from "../types.js";
import { providerLabel } from "../providers/registry.js";
import { sessionRowDescription, sessionRowLabel } from "./format.js";

export interface PickerResult {
  session: RelaySessionRef;
  projectScope: boolean;
}

function providerIdsWithSessions(
  byProvider: Map<RelayProviderId, RelaySessionRef[]>,
): RelayProviderId[] {
  return PROVIDER_ORDER.filter((id) => (byProvider.get(id)?.length ?? 0) > 0);
}

export async function showRelayPicker(
  ctx: ExtensionCommandContext,
  options: {
    byProvider: Map<RelayProviderId, RelaySessionRef[]>;
    initialProvider?: RelayProviderId;
    projectScope: boolean;
    onToggleScope: (next: boolean) => Promise<Map<RelayProviderId, RelaySessionRef[]>>;
  },
): Promise<PickerResult | null> {
  let projectScope = options.projectScope;
  let byProvider = options.byProvider;
  let loadingScope = false;
  let statusMessage = "";

  const providerOrder = providerIdsWithSessions(byProvider);

  if (providerOrder.length === 0) {
    return null;
  }

  let tabIndex = Math.max(
    0,
    options.initialProvider ? providerOrder.indexOf(options.initialProvider) : 0,
  );
  if (tabIndex < 0) tabIndex = 0;

  return ctx.ui.custom<PickerResult | null>((tui, theme, _kb, done) => {
    let selectList: SelectList | undefined;
    let cached: string[] | undefined;

    function currentProvider(): RelayProviderId {
      return providerOrder[tabIndex] ?? providerOrder[0]!;
    }

    function buildItems(): SelectItem[] {
      const sessions = byProvider.get(currentProvider()) ?? [];
      if (sessions.length === 0) {
        return [
          {
            value: "__empty__",
            label: projectScope
              ? "(no sessions for this project)"
              : "(no sessions)",
            description: projectScope
              ? "Ctrl+P show all projects"
              : "Ctrl+P filter to this project",
          },
        ];
      }
      return sessions.map((session) => ({
        value: `${session.provider}::${session.path}`,
        label: sessionRowLabel(session),
        description: sessionRowDescription(session, {
          showProject: !projectScope,
        }),
      }));
    }

    function findSession(value: string): RelaySessionRef | undefined {
      if (value === "__empty__") return undefined;
      const [provider, ...rest] = value.split("::");
      const path = rest.join("::");
      const list = byProvider.get(provider as RelayProviderId) ?? [];
      return list.find((s) => s.path === path);
    }

    function rebuildList(): void {
      const items = buildItems();
      selectList = new SelectList(items, Math.min(Math.max(items.length, 1), 12), {
        selectedPrefix: (text) => theme.fg("accent", text),
        selectedText: (text) => theme.fg("accent", text),
        description: (text) => theme.fg("muted", text),
        scrollInfo: (text) => theme.fg("dim", text),
        noMatch: (text) => theme.fg("warning", text),
      });
      selectList.onSelect = (item) => {
        if (item.value === "__empty__") return;
        const session = findSession(item.value);
        if (session) done({ session, projectScope });
      };
      selectList.onCancel = () => done(null);
      cached = undefined;
      tui.requestRender();
    }

    rebuildList();

    function tabBar(): string {
      if (providerOrder.length <= 1) {
        const id = currentProvider();
        const count = byProvider.get(id)?.length ?? 0;
        return theme.fg("accent", theme.bold(`${providerLabel(id)} (${count})`));
      }
      return providerOrder
        .map((id, i) => {
          const label = providerLabel(id);
          const count = byProvider.get(id)?.length ?? 0;
          const text = `${label} (${count})`;
          return i === tabIndex
            ? theme.fg("accent", theme.bold(`[${text}]`))
            : theme.fg("dim", ` ${text} `);
        })
        .join(" ");
    }

    async function toggleScope(): Promise<void> {
      if (loadingScope) return;
      loadingScope = true;
      statusMessage = "Loading…";
      cached = undefined;
      tui.requestRender();
      try {
        const next = !projectScope;
        const map = await options.onToggleScope(next);
        projectScope = next;
        byProvider = map;
        const order = providerIdsWithSessions(map);
        // Keep tabs even if empty after toggle — show empty placeholder, don't close.
        if (order.length > 0) {
          providerOrder.length = 0;
          providerOrder.push(...order);
          // Preserve provider tab when possible
          const cur = currentProvider();
          const idx = providerOrder.indexOf(cur);
          tabIndex = idx >= 0 ? idx : 0;
        } else {
          // No providers have rows in this scope — keep previous tabs, empty lists
          for (const id of [...providerOrder]) {
            if (!byProvider.has(id)) byProvider.set(id, []);
          }
        }
        statusMessage = "";
        rebuildList();
      } catch (err) {
        statusMessage = `Toggle failed: ${err instanceof Error ? err.message : String(err)}`;
        cached = undefined;
        tui.requestRender();
      } finally {
        loadingScope = false;
      }
    }

    return {
      render(width: number) {
        if (cached) return cached;
        const container = new Container();
        container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
        container.addChild(
          new Text(theme.fg("accent", theme.bold("Relay — continue foreign session"))),
        );
        container.addChild(new Text(tabBar()));
        const scopeLabel = projectScope ? "this project" : "all projects";
        container.addChild(
          new Text(
            theme.fg(
              "dim",
              `Scope: ${scopeLabel}  ·  Ctrl+P toggle scope  ·  ←/→ tabs`,
            ),
          ),
        );
        if (statusMessage) {
          container.addChild(new Text(theme.fg("warning", statusMessage)));
        }
        container.addChild(new Text(""));
        if (selectList) container.addChild(selectList);
        container.addChild(new Text(""));
        container.addChild(
          new Text(
            theme.fg(
              "dim",
              "↑↓ move · type filters list · enter resume · Ctrl+P scope · esc cancel",
            ),
          ),
        );
        container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
        cached = container.render(width);
        return cached;
      },
      invalidate() {
        cached = undefined;
      },
      handleInput(data: string) {
        if (matchesKey(data, Key.esc)) {
          done(null);
          return;
        }
        // Scope toggle — must not be a bare letter (conflicts with type-to-filter)
        if (matchesKey(data, Key.ctrl("p"))) {
          void toggleScope();
          return;
        }
        if (matchesKey(data, Key.left) || matchesKey(data, Key.shift("tab"))) {
          if (providerOrder.length > 1) {
            tabIndex = (tabIndex - 1 + providerOrder.length) % providerOrder.length;
            rebuildList();
          }
          return;
        }
        if (matchesKey(data, Key.right) || matchesKey(data, Key.tab)) {
          if (providerOrder.length > 1) {
            tabIndex = (tabIndex + 1) % providerOrder.length;
            rebuildList();
          }
          return;
        }
        selectList?.handleInput(data);
        cached = undefined;
        tui.requestRender();
      },
    };
  });
}
