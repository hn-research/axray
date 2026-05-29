/**
 * Continue.dev native capabilities.
 *
 * The `systemMessage` field in `~/.continue/config.json` is a prompt-
 * style rule fed to every assistant request. Plus `~/.continue/rules/`
 * (if present) holds additional rule files. Both surfaces are scanned
 * by the existing CC1 (rules content) check via the RuleSpec shape.
 *
 * Continue has no equivalent of Claude Code's hooks or per-tool
 * allowlists today, so the emitted ClientCapability's hooks /
 * permissions blocks are empty.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClientCapability, RuleSpec } from "../../types.js";
import { readJsonIfExists } from "../io.js";

const MAX_RULE_BYTES = 64 * 1024;

export async function discoverContinueCapabilities(): Promise<
  ClientCapability[]
> {
  const home = homedir();
  const configPath = join(home, ".continue", "config.json");
  const rulesDir = join(home, ".continue", "rules");

  const rules: RuleSpec[] = [];

  // systemMessage from config.json
  const cfg = await readJsonIfExists(configPath);
  if (cfg && typeof cfg.data === "object" && cfg.data !== null) {
    const root = cfg.data as Record<string, unknown>;
    const sys = root["systemMessage"];
    if (typeof sys === "string" && sys.trim().length > 0) {
      rules.push({
        path: `${configPath}#systemMessage`,
        scope: "global",
        bytes: sys.length,
        perms: cfg.perms,
        content: sys,
      });
    }
  }

  // Files under ~/.continue/rules/
  try {
    const entries = await readdir(rulesDir);
    for (const e of entries) {
      const p = join(rulesDir, e);
      const r = await maybeReadRule(p);
      if (r) rules.push(r);
    }
  } catch {
    // dir missing; fine
  }

  if (rules.length === 0) return [];

  return [
    {
      client: "continue",
      scope: "global",
      configPath,
      configPerms: cfg?.perms,
      hooks: [],
      permissions: { allow: [], deny: [], additionalDirectories: [] },
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      rules,
      extras: {},
    },
  ];
}

async function maybeReadRule(path: string): Promise<RuleSpec | undefined> {
  try {
    const st = await stat(path);
    if (!st.isFile()) return undefined;
    if (!/\.(md|mdc|txt)$/i.test(path)) return undefined;
    const buf = await readFile(path, "utf8");
    const content =
      buf.length > MAX_RULE_BYTES ? buf.slice(0, MAX_RULE_BYTES) : buf;
    const perms = (st.mode & 0o777).toString(8).padStart(3, "0");
    return { path, scope: "global", bytes: st.size, perms, content };
  } catch {
    return undefined;
  }
}
