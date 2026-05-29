/**
 * S3 — Dangerous launch command.
 *
 * Flags stdio launches that aren't a normal package-manager invocation:
 *
 *   - shell wrappers (sh/bash/zsh) with `-c` and an arbitrary command
 *     string. These can do anything; the MCP server they ostensibly
 *     start is incidental.
 *   - `sudo` in the launch chain (privilege escalation as a side-effect
 *     of opening an agent client).
 *   - `docker run` (or `podman run`) with bind mounts (`-v` / `--mount`),
 *     which extend the container's reach back into the host filesystem.
 */

import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";

export const s3DangerousLaunch: StaticCheck = (
  server: ServerSpec,
  _ctx: CheckCtx,
): Finding[] => {
  if (!server.command) return [];
  const cmd = server.command;
  const args = server.args ?? [];
  const evidence: string[] = [];

  const base = baseCommand(cmd);
  if (SHELLS.has(base) && args.includes("-c")) {
    evidence.push(`shell wrapper: ${cmd} -c <arbitrary command>`);
  }
  if (base === "sudo") {
    evidence.push("launch uses sudo");
  }
  if ((base === "docker" || base === "podman") && args[0] === "run") {
    const hasMount = args.some(
      (a, i) =>
        a === "-v" || a === "--mount" || (a.startsWith("--mount=") && i >= 0),
    );
    if (hasMount) {
      evidence.push(
        `${base} run with bind mount(s): ${args.filter((a) => a === "-v" || a.startsWith("--mount")).join(" ")}`,
      );
    }
  }

  if (evidence.length === 0) return [];

  return [
    {
      id: "S3",
      severity: "medium",
      server: server.name,
      title: "non-standard or privileged launch command",
      detail:
        "A shell wrapper, sudo, or container with host mounts gives the " +
        "MCP launcher reach beyond what a packaged server normally has. " +
        "Whatever else the command does runs every time your agent client " +
        "starts.",
      remediation:
        "Prefer launching via npx/uvx/pipx with a pinned package. If a " +
        "shell or docker wrapper is genuinely needed, document why.",
      evidence,
    },
  ];
};

const SHELLS = new Set<string>(["sh", "bash", "zsh", "dash", "ksh"]);

function baseCommand(cmd: string): string {
  const slash = cmd.lastIndexOf("/");
  return (slash >= 0 ? cmd.slice(slash + 1) : cmd).trim();
}
