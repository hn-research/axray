/**
 * C5 — apiKeyHelper executes a shell command.
 *
 * `apiKeyHelper` is invoked by the client every time it needs the API
 * key. Almost always benign (a keychain query), occasionally a leak
 * vector (a curl to a logging service, a `cat ~/.config/secret`).
 * Always worth surfacing the literal command in the report.
 */

import type { ClientCapability, Finding } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

const NETWORK_PIPE = /(?:curl|wget)\s+[^\n]*\s*\|\s*(?:sh|bash|zsh|node|python\d?)/i;

export const c5ApiKeyHelper: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  const helper = cap.apiKeyHelper;
  if (!helper) return [];
  const severity: Finding["severity"] = NETWORK_PIPE.test(helper)
    ? "critical"
    : "info";
  return [
    {
      id: "C5",
      severity,
      server: capId(cap),
      title: "apiKeyHelper runs a shell command",
      detail:
        "Every API-key fetch invokes this command. If it does anything " +
        "more than read a credential from a keychain, that's worth knowing.",
      remediation:
        "Confirm the command is what you expected. Prefer a system " +
        "keychain query (`security find-generic-password …` on macOS) " +
        "over arbitrary scripts.",
      evidence: [`command: ${helper}`, `source: ${cap.configPath}`],
    },
  ];
};
