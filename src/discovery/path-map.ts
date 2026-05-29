/**
 * Every file path ax-ray reads. The single source of truth so a
 * maintainer (or contributor) can see the entire filesystem footprint
 * at a glance, and so the `--debug` mode can list "files near our
 * targets we DON'T parse" without duplicating the catalog.
 *
 * Each entry is a (client, label, resolver) tuple. The resolver
 * produces an absolute path for the current OS, or undefined if this
 * OS isn't supported. The actual reading still happens in each
 * adapter — this module catalogues, it does not perform I/O.
 *
 * When Anthropic / Cursor / etc. add a new config file, add one row
 * here and one adapter, then re-run the tests. That's the contract.
 */

import { homedir, platform } from "node:os";
import { join } from "node:path";

export type PathClient =
  | "claude-desktop"
  | "claude-code"
  | "cursor"
  | "cline"
  | "continue";

export interface KnownPath {
  client: PathClient;
  label: string;
  resolve: () => string | undefined;
  kind: "file" | "directory";
  /**
   * What this file feeds. Used by the --debug surface to label entries
   * and by the SCAN COVERAGE matrix.
   */
  feeds: "mcp" | "capabilities" | "extensions" | "registry";
}

function home(): string {
  return homedir();
}

function macOsAppSupport(name: string): () => string | undefined {
  return () => {
    if (platform() === "darwin") {
      return join(home(), "Library", "Application Support", name);
    }
    if (platform() === "linux") {
      return join(home(), ".config", name);
    }
    return undefined;
  };
}

export const KNOWN_PATHS: KnownPath[] = [
  // ── Claude Desktop ──────────────────────────────────────────────
  {
    client: "claude-desktop",
    label: "legacy mcpServers config",
    feeds: "mcp",
    kind: "file",
    resolve: () => {
      const base = macOsAppSupport("Claude")();
      return base ? join(base, "claude_desktop_config.json") : undefined;
    },
  },
  {
    client: "claude-desktop",
    label: "DXT installations registry",
    feeds: "extensions",
    kind: "file",
    resolve: () => {
      const base = macOsAppSupport("Claude")();
      return base ? join(base, "extensions-installations.json") : undefined;
    },
  },
  {
    client: "claude-desktop",
    label: "DXT extensions directory",
    feeds: "extensions",
    kind: "directory",
    resolve: () => {
      const base = macOsAppSupport("Claude")();
      return base ? join(base, "Claude Extensions") : undefined;
    },
  },
  {
    client: "claude-desktop",
    label: "DXT extension settings directory",
    feeds: "extensions",
    kind: "directory",
    resolve: () => {
      const base = macOsAppSupport("Claude")();
      return base ? join(base, "Claude Extensions Settings") : undefined;
    },
  },

  // ── Claude Code ─────────────────────────────────────────────────
  {
    client: "claude-code",
    label: "global config + project map",
    feeds: "mcp",
    kind: "file",
    resolve: () => join(home(), ".claude.json"),
  },
  {
    client: "claude-code",
    label: "global settings.json",
    feeds: "capabilities",
    kind: "file",
    resolve: () => join(home(), ".claude", "settings.json"),
  },
  {
    client: "claude-code",
    label: "global settings.local.json",
    feeds: "capabilities",
    kind: "file",
    resolve: () => join(home(), ".claude", "settings.local.json"),
  },
  // (project-level .claude/settings(.local).json + .mcp.json discovered
  // dynamically via find-up from CWD; not enumerated here.)

  // ── Cursor ──────────────────────────────────────────────────────
  {
    client: "cursor",
    label: "global User settings",
    feeds: "capabilities",
    kind: "file",
    resolve: () => {
      const base = macOsAppSupport("Cursor")();
      return base ? join(base, "User", "settings.json") : undefined;
    },
  },
  {
    client: "cursor",
    label: "global MCP config",
    feeds: "mcp",
    kind: "file",
    resolve: () => join(home(), ".cursor", "mcp.json"),
  },
  // (project-level .cursor/mcp.json + .cursorrules + .cursor/rules/*
  // discovered dynamically via find-up from CWD; not enumerated here.)

  // ── Cline ───────────────────────────────────────────────────────
  // Per-host VS Code-family globalStorage paths. See clients/cline*.ts.
  ...(["Code", "Code - Insiders", "Cursor", "VSCodium", "Windsurf"] as const).flatMap<
    KnownPath
  >((host) => [
    {
      client: "cline" as const,
      label: `cline_mcp_settings.json @ ${host}`,
      feeds: "mcp" as const,
      kind: "file" as const,
      resolve: () => {
        const base = macOsAppSupport(host)();
        return base
          ? join(
              base,
              "User",
              "globalStorage",
              "saoudrizwan.claude-dev",
              "settings",
              "cline_mcp_settings.json",
            )
          : undefined;
      },
    },
    {
      client: "cline" as const,
      label: `cline_custom_instructions.md @ ${host}`,
      feeds: "capabilities" as const,
      kind: "file" as const,
      resolve: () => {
        const base = macOsAppSupport(host)();
        return base
          ? join(
              base,
              "User",
              "globalStorage",
              "saoudrizwan.claude-dev",
              "settings",
              "cline_custom_instructions.md",
            )
          : undefined;
      },
    },
  ]),

  // ── Continue ────────────────────────────────────────────────────
  {
    client: "continue",
    label: "config.json",
    feeds: "mcp",
    kind: "file",
    resolve: () => join(home(), ".continue", "config.json"),
  },
  {
    client: "continue",
    label: "rules directory",
    feeds: "capabilities",
    kind: "directory",
    resolve: () => join(home(), ".continue", "rules"),
  },
];

/**
 * Top-level directories ax-ray *may* look inside for known config
 * files (used by --debug to flag unknown JSON neighbors). Returns
 * absolute, OS-specific paths that currently exist.
 */
export function knownConfigParentDirs(): string[] {
  const out = new Set<string>();
  for (const p of KNOWN_PATHS) {
    const resolved = p.resolve();
    if (!resolved) continue;
    if (p.kind === "directory") {
      out.add(resolved);
    } else {
      // file → its parent
      out.add(resolved.slice(0, resolved.lastIndexOf("/")));
    }
  }
  return [...out];
}
