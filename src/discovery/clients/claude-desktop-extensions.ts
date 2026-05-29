/**
 * Claude Desktop "Extensions" (DXT) discovery.
 *
 * Modern Claude Desktop installs MCP servers via its in-app Extensions
 * panel rather than the legacy `claude_desktop_config.json` →
 * `mcpServers` block. Those installs land at:
 *
 *   ~/Library/Application Support/Claude/
 *     extensions-installations.json     ← registry; carries every
 *                                         extension's manifest INLINE
 *     Claude Extensions/<id>/           ← unpacked extension code
 *     Claude Extensions Settings/<id>.json ← per-extension `isEnabled` + user_config
 *
 * The registry's per-extension manifest contains:
 *   - server.mcp_config { command, args, env }   ← the launch surface
 *   - tools: [{ name, description }]             ← declared tool surface
 *
 * That second one is the gold: we can run the D1/D2 checks (tool-
 * description poisoning, dangerous capability surface) statically,
 * with NO `--connect` needed for DXT extensions.
 *
 * Arg / env templates are resolved where we can:
 *   `${__dirname}`            → the extension's unpacked directory
 *   `${HOME}`                 → process.env.HOME
 *   `${user_config.<key>}`    → left literal (we don't read user_config
 *                                values for safety reasons — those
 *                                are credentials, not interpolation
 *                                fodder for a security scanner)
 *
 * Disabled extensions (`isEnabled: false` in their settings file) are
 * skipped — they don't run.
 */

import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ServerSpec, ToolInfo } from "../../types.js";
import { readJsonIfExists } from "../io.js";

export interface ClaudeDesktopExtDiscovery {
  servers: ServerSpec[];
  manifestTools: Map<string, ToolInfo[]>;
  /** Extension IDs surfaced as servers (used by positive-flag checks). */
  dxtIds: Set<string>;
}

interface InstallationsFile {
  extensions?: Record<string, InstalledExtension>;
}

interface InstalledExtension {
  id: string;
  version?: string;
  hash?: string;
  installedAt?: string;
  manifest?: ExtensionManifest;
}

interface ExtensionManifest {
  name?: string;
  display_name?: string;
  description?: string;
  author?: { name?: string; url?: string };
  repository?: { type?: string; url?: string } | string;
  homepage?: string;
  server?: {
    type?: string;
    entry_point?: string;
    mcp_config?: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
  tools?: { name: string; description?: string }[];
  user_config?: Record<string, unknown>;
}

export async function discoverClaudeDesktopExtensions(): Promise<ClaudeDesktopExtDiscovery> {
  const empty: ClaudeDesktopExtDiscovery = {
    servers: [],
    manifestTools: new Map(),
    dxtIds: new Set(),
  };
  const supportDir = supportDirForOs();
  if (!supportDir) return empty;

  const installations = await readJsonIfExists(
    join(supportDir, "extensions-installations.json"),
  );
  if (!installations) return empty;
  const data = installations.data as InstallationsFile;
  if (!data || typeof data !== "object") return empty;

  const extensionsDir = join(supportDir, "Claude Extensions");
  const settingsDir = join(supportDir, "Claude Extensions Settings");
  const blocklist = await loadBlocklist(join(supportDir, "extensions-blocklist.json"));

  const servers: ServerSpec[] = [];
  const manifestTools = new Map<string, ToolInfo[]>();
  const dxtIds = new Set<string>();

  for (const [id, ext] of Object.entries(data.extensions ?? {})) {
    if (!ext?.manifest?.server?.mcp_config?.command) continue;

    // Check the per-extension settings for `isEnabled: false`; if absent
    // we treat as enabled (Claude Desktop's default).
    const settings = await readJsonIfExists(join(settingsDir, `${id}.json`));
    const settingsData = settings?.data as { isEnabled?: boolean } | undefined;
    if (settingsData && settingsData.isEnabled === false) continue;

    const m = ext.manifest;
    const cfg = m.server!.mcp_config!;
    const dirname = join(extensionsDir, id);
    const args = (cfg.args ?? []).map((a) => resolveTemplate(a, dirname));
    const env = cfg.env
      ? (Object.fromEntries(
          Object.entries(cfg.env).map(([k, v]) => [k, resolveTemplate(v, dirname)]),
        ) as Record<string, string>)
      : undefined;

    const repoUrl =
      typeof m.repository === "string"
        ? m.repository
        : m.repository?.url;

    const name = m.display_name || m.name || id;

    const spec: ServerSpec = {
      name,
      source: "claude-desktop",
      transport: "stdio",
      configPath: join(supportDir, "extensions-installations.json"),
      configPerms: installations.perms,
      scope: `extension:${id}`,
      command: cfg.command,
      args,
    };
    if (env) spec.env = env;
    if (repoUrl) spec.packageHints = { repo: repoUrl };
    if (blocklist.ids.has(id)) {
      spec.blocklistedBy = { source: "Anthropic DXT blocklist" };
      if (blocklist.ref !== undefined) spec.blocklistedBy.ref = blocklist.ref;
    }
    if (m.user_config && typeof m.user_config === "object") {
      const keys = Object.keys(m.user_config);
      if (keys.length > 0) spec.userConfigKeys = keys;
    }

    servers.push(spec);
    dxtIds.add(id);

    if (Array.isArray(m.tools) && m.tools.length > 0) {
      manifestTools.set(
        name,
        m.tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
        })),
      );
    }
  }

  return { servers, manifestTools, dxtIds };
}

function supportDirForOs(): string | undefined {
  const home = homedir();
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support", "Claude");
  }
  if (platform() === "linux") {
    return join(home, ".config", "Claude");
  }
  return undefined;
}

function resolveTemplate(value: string, dirname: string): string {
  return value
    .replace(/\$\{__dirname\}/g, dirname)
    .replace(/\$\{HOME\}/g, process.env["HOME"] ?? "");
  // `${user_config.*}` deliberately left literal — see file header.
}

/**
 * Anthropic ships a DXT blocklist alongside the installations registry.
 * File shape: an array of `{ entries: string[], lastUpdated, url }`.
 * We aggregate all `entries[]` into a single id-set; any installed
 * extension whose id appears in the set is flagged by S7.
 */
async function loadBlocklist(
  path: string,
): Promise<{ ids: Set<string>; ref?: string }> {
  const ids = new Set<string>();
  const loaded = await readJsonIfExists(path);
  if (!loaded || !Array.isArray(loaded.data)) return { ids };
  let ref: string | undefined;
  for (const block of loaded.data as unknown[]) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as { entries?: unknown; url?: unknown };
    if (Array.isArray(b.entries)) {
      for (const e of b.entries) {
        if (typeof e === "string") ids.add(e);
        else if (
          typeof e === "object" &&
          e !== null &&
          typeof (e as { id?: unknown }).id === "string"
        ) {
          ids.add((e as { id: string }).id);
        }
      }
    }
    if (typeof b.url === "string" && !ref) ref = b.url;
  }
  return ref !== undefined ? { ids, ref } : { ids };
}
