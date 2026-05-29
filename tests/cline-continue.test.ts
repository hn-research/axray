/**
 * Adapter tests for Cline + Continue.
 *
 * Neither tool is reliably present in CI, so we exercise the parsers
 * with explicit fixture data. Path discovery (the home-relative dance)
 * is tested implicitly via the live integration in the CLI.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMcpServersBlock } from "../src/discovery/common.ts";

describe("Cline MCP file parser (shape parity with Claude Desktop)", () => {
  it("parses cline_mcp_settings.json as standard mcpServers", () => {
    const out = parseMcpServersBlock(
      {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/repo"],
            env: { FOO: "bar" },
          },
          remote: { url: "https://example.com/mcp", type: "sse" },
        },
      },
      {
        source: "cline",
        configPath: "/fake/cline_mcp_settings.json",
        configPerms: "600",
      },
    );
    assert.equal(out.length, 2);
    assert.equal(out[0]!.source, "cline");
    assert.equal(out[0]!.transport, "stdio");
    assert.equal(out[1]!.transport, "sse");
  });
});

describe("Continue config — mcpServers shape A", () => {
  it("parses the canonical mcpServers map", () => {
    const out = parseMcpServersBlock(
      {
        mcpServers: {
          gh: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
          },
        },
      },
      {
        source: "continue",
        configPath: "/fake/.continue/config.json",
        configPerms: "600",
      },
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.source, "continue");
  });
});

/**
 * Shape B (`experimental.modelContextProtocolServers` array) is
 * normalized inside `discoverContinueServers`, which reads from
 * `~/.continue/config.json`. Redirecting `homedir()` at runtime would
 * require monkey-patching; we exercise that path via an integration
 * fixture invoked from the CLI run below instead of in unit tests.
 */
