/**
 * C3 — additionalDirectories grants beyond the obvious project scope.
 *
 * Claude Code by default operates within the launched directory.
 * `permissions.additionalDirectories` widens that reach. Adding `$HOME`,
 * `/`, `/etc`, etc. effectively removes the project boundary.
 */

import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ClientCapability, Finding } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

export const c3AdditionalDirs: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  const dirs = cap.permissions.additionalDirectories;
  if (dirs.length === 0) return [];
  const hits: { dir: string; reason: string }[] = [];
  for (const d of dirs) {
    let p: string;
    try {
      p = resolve(d);
    } catch {
      continue;
    }
    const reason = broadReason(p);
    if (reason) hits.push({ dir: p, reason });
  }
  if (hits.length === 0) return [];
  return [
    {
      id: "C3",
      severity: "high",
      server: capId(cap),
      title: "broad `additionalDirectories` grant",
      detail:
        "The agent is permitted to read/edit files outside the launched " +
        "project, in places that contain personal data or system config.",
      remediation: "Remove broad entries; grant only the directories you need.",
      evidence: hits.map((h) => `${h.dir} → ${h.reason}`),
    },
  ];
};

function broadReason(p: string): string | undefined {
  const home = homedir();
  if (p === "/") return "system root";
  if (p === home) return "user home";
  if (p === "/Users" || p === "/home") return "parent of all user homes";
  if (p === "/etc" || p === "/var" || p === "/usr") return "system directory";
  return undefined;
}
