/**
 * Cline native capabilities — `cline_custom_instructions.md`.
 *
 * Cline's custom instructions are prompt-style rules attached to every
 * conversation. They feed the model as system context, so the same
 * prompt-injection vector that applies to Cursor `.cursorrules` applies
 * here. We read them as RuleSpec records on a ClientCapability so the
 * existing CC1 (rules content scan) check fires uniformly.
 *
 * Cline lacks Claude Code-style hooks and per-tool permission grammars,
 * so the `hooks` / `permissions` blocks on the emitted capability are
 * always empty. The interesting surface is the rules content.
 */

import { readFile, stat } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ClientCapability, RuleSpec } from "../../types.js";

const EXTENSION_ID = "saoudrizwan.claude-dev";
const INSTRUCTIONS_FILE = "cline_custom_instructions.md";
const MAX_RULE_BYTES = 64 * 1024;

const HOSTS = ["Code", "Code - Insiders", "Cursor", "VSCodium", "Windsurf"];

export async function discoverClineCapabilities(): Promise<
  ClientCapability[]
> {
  const out: ClientCapability[] = [];
  for (const host of HOSTS) {
    const path = instructionsPathForHost(host);
    if (!path) continue;
    const rule = await maybeReadRule(path);
    if (!rule) continue;
    out.push({
      client: "cline",
      scope: "global",
      configPath: path,
      configPerms: rule.perms,
      hooks: [],
      permissions: { allow: [], deny: [], additionalDirectories: [] },
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      rules: [rule],
      extras: { host },
    });
  }
  return out;
}

function instructionsPathForHost(host: string): string | undefined {
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
      INSTRUCTIONS_FILE,
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
      INSTRUCTIONS_FILE,
    );
  }
  return undefined;
}

async function maybeReadRule(path: string): Promise<RuleSpec | undefined> {
  try {
    const st = await stat(path);
    if (!st.isFile()) return undefined;
    const buf = await readFile(path, "utf8");
    const content =
      buf.length > MAX_RULE_BYTES ? buf.slice(0, MAX_RULE_BYTES) : buf;
    const perms = (st.mode & 0o777).toString(8).padStart(3, "0");
    return { path, scope: "global", bytes: st.size, perms, content };
  } catch {
    return undefined;
  }
}
