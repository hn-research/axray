/**
 * Top-level discovery for agent-client native capabilities (the
 * non-MCP "what can the agent do" surface). Today: Claude Code. Cursor
 * + Claude Desktop fast-follow.
 */

import type { ClientCapability } from "../types.js";
import { discoverClaudeCodeCapabilities } from "./clients/claude-code-native.js";

export async function discoverCapabilities(opts?: {
  projectRoot?: string;
}): Promise<ClientCapability[]> {
  const ccOpts: { projectRoot?: string } = {};
  if (opts?.projectRoot !== undefined) ccOpts.projectRoot = opts.projectRoot;
  const claudeCode = await discoverClaudeCodeCapabilities(ccOpts);
  return claudeCode;
}
