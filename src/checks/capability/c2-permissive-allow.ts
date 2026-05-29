/**
 * C2 — Permissive tool allowlists.
 *
 * Claude Code's `permissions.allow` controls which tool invocations
 * run without an interactive confirmation. Broad patterns turn the
 * "the user confirms each shell command" safety property into "Claude
 * runs whatever it wants under this matcher."
 *
 * High-risk patterns:
 *   - `Bash` (no parens) or `Bash(*)`         → blanket shell access
 *   - `Bash(curl:*)` / `Bash(wget:*)` / etc.  → unrestricted egress
 *   - `Bash(sudo:*)`                          → privilege escalation
 *
 * Medium-risk patterns:
 *   - `Read(*)` / `Write(*)` / `Edit(*)`      → unscoped fs surface
 *   - any pattern wider than the user likely intended
 */

import type { ClientCapability, Finding } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

interface Hit {
  pattern: string;
  reason: string;
  severity: Finding["severity"];
}

export const c2PermissiveAllow: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  const allow = cap.permissions.allow;
  if (allow.length === 0) return [];
  const hits: Hit[] = [];
  for (const p of allow) {
    const hit = classify(p);
    if (hit) hits.push(hit);
  }
  if (hits.length === 0) return [];

  const top = worst(hits.map((h) => h.severity));
  return [
    {
      id: "C2",
      severity: top,
      server: capId(cap),
      title: "permissive tool allowlist",
      detail:
        "Allowlisted patterns run without a confirmation prompt. Broad " +
        "matchers undo the per-invocation safety check.",
      remediation:
        "Replace blanket patterns with the specific commands you actually " +
        "want pre-approved (e.g. `Bash(npm:*)` instead of `Bash`).",
      evidence: hits.map((h) => `${h.pattern} → ${h.reason}`),
    },
  ];
};

function classify(pattern: string): Hit | undefined {
  // Bash blanket
  if (pattern === "Bash" || pattern === "Bash(*)" || pattern === "Bash(*:*)") {
    return { pattern, reason: "blanket shell access", severity: "high" };
  }
  if (/^Bash\(\s*(?:curl|wget|nc|netcat|ssh|scp|sudo|sh|bash)\b/i.test(pattern)) {
    return { pattern, reason: "broad/escalating shell binary", severity: "high" };
  }
  // Read/Write/Edit blankets
  if (/^(?:Read|Write|Edit|MultiEdit|NotebookEdit)\(\s*\*?\s*\)$/.test(pattern)) {
    return { pattern, reason: "unscoped filesystem surface", severity: "medium" };
  }
  if (pattern === "Read" || pattern === "Write" || pattern === "Edit") {
    return { pattern, reason: "tool-wide allow with no scope", severity: "medium" };
  }
  // WebFetch/Bash with broad URL glob
  if (/^WebFetch\(.*\*/.test(pattern)) {
    return { pattern, reason: "broad web egress", severity: "medium" };
  }
  return undefined;
}

function worst(severities: Finding["severity"][]): Finding["severity"] {
  const order: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];
  for (const s of order) if (severities.includes(s)) return s;
  return "info";
}
