/**
 * Native (non-MCP) capability surface for Cursor.
 *
 * Global settings: ~/Library/Application Support/Cursor/User/settings.json
 *                  (macOS) · ~/.config/Cursor/User/settings.json (linux)
 *
 *   cursor.composer.allowedAutoRunCommands   → permissions.allow
 *   cursor.composer.deniedAutoRunCommands    → permissions.deny
 *   cursor.composer.allowedAutoRunFolders    → permissions.additionalDirectories
 *
 * All cursor.* keys are also carried in `extras` so other checks can
 * probe specifics (e.g. an inline API key in cursor.composer.openAIApiKey).
 *
 * Project: any `.cursorrules` or `.cursor/rules/*.mdc` walked up from the
 * project root is loaded as a RuleSpec and attached to a project-scope
 * ClientCapability. Rules are instruction files the agent obeys, so
 * their content is where prompt-injection lives.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ClientCapability, RuleSpec } from "../../types.js";
import { findUp, readJsonIfExists } from "../io.js";

const MAX_RULE_BYTES = 64 * 1024;

export async function discoverCursorCapabilities(opts?: {
  projectRoot?: string;
}): Promise<ClientCapability[]> {
  const out: ClientCapability[] = [];

  const globalCap = await loadGlobal();
  if (globalCap) out.push(globalCap);

  const start = opts?.projectRoot ? resolve(opts.projectRoot) : process.cwd();
  const projectCap = await loadProjectRules(start);
  if (projectCap) out.push(projectCap);

  return out;
}

async function loadGlobal(): Promise<ClientCapability | undefined> {
  let path: string | undefined;
  if (platform() === "darwin") {
    path = join(
      homedir(),
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "settings.json",
    );
  } else if (platform() === "linux") {
    path = join(homedir(), ".config", "Cursor", "User", "settings.json");
  }
  if (!path) return undefined;

  const loaded = await readJsonIfExists(path);
  if (!loaded) return undefined;
  const data = loaded.data;
  if (typeof data !== "object" || data === null) return undefined;
  const root = data as Record<string, unknown>;

  const allow = stringArray(
    pick(root, "cursor.composer.allowedAutoRunCommands"),
  );
  const deny = stringArray(pick(root, "cursor.composer.deniedAutoRunCommands"));
  const dirs = stringArray(
    pick(root, "cursor.composer.allowedAutoRunFolders"),
  );

  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(root)) {
    if (k.startsWith("cursor.")) extras[k] = v;
  }

  const cap: ClientCapability = {
    client: "cursor",
    scope: "global",
    configPath: path,
    configPerms: loaded.perms,
    hooks: [],
    permissions: {
      allow,
      deny,
      additionalDirectories: dirs,
    },
    permissionsDialect: "cursor",
    enabledMcpjsonServers: [],
    disabledMcpjsonServers: [],
    extras,
  };
  return cap;
}

/**
 * Walks up from `start` and assembles a project-scope ClientCapability
 * carrying any rules files we find. Walks up only to the first project
 * boundary heuristic — the directory containing `.cursorrules`,
 * `.cursor/`, `.git/`, or `package.json`. We do NOT escape past that to
 * avoid sucking in irrelevant rules from grand-parents.
 */
async function loadProjectRules(
  start: string,
): Promise<ClientCapability | undefined> {
  const boundary = await findProjectBoundary(start);
  if (!boundary) return undefined;
  const rules: RuleSpec[] = [];

  // Legacy single-file rule
  await maybeReadRule(join(boundary, ".cursorrules"), "project", rules);

  // Newer rules directory
  const rulesDir = join(boundary, ".cursor", "rules");
  try {
    const entries = await readdir(rulesDir);
    for (const e of entries) {
      if (!/\.(mdc?|txt)$/i.test(e)) continue;
      await maybeReadRule(join(rulesDir, e), "project", rules);
    }
  } catch {
    // dir missing; fine
  }

  if (rules.length === 0) return undefined;

  return {
    client: "cursor",
    scope: "project",
    configPath: boundary,
    projectRoot: boundary,
    hooks: [],
    permissions: { allow: [], deny: [], additionalDirectories: [] },
    permissionsDialect: "cursor",
    enabledMcpjsonServers: [],
    disabledMcpjsonServers: [],
    rules,
    extras: {},
  };
}

async function findProjectBoundary(
  start: string,
): Promise<string | undefined> {
  let dir = start;
  for (let i = 0; i < 32; i++) {
    for (const marker of [
      ".cursorrules",
      join(".cursor", "rules"),
      ".git",
      "package.json",
    ]) {
      try {
        await stat(join(dir, marker));
        return dir;
      } catch {
        // continue
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

async function maybeReadRule(
  path: string,
  scope: "project" | "global",
  acc: RuleSpec[],
): Promise<void> {
  try {
    const st = await stat(path);
    if (!st.isFile()) return;
    const limit = Math.min(st.size, MAX_RULE_BYTES);
    const buf = await readFile(path, { encoding: "utf8" });
    const content = buf.length > limit ? buf.slice(0, limit) : buf;
    const perms = (st.mode & 0o777).toString(8).padStart(3, "0");
    acc.push({ path, scope, bytes: st.size, perms, content });
  } catch {
    // missing or unreadable; skip
  }
}

function pick(root: Record<string, unknown>, key: string): unknown {
  // VS Code-style settings may be nested (cursor.composer.x as a
  // single dotted key OR an object cursor.composer = { x: ... }). Try both.
  if (key in root) return root[key];
  const parts = key.split(".");
  let cur: unknown = root;
  for (const p of parts) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
    if (cur === undefined) return undefined;
  }
  return cur;
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// Stripped suppression for an unused-find import in dev iterations.
void findUp;
