/**
 * CC2 — Inline API key in the client settings file.
 *
 * Cursor lets users paste an API key directly into settings.json (e.g.
 * `cursor.composer.openAIApiKey`). That key sits in plaintext in a
 * file most clients sync to the cloud. Comparable to the S1 secret
 * detection on MCP env, but the surface is the client settings.
 *
 * v0.1 looks at a fixed list of known sensitive Cursor keys and
 * promotes the finding when the value looks like a credential (longer
 * than a few characters, not the empty string, not the literal
 * "REPLACE_ME"-style placeholders).
 */

import type { ClientCapability, Finding } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

const SENSITIVE_KEYS = [
  "cursor.composer.openAIApiKey",
  "cursor.composer.openaiApiKey",
  "cursor.composer.anthropicApiKey",
  "cursor.openAIApiKey",
  "cursor.apiKey",
];

const PLACEHOLDER = /^(?:replace[_-]?me|your[_-]?key|<.*>|x{6,})$/i;

export const cc2InlineApiKey: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  const hits: { key: string; redacted: string }[] = [];
  for (const k of SENSITIVE_KEYS) {
    const v = cap.extras[k];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed.length < 8) continue;
    if (PLACEHOLDER.test(trimmed)) continue;
    hits.push({ key: k, redacted: redact(trimmed) });
  }
  if (hits.length === 0) return [];
  return [
    {
      id: "CC2",
      severity: "high",
      server: capId(cap),
      title: "API key stored inline in client settings",
      detail:
        "Client settings files are routinely synced across machines " +
        "(VS Code-style settings sync, dotfile repos). A key here travels " +
        "to every place that file is mirrored.",
      remediation:
        "Move the key into the OS keychain or an env var, and clear the " +
        "field in settings.",
      evidence: hits.map((h) => `${h.key} = ${h.redacted}  ·  ${cap.configPath}`),
    },
  ];
};

function redact(s: string): string {
  if (s.length <= 12) return s.slice(0, 3) + "…";
  return s.slice(0, 6) + "…" + s.slice(-4);
}
