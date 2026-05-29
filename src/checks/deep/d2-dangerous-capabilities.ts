/**
 * D2 — Dangerous capability surface (tools the agent can call).
 *
 * Classifies each exposed tool by its name + description into one or
 * more capability buckets:
 *
 *   exec       — runs a shell command, arbitrary process, code eval
 *   fs-write   — writes / deletes / moves files
 *   network    — fetches URLs, sends requests
 *   credential — reads or writes secrets / tokens / keys
 *
 * v0.1 emits one D2 finding per server with all matched tools grouped.
 * Severity is `high` whenever any exec or credential-touching tool is
 * present, otherwise `medium`. The point isn't that these tools are
 * "bad" — most are intentional — but that the user is meant to know
 * what surface their agent has at hand.
 */

import type { Finding, ServerSpec, ToolInfo } from "../../types.js";
import type { DeepCheck } from "./types.js";

type Bucket = "exec" | "fs-write" | "network" | "credential";

const PATTERNS: { bucket: Bucket; regex: RegExp }[] = [
  { bucket: "exec", regex: /\b(?:exec|shell|run[_-]?command|run[_-]?cmd|spawn|eval|script|sudo|kill|terminate)\b/i },
  { bucket: "fs-write", regex: /\b(?:write|delete|remove|rm|mv|move|unlink|drop[_-]?table|truncate|chmod|chown)[_-]?(?:file|dir|directory|table)?\b/i },
  { bucket: "network", regex: /\b(?:fetch|request|http_?(?:get|post|put|delete)|curl|wget|webhook|send_?(?:mail|message)|post)\b/i },
  { bucket: "credential", regex: /\b(?:secret|password|token|api[_-]?key|credential|signin|keyring|keychain)\b/i },
];

export const d2DangerousCapabilities: DeepCheck = (
  server: ServerSpec,
  tools: ToolInfo[],
): Finding[] => {
  if (tools.length === 0) return [];
  const byBucket = new Map<Bucket, string[]>();
  for (const t of tools) {
    const haystack = `${t.name} ${t.description ?? ""}`;
    for (const p of PATTERNS) {
      if (p.regex.test(haystack)) {
        const list = byBucket.get(p.bucket) ?? [];
        if (!list.includes(t.name)) list.push(t.name);
        byBucket.set(p.bucket, list);
      }
    }
  }
  if (byBucket.size === 0) return [];

  const severity: Finding["severity"] =
    byBucket.has("exec") || byBucket.has("credential") ? "high" : "medium";

  const evidence: string[] = [];
  for (const b of ["exec", "fs-write", "network", "credential"] as Bucket[]) {
    const list = byBucket.get(b);
    if (!list || list.length === 0) continue;
    evidence.push(`${b}: ${list.join(", ")}`);
  }

  return [
    {
      id: "D2",
      severity,
      server: server.name,
      title: "agent has access to powerful tool capabilities",
      detail:
        "These tools, once allowed, let the agent shell out, modify the " +
        "filesystem, reach the network, or touch credentials. Knowing what " +
        "exactly is available is the precondition for sensible scoping.",
      remediation:
        "If any of these aren't actually needed by the agent for this " +
        "workflow, remove or disable them at the server.",
      evidence,
    },
  ];
};
