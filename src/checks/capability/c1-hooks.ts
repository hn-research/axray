/**
 * C1 — Hooks defined.
 *
 * Claude Code hooks run shell commands on lifecycle events
 * (PreToolUse / PostToolUse / UserPromptSubmit / Stop / etc.). Any hook
 * runs *whenever the user runs Claude Code in scope* — it's
 * essentially RCE under the user's account, gated only by whether the
 * user trusts what's in the settings file.
 *
 * Severity is graded by what the command does:
 *   - critical: pipes from the network into a shell (curl … | sh and
 *     friends), evals a string, or invokes another shell with -c on a
 *     fetched payload.
 *   - high:     any UserPromptSubmit / Stop hook (fires on every turn),
 *               or any hook that mentions curl/wget/eval/nc/bash -c.
 *   - medium:   any other PreToolUse / PostToolUse hook (still runs on
 *               your machine; worth surfacing).
 *
 * We never run the command — only pattern-match the string and report.
 */

import type { ClientCapability, Finding } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

const NETWORK_PIPE = /(?:curl|wget)\s+[^\n]*\s*\|\s*(?:sh|bash|zsh|node|python\d?)/i;
const EVAL_CALL = /\beval\s+|<\(\s*curl|<\(\s*wget/i;
const SHELL_C = /\b(?:sh|bash|zsh)\s+-c\b/;
const SUSPICIOUS_BIN = /\b(?:curl|wget|nc|netcat|ssh)\b/;
const ALWAYS_FIRES = new Set(["UserPromptSubmit", "Stop"]);

export const c1Hooks: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  if (cap.hooks.length === 0) return [];
  const subject = capId(cap);
  const out: Finding[] = [];
  for (const h of cap.hooks) {
    const severity = gradeHook(h.event, h.command);
    out.push({
      id: "C1",
      severity,
      server: subject,
      subject: h.event + (h.matcher ? ` (${h.matcher})` : ""),
      title: `${cap.client} hook executes on ${h.event}`,
      detail:
        "Hooks run as part of the client lifecycle. Whatever this " +
        "command does happens every time the event fires, without an " +
        "explicit prompt.",
      remediation:
        "Confirm the hook is intentional and read-only. Remove or " +
        "tighten if surprising.",
      evidence: [
        `event: ${h.event}${h.matcher ? `  matcher: ${h.matcher}` : ""}`,
        `command: ${truncate(h.command, 240)}`,
        `source: ${cap.configPath}`,
      ],
    });
  }
  return out;
};

function gradeHook(event: string, command: string): Finding["severity"] {
  if (NETWORK_PIPE.test(command)) return "critical";
  if (EVAL_CALL.test(command)) return "critical";
  if (ALWAYS_FIRES.has(event)) return "high";
  if (SHELL_C.test(command)) return "high";
  if (SUSPICIOUS_BIN.test(command)) return "high";
  return "medium";
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
