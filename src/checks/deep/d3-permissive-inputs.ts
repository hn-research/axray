/**
 * D3 — Over-permissive tool inputs.
 *
 * A tool with `inputSchema.properties.command: { type: "string" }`
 * effectively accepts any shell command the model decides to write —
 * even if its name and description sound innocuous. We flag tools that
 * expose suggestively-named string inputs (command / sql / query /
 * path / script / code / exec) with no constraining `enum` or `pattern`.
 *
 * The check looks one level deep into the JSON Schema; nested
 * sub-schemas are out of scope for v0.1.
 */

import type { Finding, ServerSpec, ToolInfo } from "../../types.js";
import type { DeepCheck } from "./types.js";

const SUGGESTIVE_NAMES = new Set([
  "command",
  "cmd",
  "sql",
  "query",
  "path",
  "filepath",
  "file_path",
  "script",
  "code",
  "exec",
  "shell",
  "url",
  "endpoint",
]);

export const d3PermissiveInputs: DeepCheck = (
  server: ServerSpec,
  tools: ToolInfo[],
): Finding[] => {
  const hits: { tool: string; prop: string }[] = [];
  for (const t of tools) {
    const props = extractStringProps(t.inputSchema);
    for (const p of props) {
      if (!SUGGESTIVE_NAMES.has(p.name.toLowerCase())) continue;
      if (p.constrained) continue;
      hits.push({ tool: t.name, prop: p.name });
    }
  }
  if (hits.length === 0) return [];
  return [
    {
      id: "D3",
      severity: "medium",
      server: server.name,
      title: "tool inputs accept unconstrained strings",
      detail:
        "Tool inputs named `command` / `sql` / `path` / similar with no " +
        "`enum` or `pattern` let the model supply anything. The intended " +
        "narrowness lives only in the model's interpretation of the name.",
      remediation:
        "Add a pattern / enum / length bound at the server, or replace " +
        "the string with structured fields.",
      evidence: hits.map((h) => `${h.tool}.${h.prop}`),
    },
  ];
};

interface PropInfo {
  name: string;
  constrained: boolean;
}

function extractStringProps(schema: unknown): PropInfo[] {
  if (!isObject(schema)) return [];
  const props = schema["properties"];
  if (!isObject(props)) return [];
  const out: PropInfo[] = [];
  for (const [name, def] of Object.entries(props)) {
    if (!isObject(def)) continue;
    if (def["type"] !== "string") continue;
    const constrained =
      Array.isArray(def["enum"]) ||
      typeof def["pattern"] === "string" ||
      typeof def["format"] === "string" ||
      typeof def["maxLength"] === "number";
    out.push({ name, constrained });
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
