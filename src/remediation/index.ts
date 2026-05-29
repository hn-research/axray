/**
 * Public remediation API.
 *
 * Given a Finding (and optionally the ServerSpec it came from), return
 * an expanded remediation block:
 *   - the per-check template, with `${...}` variables resolved
 *   - any safer-mode hints derived from the server's user_config
 *
 * Used by the `--how-to-fix` renderer in cli.ts.
 */

import type { Finding, ServerSpec } from "../types.js";
import { findSaferModeHints, type SaferModeHint } from "./safer-mode-hints.js";
import { TEMPLATES, type RemediationTemplate } from "./templates.js";

export interface ExpandedRemediation {
  fix: string;
  verify?: string;
  saferMode: SaferModeHint[];
}

export function buildRemediation(
  finding: Finding,
  server: ServerSpec | undefined,
): ExpandedRemediation | undefined {
  const template = TEMPLATES[finding.id];
  if (!template) return undefined;
  const vars = collectVariables(finding, server);
  const out: ExpandedRemediation = {
    fix: interpolate(template.fix, vars),
    saferMode: server ? findSaferModeHints(finding.id, server.userConfigKeys) : [],
  };
  if (template.verify) out.verify = interpolate(template.verify, vars);
  return out;
}

function collectVariables(
  finding: Finding,
  server: ServerSpec | undefined,
): Record<string, string> {
  const v: Record<string, string> = {
    server: finding.server,
    findingId: finding.id,
  };
  if (finding.subject) v.tool = finding.subject;
  if (server) {
    if (server.configPath) v.configPath = server.configPath;
    if (server.packageHints?.npm) v.npmName = server.packageHints.npm;
    if (server.scope?.startsWith("extension:")) {
      v.extensionDir = `~/Library/Application Support/Claude/Claude Extensions/${server.scope.slice("extension:".length)}`;
    }
  }
  // Rules-file checks (CC1) carry the rule path in evidence; pull it out.
  if (finding.id === "CC1") {
    const pathEvidence = finding.evidence.find((e) => /^path:\s/.test(e));
    if (pathEvidence) v.rulePath = pathEvidence.replace(/^path:\s*/, "");
  }
  // apiKeyHelper check carries the helper command in evidence.
  if (finding.id === "C5") {
    const cmdEvidence = finding.evidence.find((e) => /^command:\s/.test(e));
    if (cmdEvidence) v.apiKeyHelper = cmdEvidence.replace(/^command:\s*/, "");
  }
  return v;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : `<${key}>`,
  );
}

export type { RemediationTemplate, SaferModeHint };
