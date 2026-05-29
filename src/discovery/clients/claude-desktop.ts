import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ServerSpec } from "../../types.js";
import { parseMcpServersBlock } from "../common.js";
import { readJsonIfExists } from "../io.js";

/**
 * Claude Desktop config locations (v0.1: macOS + Linux; Windows fast-follow).
 *   macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 *   Linux: ~/.config/Claude/claude_desktop_config.json
 */
export async function discoverClaudeDesktop(): Promise<ServerSpec[]> {
  const home = homedir();
  let candidate: string | undefined;
  if (platform() === "darwin") {
    candidate = join(
      home,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  } else if (platform() === "linux") {
    candidate = join(home, ".config", "Claude", "claude_desktop_config.json");
  }
  if (!candidate) return [];

  const loaded = await readJsonIfExists(candidate);
  if (!loaded) return [];
  return parseMcpServersBlock(loaded.data, {
    source: "claude-desktop",
    configPath: candidate,
    configPerms: loaded.perms,
  });
}
