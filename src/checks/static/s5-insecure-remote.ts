/**
 * S5 — Insecure or unverifiable remote endpoint.
 *
 *   - `http://` (non-TLS) → medium. Tokens and traffic flow in clear.
 *   - Raw IP host or `localhost` / loopback → info. Sometimes intentional
 *     (a local server), but it bypasses DNS+TLS identity entirely, so
 *     it's worth surfacing.
 */

import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";

export const s5InsecureRemote: StaticCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): Finding[] => {
  if (!server.url) return [];
  let u: URL;
  try {
    u = new URL(server.url);
  } catch {
    return [
      {
        id: "S5",
        severity: "medium",
        server: server.name,
        title: "remote URL is not parseable",
        detail: "The configured URL did not parse as a valid URL.",
        remediation: "Fix the `url` field in the MCP config.",
        evidence: [`url: ${server.url}`],
      },
    ];
  }

  if (u.protocol === "http:") {
    return [
      {
        id: "S5",
        severity: "medium",
        server: server.name,
        title: "remote endpoint uses plaintext http://",
        detail:
          "Bearer tokens and tool payloads cross the network unencrypted. " +
          "Any on-path observer reads (and can replay) them.",
        remediation:
          "Use https:// for any non-loopback endpoint. If the upstream " +
          "lacks TLS, terminate it in a local reverse proxy.",
        evidence: [`scheme: http  ·  host: ${u.host}`],
      },
    ];
  }

  if (isLoopbackOrIp(u.hostname)) {
    return [
      {
        id: "S5",
        severity: "info",
        server: server.name,
        title: "remote uses raw IP or loopback host",
        detail:
          "The endpoint identifies by IP/loopback, so DNS + TLS identity " +
          "verification is effectively bypassed. Intentional for local " +
          "dev servers; worth confirming for anything else.",
        remediation:
          "If this is a production endpoint, give it a DNS name with " +
          "TLS; if it's local dev, ignore this finding.",
        evidence: [`host: ${u.hostname}`],
      },
    ];
  }

  return [];
};

function isLoopbackOrIp(host: string): boolean {
  if (host === "localhost") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (host === "::1" || host.startsWith("[")) return true;
  return false;
}
