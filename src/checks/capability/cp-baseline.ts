/**
 * Positive flags for the capability surface — the discover/attest side
 * of the dual framing.
 *
 *   CP1 — baseline clean: 0 hooks, 0 permissive allow patterns, 0 broad
 *         additional directories. The install is at the conservative
 *         end of Claude Code's permission spectrum.
 *   CP2 — owner-only config perms (mode 6xx with no group/other read).
 */

import type {
  ClientCapability,
  PositiveFlag,
} from "../../types.js";
import type { CapabilityPositive } from "./types.js";
import { capId } from "./types.js";

export const cp1Baseline: CapabilityPositive = (
  cap: ClientCapability,
): PositiveFlag[] => {
  const hooks = cap.hooks.length;
  const allow = cap.permissions.allow.length;
  const dirs = cap.permissions.additionalDirectories.length;
  if (hooks > 0 || allow > 0 || dirs > 0) return [];
  return [
    {
      id: "CP1",
      server: capId(cap),
      label: "no hooks / no perm grants",
      detail: "hooks empty, allow list empty, additionalDirectories empty.",
      signal: "hooks=0;allow=0;dirs=0",
    },
  ];
};

export const cp2OwnerOnly: CapabilityPositive = (
  cap: ClientCapability,
): PositiveFlag[] => {
  const perms = cap.configPerms;
  if (!perms) return [];
  const m = /([0-7])([0-7])([0-7])$/.exec(perms);
  if (!m) return [];
  const group = parseInt(m[2]!, 8);
  const other = parseInt(m[3]!, 8);
  if ((group & 0o4) !== 0 || (other & 0o4) !== 0) return [];
  return [
    {
      id: "CP2",
      server: capId(cap),
      label: "config is owner-only",
      detail: `mode ${perms} — no group/other read.`,
      signal: `mode=${perms}`,
    },
  ];
};
