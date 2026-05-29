/**
 * S1 — Secrets in config + insecure file permissions.
 *
 * Detects two distinct risks against a single finding ID:
 *
 *   (a) Specific high-confidence token patterns embedded in env values
 *       or command-line args (GitHub PAT, AWS access key, OpenAI/Stripe/
 *       Anthropic/Slack/Google API keys, JWT, DSN with embedded password).
 *       Severity: critical.
 *
 *   (b) The config file itself is readable by group or other (octal mode
 *       has any non-owner read bit). Severity: high when (a) is also
 *       present, medium otherwise — a writable config is always bad, but
 *       the urgency multiplies when there are real secrets inside.
 *
 * Patterns are explicit and conservative. False positives erode trust in
 * a security tool faster than a false negative, so we only flag known
 * formats. Entropy-based heuristics are deferred to a later sweep.
 */

import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";

interface TokenPattern {
  label: string;
  regex: RegExp;
}

const TOKEN_PATTERNS: TokenPattern[] = [
  { label: "GitHub PAT (classic)", regex: /\bghp_[A-Za-z0-9]{36}\b/ },
  { label: "GitHub PAT (fine-grained)", regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/ },
  { label: "GitHub OAuth token", regex: /\bgho_[A-Za-z0-9]{36}\b/ },
  { label: "GitHub user-to-server", regex: /\bghu_[A-Za-z0-9]{36}\b/ },
  { label: "GitHub server-to-server", regex: /\bghs_[A-Za-z0-9]{36}\b/ },
  { label: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "AWS temporary key", regex: /\bASIA[0-9A-Z]{16}\b/ },
  { label: "Stripe live secret", regex: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
  { label: "Stripe test secret", regex: /\bsk_test_[A-Za-z0-9]{20,}\b/ },
  { label: "OpenAI API key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { label: "Anthropic API key", regex: /\bsk-ant-(?:api03-)?[A-Za-z0-9_-]{50,}\b/ },
  { label: "Slack token", regex: /\bxox[abopr]-[A-Za-z0-9-]{10,}\b/ },
  { label: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: "JWT (compact)", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { label: "DSN with embedded password", regex: /\b\w+:\/\/[^/\s:@]+:[^@\s]+@[^/\s]+/ },
];

interface Hit {
  source: "env" | "args";
  key: string;
  label: string;
  redacted: string;
}

export const s1Secrets: StaticCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): Finding[] => {
  const hits = scan(server);
  const permsRisk = hasNonOwnerRead(server.configPerms);
  if (hits.length === 0 && !permsRisk) return [];

  const severity = hits.length > 0 ? "critical" : "medium";
  const titleParts: string[] = [];
  if (hits.length > 0) titleParts.push(`${hits.length} secret pattern(s) in config`);
  if (permsRisk) titleParts.push(`config file readable by group/other`);

  const evidence: string[] = [];
  for (const h of hits) {
    evidence.push(`${h.source}.${h.key} matches ${h.label}: ${h.redacted}`);
  }
  if (permsRisk) {
    evidence.push(`config file mode ${server.configPerms} (${server.configPath})`);
  }

  return [
    {
      id: "S1",
      severity,
      server: server.name,
      title: `secrets / insecure config — ${titleParts.join(", ")}`,
      detail:
        "Tokens visible in MCP configs reach every agent and tool that " +
        "reads them. World/group-readable config files expose those " +
        "tokens to any process on the machine.",
      remediation:
        "Move secrets out of MCP config into the system keychain or an " +
        "env file with mode 600; `chmod 600` the config file itself.",
      evidence,
    },
  ];
};

function scan(server: ServerSpec): Hit[] {
  const hits: Hit[] = [];
  if (server.env) {
    for (const [k, v] of Object.entries(server.env)) {
      for (const p of TOKEN_PATTERNS) {
        const m = p.regex.exec(v);
        if (m) hits.push({ source: "env", key: k, label: p.label, redacted: redact(m[0]) });
      }
    }
  }
  if (server.args) {
    for (let i = 0; i < server.args.length; i++) {
      const v = server.args[i]!;
      for (const p of TOKEN_PATTERNS) {
        const m = p.regex.exec(v);
        if (m) hits.push({ source: "args", key: String(i), label: p.label, redacted: redact(m[0]) });
      }
    }
  }
  return hits;
}

function redact(token: string): string {
  if (token.length <= 12) return token.slice(0, 3) + "…";
  return token.slice(0, 6) + "…" + token.slice(-4);
}

/** True when octal mode (e.g. "644") allows non-owner read. */
function hasNonOwnerRead(perms: string | undefined): boolean {
  if (!perms) return false;
  const m = /([0-7])([0-7])([0-7])$/.exec(perms);
  if (!m) return false;
  const group = parseInt(m[2]!, 8);
  const other = parseInt(m[3]!, 8);
  return (group & 0o4) !== 0 || (other & 0o4) !== 0;
}
