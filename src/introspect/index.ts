/**
 * Deep-mode introspection orchestrator.
 *
 * Given a set of ServerSpec[], opens an MCP client per server, calls
 * `tools/list` (only — never `tools/call`), and returns a map of
 * server-name → ToolInfo[] plus a map of failures.
 *
 * Safety guarantees:
 *   - never calls tools/call (only list operations)
 *   - per-server hard timeout (default 15s) — runaway servers are killed
 *   - bounded concurrency (default 4) — N servers don't all spawn at once
 *   - stdio servers run with the same env the agent client would use
 *     (process.env merged with the spec's env block) so npx / uvx / etc.
 *     resolve correctly
 *   - introspection failures are isolated: one server timing out does
 *     NOT abort the rest of the scan
 */

import type { ServerSpec, ToolInfo } from "../types.js";
import { introspectStdio } from "./transports/stdio.js";
import { introspectNetwork } from "./transports/network.js";

export interface IntrospectOptions {
  timeoutMs?: number;
  concurrency?: number;
}

export interface IntrospectResult {
  toolsByServer: Map<string, ToolInfo[]>;
  failures: Map<string, string>;
}

export async function introspectServers(
  servers: ServerSpec[],
  opts: IntrospectOptions = {},
): Promise<IntrospectResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const toolsByServer = new Map<string, ToolInfo[]>();
  const failures = new Map<string, string>();

  const queue = [...servers];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const s = queue.shift();
          if (!s) return;
          try {
            const tools = await runOne(s, timeoutMs);
            toolsByServer.set(s.name, tools);
          } catch (err) {
            failures.set(s.name, (err as Error).message);
          }
        }
      })(),
    );
  }
  await Promise.all(workers);
  return { toolsByServer, failures };
}

async function runOne(
  server: ServerSpec,
  timeoutMs: number,
): Promise<ToolInfo[]> {
  if (server.transport === "stdio") {
    return introspectStdio(server, timeoutMs);
  }
  return introspectNetwork(server, timeoutMs);
}
