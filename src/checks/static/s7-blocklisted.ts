/**
 * S7 — Installed extension is on the vendor blocklist.
 *
 * Some agent clients publish a denylist of extensions known to be
 * compromised, vulnerable, or otherwise actively undesirable. Claude
 * Desktop ships `extensions-blocklist.json`; the discovery layer
 * matches each installed DXT extension's id against the aggregated
 * entries and attaches the source to `server.blocklistedBy` when it
 * fires.
 *
 * Severity is `critical` regardless of source. An entry on a vendor
 * blocklist isn't a soft signal — the vendor has actively published
 * "do not run this." Even if the client UI disables the extension at
 * runtime, the code is unpacked on disk and the user should remove it.
 */

import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";

export const s7Blocklisted: StaticCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): Finding[] => {
  if (!server.blocklistedBy) return [];
  const evidence: string[] = [`blocklisted by: ${server.blocklistedBy.source}`];
  if (server.blocklistedBy.ref) {
    evidence.push(`source ref: ${server.blocklistedBy.ref}`);
  }
  if (server.scope) evidence.push(`extension id: ${server.scope.replace(/^extension:/, "")}`);
  return [
    {
      id: "S7",
      severity: "critical",
      server: server.name,
      title: "installed extension is on the vendor blocklist",
      detail:
        "The vendor has explicitly flagged this extension. Even if the " +
        "client disables it at runtime, the unpacked code is still on " +
        "disk and the install footprint should be removed.",
      remediation:
        "Uninstall the extension from the client's Extensions panel, " +
        "then delete its install directory if anything remains.",
      evidence,
    },
  ];
};
