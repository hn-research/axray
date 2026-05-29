import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ServerSpec, ToolInfo } from "../../types.js";
import { parseMcpServersBlock } from "../common.js";
import { readJsonIfExists } from "../io.js";
import {
  discoverClaudeDesktopExtensions,
  type ClaudeDesktopExtDiscovery,
} from "./claude-desktop-extensions.js";

/**
 * Claude Desktop discovery has two surfaces today:
 *
 *   (a) Legacy: `claude_desktop_config.json` → `mcpServers` block,
 *       authored by hand or by an external installer.
 *   (b) Extensions / DXT: installed via the in-app Extensions panel.
 *       Tracked in `extensions-installations.json`, with per-extension
 *       manifests + tool declarations carried inline.
 *
 * Both contribute `ServerSpec[]`. DXT extensions additionally surface
 * their `tools` array via the companion `discoverClaudeDesktopExtensions`
 * call — see `discoverManifestTools` in the parent index.
 */
export async function discoverClaudeDesktop(): Promise<ServerSpec[]> {
  const out: ServerSpec[] = [];

  // (a) Legacy mcpServers block
  const legacyPath = legacyConfigPath();
  if (legacyPath) {
    const loaded = await readJsonIfExists(legacyPath);
    if (loaded) {
      out.push(
        ...parseMcpServersBlock(loaded.data, {
          source: "claude-desktop",
          configPath: legacyPath,
          configPerms: loaded.perms,
        }),
      );
    }
  }

  // (b) DXT extensions
  const ext = await discoverClaudeDesktopExtensions();
  out.push(...ext.servers);

  return out;
}

/**
 * DXT manifests declare their tools inline. Returns those declarations
 * so the engine can run D-checks (D1, D2) on Claude Desktop extensions
 * WITHOUT requiring `--connect`. Live introspection via `--connect`
 * takes precedence at merge time in the CLI.
 */
export async function discoverClaudeDesktopManifestTools(): Promise<
  Map<string, ToolInfo[]>
> {
  const ext = await discoverClaudeDesktopExtensions();
  return ext.manifestTools;
}

/** Set of DXT extension IDs found, keyed by display name for use by P-checks. */
export async function discoverClaudeDesktopDxtIndex(): Promise<
  Set<string>
> {
  const ext = await discoverClaudeDesktopExtensions();
  // The set we return is keyed by the *server display name* we used to
  // build ServerSpec.name, so positive-flag checks can match per-server.
  return new Set<string>(ext.servers.map((s) => s.name));
}

function legacyConfigPath(): string | undefined {
  const home = homedir();
  if (platform() === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (platform() === "linux") {
    return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
  return undefined;
}

export type { ClaudeDesktopExtDiscovery };
