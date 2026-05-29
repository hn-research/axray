/**
 * Top-level MCP-server discovery: aggregates all v0.1 clients into a
 * single `ServerSpec[]`, in stable order.
 */

import type { ServerSpec, ToolInfo } from "../types.js";
import { discoverClaudeCode } from "./clients/claude-code.js";
import {
  discoverClaudeDesktop,
  discoverClaudeDesktopDxtIndex,
  discoverClaudeDesktopManifestTools,
} from "./clients/claude-desktop.js";
import { discoverClineServers } from "./clients/cline.js";
import { discoverContinueServers } from "./clients/continue.js";
import { discoverCursor } from "./clients/cursor.js";

export type DiscoveryClient =
  | "claude-desktop"
  | "cursor"
  | "claude-code"
  | "cline"
  | "continue";

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
  "cline",
  "continue",
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
  if (want.has("cline")) {
    out.push(...(await discoverClineServers()));
  }
  if (want.has("continue")) {
    out.push(...(await discoverContinueServers()));
  }
  return out;
}

/**
 * Tools that callers declare statically inside their config/manifest.
 * Today only Claude Desktop DXT extensions contribute (their manifests
 * carry a `tools` array). Used as a non-`--connect` input to the deep
 * checks — live introspection still wins on merge if `--connect` is
 * set on the same server.
 */
export async function discoverManifestTools(): Promise<
  Map<string, ToolInfo[]>
> {
  return discoverClaudeDesktopManifestTools();
}

/** Set of server names known to come from Anthropic's DXT directory. */
export async function discoverDxtServerNames(): Promise<Set<string>> {
  return discoverClaudeDesktopDxtIndex();
}
