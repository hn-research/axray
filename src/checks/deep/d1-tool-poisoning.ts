/**
 * D1 — Tool-description poisoning.
 *
 * MCP tool descriptions are fed verbatim to the model as context. An
 * attacker who controls a server (or who can submit a PR that lands in
 * a server) can place instructions inside the description that the
 * agent will then follow when picking or invoking tools. This is the
 * MCP-side mirror of CC1 (which scans rule-file content); the patterns
 * are the same class, the surface differs.
 *
 * Severity grading mirrors CC1:
 *   critical — exfiltration commands, network-pipe-to-shell, network
 *              POST instructions
 *   high     — classic prompt-injection phrasing or hidden / zero-width
 *              unicode in the description
 *   (not graded lower — if it's clearly something we don't want in a
 *   description, it's high-or-better.)
 *
 * Conservative regexes only; false positives erode trust faster than
 * false negatives in a tool people run on their own machine.
 */

import type { Finding, ServerSpec, ToolInfo } from "../../types.js";
import type { DeepCheck } from "./types.js";

const EXFIL = /\b(?:read|cat|open|less|head|tail|grep)\s+\S*\.(?:ssh|aws|kube|gnupg|netrc|password|env|config)\b/i;
const NETWORK_POST = /\b(?:POST|send|upload|exfil(?:trat)?e)\b[^\n]{0,40}\bhttps?:\/\//i;
const PIPE_NET_TO_SHELL = /(?:curl|wget)\s+[^\n]+\|\s*(?:sh|bash|zsh)/i;
const INJECT_HOOK = /\b(?:ignore (?:all )?previous|disregard (?:all )?prior|always (?:then|first|next))\b/i;
const HIDDEN_UNICODE = /[​-‏‪-‮⁠-⁯]/;

interface Hit {
  label: string;
  snippet: string;
  severity: Finding["severity"];
}

export const d1ToolPoisoning: DeepCheck = (
  server: ServerSpec,
  tools: ToolInfo[],
): Finding[] => {
  const out: Finding[] = [];
  for (const t of tools) {
    const hits = scan(t.description ?? "");
    if (hits.length === 0) continue;
    const severity = worstSeverity(hits.map((h) => h.severity));
    out.push({
      id: "D1",
      severity,
      server: server.name,
      subject: t.name,
      title: "tool description contains suspicious patterns",
      detail:
        "Tool descriptions are model-visible context. Instructions or " +
        "exfiltration patterns placed here are a known supply-chain " +
        "vector against tool-using agents.",
      remediation:
        "Quarantine this server. Compare the description against the " +
        "package's source on its repo; if the registry copy differs, " +
        "open an issue and pin to a known-good version.",
      evidence: hits.map((h) => `${h.label}: ${h.snippet}`),
    });
  }
  return out;
};

function scan(text: string): Hit[] {
  const hits: Hit[] = [];
  pushIf(hits, EXFIL.exec(text), "exfiltration pattern", "critical");
  pushIf(hits, NETWORK_POST.exec(text), "network exfil instruction", "critical");
  pushIf(hits, PIPE_NET_TO_SHELL.exec(text), "fetch piped to shell", "critical");
  pushIf(hits, INJECT_HOOK.exec(text), "classic prompt-injection phrasing", "high");
  if (HIDDEN_UNICODE.test(text)) {
    hits.push({
      label: "hidden / zero-width unicode in description",
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
  const start = Math.max(0, m.index - 16);
  const end = Math.min(m.input.length, m.index + m[0].length + 16);
  acc.push({
    label,
    snippet: `…${m.input.slice(start, end).replace(/\s+/g, " ").trim()}…`,
    severity,
  });
}

function worstSeverity(s: Finding["severity"][]): Finding["severity"] {
  const order: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];
  for (const sev of order) if (s.includes(sev)) return sev;
  return "info";
}
