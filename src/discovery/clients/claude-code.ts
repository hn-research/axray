import { homedir } from "node:os";
import { resolve, join, basename } from "node:path";
import type { ServerSpec } from "../../types.js";
import { parseMcpServersBlock } from "../common.js";
import { findUp, readJsonIfExists } from "../io.js";

/**
 * Claude Code config locations.
 *
 *   Global  ~/.claude.json
 *       Two shapes inside this file are honored:
 *         (a) top-level `mcpServers` (rare)
 *         (b) `projects.<projectPath>.mcpServers` (the common shape) —
 *             each project's servers are emitted with `scope` set to the
 *             project path so the report distinguishes them.
 *   Project <repo>/.mcp.json   (walked up from CWD or --project)
 */
export async function discoverClaudeCode(opts?: {
  projectRoot?: string;
}): Promise<ServerSpec[]> {
  const out: ServerSpec[] = [];
  const globalPath = join(homedir(), ".claude.json");

  const g = await readJsonIfExists(globalPath);
  if (g) {
    // (a) top-level mcpServers
    out.push(
      ...parseMcpServersBlock(g.data, {
        source: "claude-code",
        configPath: globalPath,
        configPerms: g.perms,
      }),
    );
    // (b) per-project mcpServers
    if (isPlainObject(g.data)) {
      const projects = g.data["projects"];
      if (isPlainObject(projects)) {
        for (const [projectPath, projectVal] of Object.entries(projects)) {
          if (!isPlainObject(projectVal)) continue;
          const scope = projectPath; // free-form display
          const fromProject = parseMcpServersBlock(projectVal, {
            source: "claude-code",
            configPath: globalPath,
            configPerms: g.perms,
          });
          for (const s of fromProject) {
            s.scope = scope;
            out.push(s);
          }
        }
      }
    }
  }

  // Project-local .mcp.json — walk up from CWD/--project
  const start = opts?.projectRoot ? resolve(opts.projectRoot) : process.cwd();
  const projectPath = await findUp(start, ".mcp.json");
  if (projectPath) {
    const p = await readJsonIfExists(projectPath);
    if (p) {
      const fromFile = parseMcpServersBlock(p.data, {
        source: "claude-code",
        configPath: projectPath,
        configPerms: p.perms,
      });
      const scope = basename(resolve(projectPath, ".."));
      for (const s of fromFile) {
        s.scope = scope;
        out.push(s);
      }
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
