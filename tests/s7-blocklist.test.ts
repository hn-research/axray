import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ServerSpec } from "../src/types.ts";
import { s7Blocklisted } from "../src/checks/static/s7-blocklisted.ts";

function srv(over: Partial<ServerSpec> = {}): ServerSpec {
  return {
    name: "test",
    source: "claude-desktop",
    transport: "stdio",
    configPath: "/fake.json",
    configPerms: "600",
    ...over,
  };
}

describe("S7 vendor blocklist", () => {
  it("silent for servers not on a blocklist", () => {
    assert.deepEqual(s7Blocklisted(srv(), {}), []);
  });

  it("emits critical when blocklistedBy is set", () => {
    const f = s7Blocklisted(
      srv({
        scope: "extension:ant.dir.gh.evil.bad-server",
        blocklistedBy: { source: "Anthropic DXT blocklist", ref: "https://x" },
      }),
      {},
    );
    assert.equal(f.length, 1);
    assert.equal(f[0]!.severity, "critical");
    assert.match(f[0]!.evidence.join(" "), /Anthropic DXT blocklist/);
    assert.match(f[0]!.evidence.join(" "), /ant\.dir\.gh\.evil/);
  });
});
