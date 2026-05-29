/**
 * P5 — Filesystem server is scoped to a project-like directory.
 *
 * The mirror of S2. When a `@modelcontextprotocol/server-filesystem`
 * server takes path arg(s) that resolve below the user's home (e.g.
 * `~/code/myproj`) but are NOT the home itself or a system root, the
 * install is considered scoped and gets a positive flag.
 */

import { homedir } from "node:os";
import { resolve } from "node:path";
import type { PositiveFlag, ServerSpec } from "../../types.js";
import type { CheckCtx, PositiveCheck } from "../types.js";

const FS_PACKAGES = new Set<string>([
  "@modelcontextprotocol/server-filesystem",
]);

export const p5ScopedInstall: PositiveCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): PositiveFlag[] => {
  const pkg = server.packageHints?.npm;
  if (!pkg || !FS_PACKAGES.has(pkg) || !server.args) return [];

  const paths: string[] = [];
  let allScoped = true;
  for (const a of server.args) {
    if (a.startsWith("-")) continue;
    if (a === pkg) continue;
    let r: string;
    try {
      r = resolve(a);
    } catch {
      continue;
    }
    if (!isScopedBelowHome(r)) {
      allScoped = false;
      break;
    }
    paths.push(r);
  }
  if (!allScoped || paths.length === 0) return [];

  return [
    {
      id: "P5",
      server: server.name,
      label: "filesystem scope is narrow",
      detail: `roots: ${paths.join(", ")}`,
      signal: `fs-roots:${paths.length}-narrow`,
    },
  ];
};

function isScopedBelowHome(p: string): boolean {
  const home = homedir();
  if (p === home) return false;
  if (p === "/" || p === "/Users" || p === "/home") return false;
  if (p === "/etc" || p === "/var" || p === "/usr") return false;
  return p.startsWith(home + "/");
}
