/**
 * P3 — Package version is pinned in the launch command AND that pinned
 * version is among the most recent releases.
 *
 * "Pinned" means the package spec carries an explicit `@version`
 * (`@scope/pkg@1.2.3` or `pkg@1.2.3`), so a registry republish or
 * compromise can't silently change what runs.
 *
 * "Current" means the pin is within the latest N versions in registry
 * order — pinned-but-ancient still gets P3 (the pin is the safety
 * property), but the detail string distinguishes the two so the report
 * can call out stale pins.
 */

import type { PositiveFlag, ServerSpec } from "../../types.js";
import type { CheckCtx, PositiveCheck } from "../types.js";

const CURRENT_WINDOW = 5;

export const p3Pinned: PositiveCheck = (
  server: ServerSpec,
  ctx: CheckCtx,
): PositiveFlag[] => {
  if (!server.command || !server.args) return [];
  const base = baseCommand(server.command);
  if (base !== "npx" && base !== "npm") return [];

  const spec = positionalPackageSpec(base, server.args);
  if (!spec) return [];
  const pinned = extractVersion(spec);
  if (!pinned) return [];

  const npm = ctx.enrichments?.get(server.name)?.npm;
  const versions = npm?.versions ?? [];
  const recent = versions.slice(-CURRENT_WINDOW);
  const isCurrent = recent.includes(pinned);
  const detail = isCurrent
    ? `pinned to ${pinned}; in last ${CURRENT_WINDOW} releases.`
    : `pinned to ${pinned}; current latest is ${npm?.latest ?? "unknown"}.`;

  return [
    {
      id: "P3",
      server: server.name,
      label: isCurrent ? "version pinned (current)" : "version pinned (stale)",
      detail,
      signal: `pin:${pinned}${isCurrent ? ":current" : ":stale"}`,
    },
  ];
};

function baseCommand(cmd: string): string {
  const slash = cmd.lastIndexOf("/");
  return (slash >= 0 ? cmd.slice(slash + 1) : cmd).trim();
}

function positionalPackageSpec(
  base: string,
  args: string[],
): string | undefined {
  let i = base === "npm" && args[0] === "exec" ? 1 : 0;
  while (i < args.length) {
    const t = args[i]!;
    if (t === "--") {
      i++;
      break;
    }
    if (t.startsWith("-")) {
      i++;
      continue;
    }
    break;
  }
  return args[i];
}

function extractVersion(spec: string): string | undefined {
  if (spec.startsWith("@")) {
    const sep = spec.indexOf("@", 1);
    if (sep < 0) return undefined;
    return spec.slice(sep + 1) || undefined;
  }
  const sep = spec.indexOf("@");
  if (sep < 0) return undefined;
  return spec.slice(sep + 1) || undefined;
}
