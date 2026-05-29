import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ServerSpec } from "../../types.js";
import { parseMcpServersBlock } from "../common.js";
import { findUp, readJsonIfExists } from "../io.js";

/**
 * Cursor MCP configs.
 *   Global:  ~/.cursor/mcp.json
 *   Project: <repo>/.cursor/mcp.json (walked up from CWD or --project)
 */
export async function discoverCursor(opts?: {
  projectRoot?: string;
}): Promise<ServerSpec[]> {
  const out: ServerSpec[] = [];
  const globalPath = join(homedir(), ".cursor", "mcp.json");

  const g = await readJsonIfExists(globalPath);
  if (g) {
    out.push(
      ...parseMcpServersBlock(g.data, {
        source: "cursor",
        configPath: globalPath,
        configPerms: g.perms,
      }),
    );
  }

  const start = opts?.projectRoot ? resolve(opts.projectRoot) : process.cwd();
  const projectPath = await findUp(start, join(".cursor", "mcp.json"));
  if (projectPath && projectPath !== globalPath) {
    const p = await readJsonIfExists(projectPath);
    if (p) {
      out.push(
        ...parseMcpServersBlock(p.data, {
          source: "cursor",
          configPath: projectPath,
          configPerms: p.perms,
        }),
      );
    }
  }
  return out;
}
