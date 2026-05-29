/**
 * Shared `mcpServers` block parser.
 *
 * All three v0.1 clients (Claude Desktop, Cursor, Claude Code) use the same
 * `mcpServers: { <name>: { command|url, ... } }` shape; only the file
 * location differs. This module is the one place we normalize the raw JSON
 * into our `ServerSpec` type.
 */

import type { ServerSpec, SourceClient, Transport } from "../types.js";

interface ParseCtx {
  source: SourceClient;
  configPath: string;
  configPerms?: string;
}

export function parseMcpServersBlock(
  raw: unknown,
  ctx: ParseCtx,
): ServerSpec[] {
  if (!isPlainObject(raw)) return [];
  const block = raw["mcpServers"];
  if (!isPlainObject(block)) return [];

  const out: ServerSpec[] = [];
  for (const [name, value] of Object.entries(block)) {
    if (!isPlainObject(value)) continue;
    const v = value as Record<string, unknown>;

    const url = typeof v["url"] === "string" ? v["url"] : undefined;
    const command = typeof v["command"] === "string" ? v["command"] : undefined;
    const args = Array.isArray(v["args"])
      ? v["args"].filter((a): a is string => typeof a === "string")
      : undefined;
    const env = isPlainObject(v["env"])
      ? (Object.fromEntries(
          Object.entries(v["env"]).filter(
            ([, val]) => typeof val === "string",
          ),
        ) as Record<string, string>)
      : undefined;

    const transport: Transport = url
      ? v["type"] === "http" || v["transport"] === "http"
        ? "http"
        : "sse"
      : "stdio";

    const spec: ServerSpec = {
      name,
      source: ctx.source,
      transport,
      configPath: ctx.configPath,
    };
    if (ctx.configPerms !== undefined) spec.configPerms = ctx.configPerms;
    if (transport === "stdio") {
      if (command !== undefined) spec.command = command;
      if (args !== undefined) spec.args = args;
      if (env !== undefined) spec.env = env;
      const hints = inferPackageHints(command, args);
      if (hints) spec.packageHints = hints;
    } else {
      if (url !== undefined) spec.url = url;
    }
    out.push(spec);
  }
  return out;
}

/**
 * Best-effort package identification from the launch command. Used by the
 * npm enrichment + the supply-chain check (S4). v0.1 covers the common npx
 * cases; uvx/pipx detection lands when we add PyPI enrichment.
 */
export function inferPackageHints(
  command: string | undefined,
  args: string[] | undefined,
): { npm?: string } | undefined {
  if (!command) return undefined;
  const a = args ?? [];

  if (command === "npx" || command === "npm") {
    // `npm exec -- ...` form
    let i = command === "npm" && a[0] === "exec" ? 1 : 0;
    // skip option flags like -y / --yes / --package=...
    while (i < a.length) {
      const tok = a[i]!;
      if (tok === "--") {
        i++;
        break;
      }
      if (tok.startsWith("-")) {
        i++;
        continue;
      }
      break;
    }
    const pkg = a[i];
    if (pkg && !pkg.startsWith("-")) {
      // npm specs may include @version — strip for the package id.
      // Preserve scoped packages: @scope/pkg or @scope/pkg@1.2.3
      let id = pkg;
      if (pkg.startsWith("@")) {
        const at = pkg.indexOf("@", 1);
        if (at > 0) id = pkg.slice(0, at);
      } else {
        const at = pkg.indexOf("@");
        if (at > 0) id = pkg.slice(0, at);
      }
      return { npm: id };
    }
  }
  return undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
