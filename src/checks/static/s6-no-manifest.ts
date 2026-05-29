/**
 * S6 — Publisher security manifest absent.
 *
 * Info-level note for every server: no `/.well-known/mcp-security.json`
 * is being consulted yet. The manifest spec is a roadmap item; this
 * check exists so the report makes the upgrade path visible, and so
 * publishers that adopt the manifest later have a finding to clear.
 *
 * No network I/O is performed; this is a static observation that the
 * publisher-attested trust tier (Tier 3) is not yet in play.
 */

import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";

export const s6NoManifest: StaticCheck = (
  server: ServerSpec,
  ctx: CheckCtx,
): Finding[] => {
  const candidate = candidateOrigin(server, ctx);
  const evidence = candidate
    ? [`expected location (if adopted): ${candidate}/.well-known/mcp-security.json`]
    : ["no origin derivable from config or enrichments"];
  return [
    {
      id: "S6",
      severity: "info",
      server: server.name,
      title: "publisher security manifest not yet present",
      detail:
        "Identity here is observed (Tier 1/2) — not publisher-attested " +
        "(Tier 3). When publishers begin shipping signed manifests, this " +
        "finding clears and the server can be elevated.",
      remediation:
        "If you publish this server: see the manifest spec for the " +
        "`/.well-known/mcp-security.json` shape.",
      evidence,
    },
  ];
};

function candidateOrigin(server: ServerSpec, ctx: CheckCtx): string | undefined {
  if (server.url) {
    try {
      return new URL(server.url).origin;
    } catch {
      // fall through
    }
  }
  const enr = ctx.enrichments?.get(server.name)?.npm;
  if (enr?.homepage) {
    try {
      return new URL(enr.homepage).origin;
    } catch {
      // fall through
    }
  }
  if (enr?.repository) {
    const repo = enr.repository.replace(/^git\+/, "").replace(/\.git$/, "");
    try {
      return new URL(repo).origin;
    } catch {
      // fall through
    }
  }
  return undefined;
}
