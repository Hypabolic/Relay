import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

import { providerLabel } from "../providers/registry.js";
import type { RelayProvenanceData } from "../types.js";
import { RELAY_PROVENANCE_TYPE } from "../types.js";

export function registerProvenanceRenderer(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<RelayProvenanceData>(RELAY_PROVENANCE_TYPE, (entry, _opts, theme) => {
    const data = entry.data;
    if (!data) return new Text(theme.fg("dim", "Relay import"));
    const tool = providerLabel(data.provider);
    const title =
      data.title.length > 70 ? `${data.title.slice(0, 67)}…` : data.title;
    const lines = [
      theme.fg("accent", theme.bold("Relay import")),
      theme.fg("muted", `${tool} · ${title}`),
      theme.fg("dim", `id ${data.nativeId}`),
      theme.fg("dim", `archive ${data.archiveId}`),
    ];
    return new Text(lines.join("\n"));
  });
}
