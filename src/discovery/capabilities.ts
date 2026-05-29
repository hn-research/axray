/**
 * Top-level discovery for agent-client native capabilities (the
 * non-MCP "what can the agent do" surface). v0.1 covers Claude Code
 * and Cursor; Claude Desktop fast-follow.
 */

import type { ClientCapability } from "../types.js";
import { discoverClaudeCodeCapabilities } from "./clients/claude-code-native.js";
import { discoverCursorCapabilities } from "./clients/cursor-native.js";

export async function discoverCapabilities(opts?: {
  projectRoot?: string;
}): Promise<ClientCapability[]> {
  const subOpts: { projectRoot?: string } = {};
  if (opts?.projectRoot !== undefined) subOpts.projectRoot = opts.projectRoot;
  const [cc, cur] = await Promise.all([
    discoverClaudeCodeCapabilities(subOpts),
    discoverCursorCapabilities(subOpts),
  ]);
  return [...cc, ...cur];
}
