/**
 * CC1 — Instruction-file (rules) content review.
 *
 * Rules files (Cursor `.cursorrules`, `.cursor/rules/*.mdc`, and similar)
 * are fed to the model as system-prompt context. Anything in them
 * influences how the agent behaves — including malicious instructions
 * that ask the agent to exfiltrate files, ignore prior context, or
 * fetch a payload.
 *
 * Severity is graded by what was matched:
 *   - critical: clear exfiltration patterns (e.g. "read ~/.ssh", "send
 *     to https://", "exfil", "POST to <url>"), or instructions that
 *     pipe a network fetch into a shell.
 *   - high:     "ignore previous", "always then", classic prompt-
 *     injection hooks; or hidden / zero-width unicode in the content.
 *   - info:     a non-empty rules file exists and ships with the
 *     project — read it before you trust it.
 *
 * False positives erode trust, so the heuristic is conservative.
 */

import type { ClientCapability, Finding, RuleSpec } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

const EXFIL = /\b(?:read|cat|open|less|head|tail|grep)\s+\S*\.(?:ssh|aws|kube|gnupg|netrc|password|env|config)\b/i;
const NETWORK_POST = /\b(?:POST|send|upload|exfil(?:trat)?e)\b[^\n]{0,40}\bhttps?:\/\//i;
const PIPE_NET_TO_SHELL = /(?:curl|wget)\s+[^\n]+\|\s*(?:sh|bash|zsh)/i;
const INJECT_HOOK = /\b(?:ignore (?:all )?previous|disregard (?:all )?prior|always (?:then|first|next))\b/i;
const HIDDEN_UNICODE = /[​-‏‪-‮⁠-⁯]/;

export const cc1RulesContent: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  const rules = cap.rules ?? [];
  if (rules.length === 0) return [];

  const out: Finding[] = [];
  for (const r of rules) {
    const hits = scanRule(r);
    if (hits.length === 0) {
      out.push({
        id: "CC1",
        severity: "info",
        server: capId(cap),
        subject: shortRulePath(r.path, cap.projectRoot),
        title: "agent instruction file present",
        detail:
          "This file is loaded as agent context. Anything written here " +
          "influences the agent's behavior across the project.",
        remediation:
          "Read the file before opening this project; treat shipped " +
          "instruction files as code.",
        evidence: [`path: ${r.path}`, `bytes: ${r.bytes}`],
      });
      continue;
    }
    const severity = worstSeverity(hits.map((h) => h.severity));
    out.push({
      id: "CC1",
      severity,
      server: capId(cap),
      subject: shortRulePath(r.path, cap.projectRoot),
      title: "agent instruction file contains suspicious patterns",
      detail:
        "Instruction files are fed to the model as prompt context. " +
        "Patterns like these are the standard vector for prompt-" +
        "injection attacks against tool-using agents.",
      remediation:
        "Read the file and remove the matched patterns, or quarantine " +
        "the project before running an agent in it.",
      evidence: hits.map((h) => `${h.label}: ${h.snippet}`),
    });
  }
  return out;
};

interface Hit {
  label: string;
  snippet: string;
  severity: Finding["severity"];
}

function scanRule(r: RuleSpec): Hit[] {
  const hits: Hit[] = [];
  const c = r.content;

  pushIf(hits, EXFIL.exec(c), "exfiltration pattern", "critical");
  pushIf(hits, NETWORK_POST.exec(c), "network exfil instruction", "critical");
  pushIf(hits, PIPE_NET_TO_SHELL.exec(c), "fetch piped to shell", "critical");
  pushIf(hits, INJECT_HOOK.exec(c), "classic prompt-injection phrasing", "high");
  if (HIDDEN_UNICODE.test(c)) {
    hits.push({
      label: "hidden / zero-width unicode in instructions",
      snippet: "(invisible characters)",
      severity: "high",
    });
  }
  return hits;
}

function pushIf(
  acc: Hit[],
  m: RegExpExecArray | null,
  label: string,
  severity: Finding["severity"],
): void {
  if (!m) return;
  const ctxStart = Math.max(0, m.index - 16);
  const ctxEnd = Math.min(m.input.length, m.index + m[0].length + 16);
  acc.push({
    label,
    snippet: `…${m.input.slice(ctxStart, ctxEnd).replace(/\s+/g, " ").trim()}…`,
    severity,
  });
}

function worstSeverity(s: Finding["severity"][]): Finding["severity"] {
  const order: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];
  for (const sev of order) if (s.includes(sev)) return sev;
  return "info";
}

function shortRulePath(p: string, root?: string): string {
  if (root && p.startsWith(root + "/")) return p.slice(root.length + 1);
  return p;
}
