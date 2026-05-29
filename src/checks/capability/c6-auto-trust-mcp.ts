/**
 * C6 — `enableAllProjectMcpServers: true` auto-trusts any `.mcp.json`
 * a project ships, removing the per-project prompt that normally gates
 * MCP-server activation. A malicious project repo can now drop an MCP
 * server (with arbitrary launch command and tools) and have it just
 * run.
 */

import type { ClientCapability, Finding } from "../../types.js";
import type { CapabilityCheck } from "./types.js";
import { capId } from "./types.js";

export const c6AutoTrustMcp: CapabilityCheck = (
  cap: ClientCapability,
): Finding[] => {
  if (cap.enableAllProjectMcpServers !== true) return [];
  return [
    {
      id: "C6",
      severity: "medium",
      server: capId(cap),
      title: "all project `.mcp.json` servers auto-trusted",
      detail:
        "`enableAllProjectMcpServers` is true, so any project that ships " +
        "a `.mcp.json` activates its MCP servers without a prompt. The " +
        "launch command and tools of those servers run on your machine.",
      remediation:
        "Set `enableAllProjectMcpServers: false` and approve per-project.",
      evidence: [`enableAllProjectMcpServers: true at ${cap.configPath}`],
    },
  ];
};
