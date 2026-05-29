/**
 * Cline (saoudrizwan.claude-dev) — VS Code-family extension.
 *
 * Cline stores config inside the host editor's globalStorage:
 *   ~/Library/Application Support/<host>/User/globalStorage/
 *       saoudrizwan.claude-dev/settings/
 *         cline_mcp_settings.json        (MCP servers, same shape as Claude Desktop)
 *         cline_custom_instructions.md   (prompt-style rules)
 *
 * Cline can run inside multiple host editors (VS Code stable, Insiders,
 * Cursor, VSCodium, Windsurf), and each host has its own storage. We
 * walk all known hosts and emit a separate result for each that's
 * present. Source label is always "cline" — the host identity ends up
 * in `configPath` so the report shows where each surface lives.
 *
 * NOTE: this module surfaces ONLY the MCP servers. Custom instructions
 * (prompt-style rules) are handled by `cline-native.ts` because they
 * feed the capability pipeline, not the server pipeline.
 */

import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ServerSpec } from "../../types.js";
import { parseMcpServersBlock } from "../common.js";
import { readJsonIfExists } from "../io.js";

const EXTENSION_ID = "saoudrizwan.claude-dev";
const MCP_FILE = "cline_mcp_settings.json";

const HOSTS = [
  "Code",
  "Code - Insiders",
  "Cursor",
  "VSCodium",
  "Windsurf",
];

export async function discoverClineServers(): Promise<ServerSpec[]> {
  const out: ServerSpec[] = [];
  for (const host of HOSTS) {
    const path = mcpPathForHost(host);
    if (!path) continue;
    const loaded = await readJsonIfExists(path);
    if (!loaded) continue;
    const parsed = parseMcpServersBlock(loaded.data, {
      source: "cline",
      configPath: path,
      configPerms: loaded.perms,
    });
    for (const s of parsed) {
      s.scope = `host:${host}`;
      out.push(s);
    }
  }
  return out;
}

function mcpPathForHost(host: string): string | undefined {
  const home = homedir();
  if (platform() === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      host,
      "User",
      "globalStorage",
      EXTENSION_ID,
      "settings",
      MCP_FILE,
    );
  }
  if (platform() === "linux") {
    return join(
      home,
      ".config",
      host,
      "User",
      "globalStorage",
      EXTENSION_ID,
      "settings",
      MCP_FILE,
    );
  }
  return undefined;
}
