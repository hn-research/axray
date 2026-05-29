/**
 * Network MCP transports — SSE and streamable-HTTP.
 *
 * Network introspection is safer than stdio: no local code is launched,
 * just a request to the remote URL. We still wall-clock the whole
 * interaction so a hanging server doesn't stall the scan.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ServerSpec, ToolInfo } from "../../types.js";

export async function introspectNetwork(
  server: ServerSpec,
  timeoutMs: number,
): Promise<ToolInfo[]> {
  if (!server.url) throw new Error("remote server has no `url`");
  const u = new URL(server.url);

  const transport =
    server.transport === "http"
      ? new StreamableHTTPClientTransport(u)
      : new SSEClientTransport(u);

  const client = new Client(
    { name: "ax-ray", version: "0.0.0" },
    { capabilities: {} },
  );

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
    void client.close().catch(() => {});
    throw err;
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
