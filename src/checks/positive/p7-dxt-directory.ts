/**
 * P7 — Installed via Anthropic's Claude Desktop directory (DXT).
 *
 * DXT extensions are:
 *   - listed in Anthropic's directory (Settings → Extensions panel)
 *   - hash-recorded in `extensions-installations.json`, so the bytes
 *     on disk match what was published
 *   - subject to the local `extensions-blocklist.json` denylist
 *
 * This is meaningfully better than an arbitrary `npx -y <random-pkg>`
 * launch from a hand-edited config: there IS a curation gate and a
 * hash check. It is NOT a full security audit, so we label it
 * narrowly ("directory-installed") and avoid words like "verified"
 * or "trusted." The user can still go look at the source repo.
 *
 * Detection: ServerSpec.scope begins with "extension:" when the
 * discovery layer surfaced it from `extensions-installations.json`.
 */

import type { PositiveFlag, ServerSpec } from "../../types.js";
import type { CheckCtx, PositiveCheck } from "../types.js";

export const p7DxtDirectory: PositiveCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): PositiveFlag[] => {
  if (!server.scope || !server.scope.startsWith("extension:")) return [];
  const id = server.scope.slice("extension:".length);
  return [
    {
      id: "P7",
      server: server.name,
      label: "directory-installed",
      detail:
        "installed via Claude Desktop's Extensions panel; hash-recorded " +
        "and checked against Anthropic's blocklist on launch.",
      signal: `dxt:${id}`,
    },
  ];
};
