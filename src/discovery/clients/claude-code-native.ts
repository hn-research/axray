/**
 * Native (non-MCP) capability surface for Claude Code.
 *
 * Reads, in order:
 *   ~/.claude/settings.json           global, shared
 *   ~/.claude/settings.local.json     global, machine-local
 *   <project>/.claude/settings.json   project-shared
 *   <project>/.claude/settings.local.json  project-local
 *
 * Each file that exists produces one ClientCapability record (no merging
 * — the report shows where each surface lives so users can act on the
 * actual source).
 *
 * The full Claude Code settings schema is large; we extract only fields
 * that meaningfully change "what the agent can do" or "what runs as a
 * side effect of running the agent." Anything else goes into `extras`
 * so downstream checks can probe it without re-discovering the file.
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
  ClientCapability,
  HookSpec,
} from "../../types.js";
import { findUp, readJsonIfExists } from "../io.js";

export async function discoverClaudeCodeCapabilities(opts?: {
  projectRoot?: string;
}): Promise<ClientCapability[]> {
  const out: ClientCapability[] = [];
  const home = homedir();

  for (const name of ["settings.json", "settings.local.json"]) {
    const cap = await loadOne(
      join(home, ".claude", name),
      "global",
      undefined,
    );
    if (cap) out.push(cap);
  }

  const start = opts?.projectRoot ? resolve(opts.projectRoot) : process.cwd();
  const projectHit = await findUp(start, join(".claude", "settings.json"));
  if (projectHit) {
    // Skip if findUp climbed all the way to ~/.claude/settings.json — that's
    // already covered by the global scan above.
    const globalPath = join(home, ".claude", "settings.json");
    if (projectHit !== globalPath) {
      const dir = projectHit.replace(/\.claude\/settings\.json$/, "").replace(/\/$/, "");
      for (const name of ["settings.json", "settings.local.json"]) {
        const cap = await loadOne(
          join(dir, ".claude", name),
          "project",
          dir,
        );
        if (cap) out.push(cap);
      }
    }
  }

  return out;
}

async function loadOne(
  path: string,
  scope: "global" | "project",
  projectRoot: string | undefined,
): Promise<ClientCapability | undefined> {
  const loaded = await readJsonIfExists(path);
  if (!loaded) return undefined;
  const data = loaded.data as Record<string, unknown> | unknown;
  if (typeof data !== "object" || data === null) return undefined;
  const root = data as Record<string, unknown>;

  const permsBlock = isObject(root["permissions"]) ? (root["permissions"] as Record<string, unknown>) : {};
  const allow = stringArray(permsBlock["allow"]);
  const deny = stringArray(permsBlock["deny"]);
  const additionalDirectories = stringArray(permsBlock["additionalDirectories"]);

  const cap: ClientCapability = {
    client: "claude-code",
    scope,
    configPath: path,
    configPerms: loaded.perms,
    hooks: extractHooks(root["hooks"]),
    permissions: { allow, deny, additionalDirectories },
    enabledMcpjsonServers: stringArray(root["enabledMcpjsonServers"]),
    disabledMcpjsonServers: stringArray(root["disabledMcpjsonServers"]),
    extras: {},
  };
  if (projectRoot !== undefined) cap.projectRoot = projectRoot;
  if (typeof root["apiKeyHelper"] === "string") {
    cap.apiKeyHelper = root["apiKeyHelper"];
  }
  if (typeof root["enableAllProjectMcpServers"] === "boolean") {
    cap.enableAllProjectMcpServers = root["enableAllProjectMcpServers"];
  }
  // Carry through anything else for transparency (e.g. extraKnownMarketplaces).
  const KNOWN_KEYS = new Set([
    "permissions", "hooks", "apiKeyHelper", "enableAllProjectMcpServers",
    "enabledMcpjsonServers", "disabledMcpjsonServers", "mcpServers",
  ]);
  for (const [k, v] of Object.entries(root)) {
    if (KNOWN_KEYS.has(k)) continue;
    cap.extras[k] = v;
  }
  return cap;
}

/**
 * Hooks live under `hooks.<EventName>` (array of matcher groups, each
 * with its own `hooks` array of `{ type, command, ... }`). We flatten
 * into a single list because the event/matcher are themselves part of
 * the per-hook record we want to inspect downstream.
 */
function extractHooks(raw: unknown): HookSpec[] {
  if (!isObject(raw)) return [];
  const out: HookSpec[] = [];
  for (const [event, matcherGroups] of Object.entries(raw)) {
    if (!Array.isArray(matcherGroups)) continue;
    for (const group of matcherGroups) {
      if (!isObject(group)) continue;
      const matcher = typeof group["matcher"] === "string" ? group["matcher"] : undefined;
      const hooks = group["hooks"];
      if (!Array.isArray(hooks)) continue;
      for (const h of hooks) {
        if (!isObject(h)) continue;
        const type = typeof h["type"] === "string" ? h["type"] : "command";
        const command = typeof h["command"] === "string" ? h["command"] : "";
        if (!command) continue;
        const spec: HookSpec = { event, type, command };
        if (matcher !== undefined) spec.matcher = matcher;
        if (typeof h["timeout"] === "number") spec.timeoutSeconds = h["timeout"];
        out.push(spec);
      }
    }
  }
  return out;
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
