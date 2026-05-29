/**
 * stdio MCP transport — spawns the configured command and speaks MCP
 * over its stdin/stdout, then asks for `tools/list` and closes.
 *
 * We use `@modelcontextprotocol/sdk`'s `StdioClientTransport`, which
 * handles the process spawn + framing. We wrap the whole interaction
 * in a hard wall-clock timeout and discard the server's stderr to
 * keep the report clean (a noisy server otherwise spams the terminal).
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ServerSpec, ToolInfo } from "../../types.js";

export async function introspectStdio(
  server: ServerSpec,
  timeoutMs: number,
): Promise<ToolInfo[]> {
  if (!server.command) {
    throw new Error("stdio server has no `command` configured");
  }
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  if (server.env) Object.assign(env, server.env);

  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args ?? [],
    env,
    stderr: "ignore",
  });

  const client = new Client(
    { name: "ax-ray", version: "0.0.0" },
    { capabilities: {} },
  );

  const fail = (msg: string) => {
    void client.close().catch(() => {});
    throw new Error(msg);
  };

  const deadline = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`timeout after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([client.connect(transport), deadline]);
    const res = await Promise.race([client.listTools(), deadline]);
    await client.close();
    return normalize(res);
  } catch (err) {
    fail((err as Error).message);
    return []; // unreachable; fail() throws
  }
}

interface ListToolsResponse {
  tools?: {
    name: string;
    description?: string;
    inputSchema?: object;
  }[];
}

function normalize(res: unknown): ToolInfo[] {
  const r = res as ListToolsResponse;
  const tools = r.tools ?? [];
  return tools.map((t) => {
    const info: ToolInfo = {
      name: t.name,
      description: t.description ?? "",
    };
    if (t.inputSchema !== undefined) info.inputSchema = t.inputSchema;
    return info;
  });
}
