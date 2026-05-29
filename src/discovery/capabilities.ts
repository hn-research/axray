/**
 * Top-level discovery for agent-client native capabilities (the
 * non-MCP "what can the agent do" surface).
 */

import type { ClientCapability } from "../types.js";
import { discoverClaudeCodeCapabilities } from "./clients/claude-code-native.js";
import { discoverClineCapabilities } from "./clients/cline-native.js";
import { discoverContinueCapabilities } from "./clients/continue-native.js";
import { discoverCursorCapabilities } from "./clients/cursor-native.js";

export async function discoverCapabilities(opts?: {
  projectRoot?: string;
}): Promise<ClientCapability[]> {
  const subOpts: { projectRoot?: string } = {};
  if (opts?.projectRoot !== undefined) subOpts.projectRoot = opts.projectRoot;
  const [cc, cur, cline, cont] = await Promise.all([
    discoverClaudeCodeCapabilities(subOpts),
    discoverCursorCapabilities(subOpts),
    discoverClineCapabilities(),
    discoverContinueCapabilities(),
  ]);
  return [...cc, ...cur, ...cline, ...cont];
}
