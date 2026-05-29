/**
 * S2 — Over-broad filesystem root for a filesystem-type server.
 *
 * The official `@modelcontextprotocol/server-filesystem` (and lookalike
 * forks) take the allowed root path(s) as positional arguments. When the
 * root is the user's home, the parent of all users, or the system root,
 * the server exposes the entire personal or machine surface to the agent
 * — including arbitrary write/delete via its mutating tools.
 *
 * Heuristic: any positional path arg that resolves to one of the broad
 * roots flags the server.
 */

import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";

const FS_PACKAGES = new Set<string>([
  "@modelcontextprotocol/server-filesystem",
]);

export const s2FilesystemRoot: StaticCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): Finding[] => {
  const pkg = server.packageHints?.npm;
  if (!pkg || !FS_PACKAGES.has(pkg)) return [];
  if (!server.args || server.args.length === 0) return [];

  const broadHits: { arg: string; reason: string }[] = [];
  for (const a of server.args) {
    if (a.startsWith("-")) continue;
    if (a === pkg) continue;
    const reason = broadRootReason(a);
    if (reason) broadHits.push({ arg: a, reason });
  }
  if (broadHits.length === 0) return [];

  return [
    {
      id: "S2",
      severity: "high",
      server: server.name,
      title: "filesystem server granted over-broad root",
      detail:
        "A filesystem MCP server can read, write, and delete anything " +
        "under its allowed roots. Granting the whole home dir or the " +
        "system root makes that surface effectively unbounded.",
      remediation:
        "Scope the server to a specific project directory (e.g. " +
        "/Users/<you>/code/<project>) and run a second instance per " +
        "project if needed.",
      evidence: broadHits.map((h) => `arg "${h.arg}" → ${h.reason}`),
    },
  ];
};

function broadRootReason(arg: string): string | undefined {
  let p: string;
  try {
    p = resolve(arg);
  } catch {
    return undefined;
  }
  const home = homedir();
  if (p === "/") return "system root";
  if (p === home) return "user home directory";
  if (p === "/Users" || p === "/home") return "parent of all user homes";
  if (p === "/etc" || p === "/var" || p === "/usr") return "system directory";
  return undefined;
}
