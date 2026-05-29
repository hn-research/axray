/**
 * S4 — Supply-chain risk in how the package is installed.
 *
 * Flags two distinct shapes:
 *
 *   - npx (or npm exec) launching an UNPINNED registry package — the
 *     server you get tomorrow may not be the server you got today. A
 *     compromised maintainer push silently changes what your agent
 *     runs.
 *   - npx launching a non-registry source: `github:user/repo`, a raw
 *     git URL, or a filesystem path. These bypass the registry entirely;
 *     there's no version, no signed publish, and the author identity
 *     comes from VCS hosting at best.
 */

import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";

export const s4SupplyChain: StaticCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): Finding[] => {
  if (!server.command) return [];
  const base = baseCommand(server.command);
  if (base !== "npx" && base !== "npm") return [];
  const args = server.args ?? [];
  const spec = positionalPackageSpec(base, args);
  if (!spec) return [];

  const nonRegistry = isNonRegistrySpec(spec);
  if (nonRegistry) {
    return [
      {
        id: "S4",
        severity: "medium",
        server: server.name,
        title: "package installed from a non-registry source",
        detail:
          "Non-registry installs (git URLs, github: shorthand, filesystem " +
          "paths) bypass npm's publish path. There's no version pin and " +
          "no signed provenance.",
        remediation:
          "Publish a pinned version to a registry, or replace the launcher " +
          "with a checked-in script that pins the commit/tag.",
        evidence: [`launch spec: ${spec}`],
      },
    ];
  }

  if (!hasVersionPin(spec)) {
    return [
      {
        id: "S4",
        severity: "medium",
        server: server.name,
        title: "package not version-pinned",
        detail:
          "`npx -y <pkg>` resolves to whatever is published right now. A " +
          "compromised maintainer push, or just an unintended breaking " +
          "release, will run inside your agent client without warning.",
        remediation: `Pin a version, e.g. \`${base === "npm" ? "npm exec" : "npx"} ${spec}@<version>\`.`,
        evidence: [`unpinned package: ${spec}`],
      },
    ];
  }

  return [];
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

function isNonRegistrySpec(spec: string): boolean {
  if (spec.startsWith("github:")) return true;
  if (spec.startsWith("git+")) return true;
  if (/^https?:\/\//.test(spec)) return true;
  if (spec.startsWith("file:")) return true;
  if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) {
    return true;
  }
  return false;
}

function hasVersionPin(spec: string): boolean {
  if (spec.startsWith("@")) {
    const sep = spec.indexOf("@", 1);
    return sep > 0;
  }
  return spec.includes("@");
}
