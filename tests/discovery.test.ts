/**
 * Discovery parsing tests. Pure-function tests against
 * `parseMcpServersBlock` / `inferPackageHints` — no filesystem.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseMcpServersBlock,
  inferPackageHints,
} from "../src/discovery/common.ts";

const ctx = {
  source: "claude-desktop" as const,
  configPath: "/tmp/x.json",
  configPerms: "644",
};

describe("parseMcpServersBlock", () => {
  it("returns empty for non-object inputs", () => {
    assert.deepEqual(parseMcpServersBlock(null, ctx), []);
    assert.deepEqual(parseMcpServersBlock("nope", ctx), []);
    assert.deepEqual(parseMcpServersBlock([], ctx), []);
  });

  it("returns empty when mcpServers is missing or non-object", () => {
    assert.deepEqual(parseMcpServersBlock({}, ctx), []);
    assert.deepEqual(parseMcpServersBlock({ mcpServers: 42 }, ctx), []);
  });

  it("parses a stdio server with command/args/env", () => {
    const out = parseMcpServersBlock(
      {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: [
              "-y",
              "@modelcontextprotocol/server-filesystem",
              "/home/me",
            ],
            env: { FOO: "bar" },
          },
        },
      },
      ctx,
    );
    assert.equal(out.length, 1);
    const s = out[0]!;
    assert.equal(s.name, "filesystem");
    assert.equal(s.transport, "stdio");
    assert.equal(s.command, "npx");
    assert.deepEqual(s.args, [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/home/me",
    ]);
    assert.deepEqual(s.env, { FOO: "bar" });
    assert.equal(s.packageHints?.npm, "@modelcontextprotocol/server-filesystem");
    assert.equal(s.configPath, "/tmp/x.json");
    assert.equal(s.configPerms, "644");
  });

  it("parses a remote sse server", () => {
    const out = parseMcpServersBlock(
      {
        mcpServers: {
          "web-thing": { url: "https://example.com/mcp", type: "sse" },
        },
      },
      ctx,
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.transport, "sse");
    assert.equal(out[0]!.url, "https://example.com/mcp");
    assert.equal(out[0]!.command, undefined);
  });

  it("classifies remote with type=http as http transport", () => {
    const out = parseMcpServersBlock(
      { mcpServers: { x: { url: "https://e.com", type: "http" } } },
      ctx,
    );
    assert.equal(out[0]!.transport, "http");
  });

  it("defaults remote with no type to sse", () => {
    const out = parseMcpServersBlock(
      { mcpServers: { x: { url: "https://e.com" } } },
      ctx,
    );
    assert.equal(out[0]!.transport, "sse");
  });

  it("skips non-object server entries silently", () => {
    const out = parseMcpServersBlock(
      { mcpServers: { good: { url: "https://e" }, bad: "string" } },
      ctx,
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.name, "good");
  });
});

describe("inferPackageHints", () => {
  it("extracts npm package from npx -y form", () => {
    assert.deepEqual(
      inferPackageHints("npx", ["-y", "@scope/pkg", "arg"]),
      { npm: "@scope/pkg" },
    );
  });

  it("strips an inline @version from unscoped packages", () => {
    assert.deepEqual(inferPackageHints("npx", ["-y", "left-pad@1.3.0"]), {
      npm: "left-pad",
    });
  });

  it("strips inline @version from scoped packages", () => {
    assert.deepEqual(
      inferPackageHints("npx", ["-y", "@scope/pkg@2.0.0"]),
      { npm: "@scope/pkg" },
    );
  });

  it("handles `npm exec` form", () => {
    assert.deepEqual(inferPackageHints("npm", ["exec", "-y", "thing"]), {
      npm: "thing",
    });
  });

  it("returns undefined for non-npx commands", () => {
    assert.equal(inferPackageHints("python", ["-m", "thing"]), undefined);
  });

  it("returns undefined when no positional follows the flags", () => {
    assert.equal(inferPackageHints("npx", ["-y"]), undefined);
  });
});
