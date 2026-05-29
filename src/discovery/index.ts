/**
 * Top-level config discovery: aggregates all v0.1 clients into a single
 * `ServerSpec[]`, in stable order (claude-desktop, cursor, claude-code).
 */

import type { ServerSpec } from "../types.js";
import { discoverClaudeCode } from "./clients/claude-code.js";
import { discoverClaudeDesktop } from "./clients/claude-desktop.js";
import { discoverCursor } from "./clients/cursor.js";

export type DiscoveryClient = "claude-desktop" | "cursor" | "claude-code";

export interface DiscoveryOptions {
  /** Defaults to all v0.1 clients. */
  clients?: DiscoveryClient[];
  /** Project root for project-local configs. Defaults to process.cwd(). */
  projectRoot?: string;
}

const ALL: readonly DiscoveryClient[] = [
  "claude-desktop",
  "cursor",
  "claude-code",
];

export async function discoverServers(
  opts: DiscoveryOptions = {},
): Promise<ServerSpec[]> {
  const want = new Set<DiscoveryClient>(opts.clients ?? ALL);
  const out: ServerSpec[] = [];
  if (want.has("claude-desktop")) {
    out.push(...(await discoverClaudeDesktop()));
  }
  if (want.has("cursor")) {
    const cursorOpts: { projectRoot?: string } = {};
    if (opts.projectRoot !== undefined) cursorOpts.projectRoot = opts.projectRoot;
    out.push(...(await discoverCursor(cursorOpts)));
  }
  if (want.has("claude-code")) {
    const ccOpts: { projectRoot?: string } = {};
    if (opts.projectRoot !== undefined) ccOpts.projectRoot = opts.projectRoot;
    out.push(...(await discoverClaudeCode(ccOpts)));
  }
  return out;
}
