/**
 * Continue.dev — `~/.continue/config.json`.
 *
 * Two MCP shapes occur in the wild and we normalize both:
 *
 *   New / canonical (top-level mcpServers, same as Claude Desktop):
 *     {
 *       "mcpServers": { "name": { "command": "...", "args": [...], "env": {} } }
 *     }
 *
 *   Older / experimental (array under experimental.modelContextProtocolServers):
 *     {
 *       "experimental": {
 *         "modelContextProtocolServers": [
 *           { "transport": { "type": "stdio", "command": "...", "args": [...] } }
 *         ]
 *       }
 *     }
 *
 * Both produce ServerSpec[] with source = "continue".
 *
 * (YAML config — `config.yaml` — is fast-follow; v0.1 reads JSON only.)
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { ServerSpec, Transport } from "../../types.js";
import { parseMcpServersBlock, inferPackageHints } from "../common.js";
import { readJsonIfExists } from "../io.js";

export async function discoverContinueServers(): Promise<ServerSpec[]> {
  const path = join(homedir(), ".continue", "config.json");
  const loaded = await readJsonIfExists(path);
  if (!loaded) return [];
  if (typeof loaded.data !== "object" || loaded.data === null) return [];
  const root = loaded.data as Record<string, unknown>;

  const out: ServerSpec[] = [];

  // Shape A: canonical `mcpServers` object — same parser as everywhere else.
  out.push(
    ...parseMcpServersBlock(root, {
      source: "continue",
      configPath: path,
      configPerms: loaded.perms,
    }),
  );

  // Shape B: experimental.modelContextProtocolServers array
  const experimental = root["experimental"];
  if (isObject(experimental)) {
    const arr = experimental["modelContextProtocolServers"];
    if (Array.isArray(arr)) {
      arr.forEach((entry, i) => {
        if (!isObject(entry)) return;
        const transport = isObject(entry["transport"])
          ? (entry["transport"] as Record<string, unknown>)
          : entry;
        const type = typeof transport["type"] === "string" ? transport["type"] : "stdio";
        const command =
          typeof transport["command"] === "string" ? transport["command"] : undefined;
        const args = Array.isArray(transport["args"])
          ? transport["args"].filter((a): a is string => typeof a === "string")
          : undefined;
        const env = isObject(transport["env"])
          ? (Object.fromEntries(
              Object.entries(transport["env"]).filter(
                ([, v]) => typeof v === "string",
              ),
            ) as Record<string, string>)
          : undefined;
        const url =
          typeof transport["url"] === "string" ? transport["url"] : undefined;

        const t: Transport =
          type === "sse" ? "sse" : type === "http" ? "http" : "stdio";

        const name =
          typeof entry["name"] === "string" && entry["name"]
            ? entry["name"]
            : `experimental[${i}]`;

        const spec: ServerSpec = {
          name,
          source: "continue",
          transport: t,
          configPath: path,
          configPerms: loaded.perms,
        };
        if (t === "stdio") {
          if (command !== undefined) spec.command = command;
          if (args !== undefined) spec.args = args;
          if (env !== undefined) spec.env = env;
          const hints = inferPackageHints(command, args);
          if (hints) spec.packageHints = hints;
        } else if (url !== undefined) {
          spec.url = url;
        }
        out.push(spec);
      });
    }
  }

  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
