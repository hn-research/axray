/**
 * Static + positive check tests. Pure-function tests; no I/O.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ServerSpec } from "../src/types.ts";
import { s1Secrets } from "../src/checks/static/s1-secrets.ts";
import { s2FilesystemRoot } from "../src/checks/static/s2-fs-root.ts";
import { s4SupplyChain } from "../src/checks/static/s4-supply-chain.ts";
import { s5InsecureRemote } from "../src/checks/static/s5-insecure-remote.ts";
import { p1VerifiedRepo } from "../src/checks/positive/p1-verified-repo.ts";
import { p2Adoption } from "../src/checks/positive/p2-adoption.ts";
import { p3Pinned } from "../src/checks/positive/p3-pinned.ts";
import { p5ScopedInstall } from "../src/checks/positive/p5-scoped-install.ts";

function mkServer(over: Partial<ServerSpec> = {}): ServerSpec {
  return {
    name: "test",
    source: "claude-desktop",
    transport: "stdio",
    configPath: "/tmp/x.json",
    configPerms: "600",
    ...over,
  };
}

describe("S1 secrets in config", () => {
  it("flags a GitHub PAT in env (critical)", () => {
    const s = mkServer({
      env: { GITHUB_TOKEN: "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    });
    const findings = s1Secrets(s, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.severity, "critical");
    assert.match(findings[0]!.evidence.join(" "), /GitHub PAT/);
  });

  it("flags an OpenAI key in args (critical)", () => {
    const s = mkServer({
      args: ["--key", "sk-abcdefghijklmnopqrstuvwxyz0123456789"],
    });
    const findings = s1Secrets(s, {});
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.evidence.join(" "), /OpenAI/);
  });

  it("flags a DSN with embedded password", () => {
    const s = mkServer({
      env: { DATABASE_URL: "postgres://user:supersecret@db.example.com/x" },
    });
    const findings = s1Secrets(s, {});
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.evidence.join(" "), /DSN with embedded password/);
  });

  it("flags world-readable perms even without secrets (medium)", () => {
    const s = mkServer({ configPerms: "644" });
    const findings = s1Secrets(s, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.severity, "medium");
    assert.match(findings[0]!.evidence.join(" "), /mode 644/);
  });

  it("returns empty for clean stdio server with mode 600", () => {
    const s = mkServer({
      env: { FOO: "bar" },
      args: ["-y", "@scope/pkg"],
      configPerms: "600",
    });
    assert.deepEqual(s1Secrets(s, {}), []);
  });
});

describe("S2 filesystem root", () => {
  it("flags HOME as filesystem root", () => {
    const home = process.env["HOME"] ?? "/Users/me";
    const s = mkServer({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", home],
      packageHints: { npm: "@modelcontextprotocol/server-filesystem" },
    });
    const findings = s2FilesystemRoot(s, {});
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.evidence.join(" "), /user home directory/);
  });

  it("does not flag a project subdir", () => {
    const home = process.env["HOME"] ?? "/Users/me";
    const s = mkServer({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", home + "/code/foo"],
      packageHints: { npm: "@modelcontextprotocol/server-filesystem" },
    });
    assert.deepEqual(s2FilesystemRoot(s, {}), []);
  });

  it("ignores non-filesystem packages", () => {
    const s = mkServer({
      command: "npx",
      args: ["-y", "@scope/other", "/Users"],
      packageHints: { npm: "@scope/other" },
    });
    assert.deepEqual(s2FilesystemRoot(s, {}), []);
  });
});

describe("S4 supply chain", () => {
  it("flags unpinned npx -y package", () => {
    const s = mkServer({ command: "npx", args: ["-y", "@scope/pkg"] });
    const findings = s4SupplyChain(s, {});
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.title, /not version-pinned/);
  });

  it("accepts a pinned package", () => {
    const s = mkServer({ command: "npx", args: ["-y", "@scope/pkg@1.2.3"] });
    assert.deepEqual(s4SupplyChain(s, {}), []);
  });

  it("flags github: shorthand as non-registry", () => {
    const s = mkServer({ command: "npx", args: ["-y", "github:user/repo"] });
    const findings = s4SupplyChain(s, {});
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.title, /non-registry source/);
  });
});

describe("S5 insecure remote", () => {
  it("flags http:// remotes (medium)", () => {
    const s = mkServer({ transport: "sse", url: "http://example.com/mcp" });
    const findings = s5InsecureRemote(s, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.severity, "medium");
  });

  it("flags raw IP as info", () => {
    const s = mkServer({ transport: "sse", url: "https://10.0.0.5/mcp" });
    const findings = s5InsecureRemote(s, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.severity, "info");
  });

  it("accepts a normal https domain", () => {
    const s = mkServer({ transport: "sse", url: "https://api.example.com/mcp" });
    assert.deepEqual(s5InsecureRemote(s, {}), []);
  });
});

describe("Positive flags", () => {
  it("P1 emits when repo resolves to github.com", () => {
    const enr = new Map([
      [
        "test",
        {
          server: "test",
          npm: {
            name: "pkg",
            versions: [],
            repository: "git+https://github.com/foo/bar.git",
          },
        },
      ],
    ]);
    const flags = p1VerifiedRepo(mkServer(), { enrichments: enr });
    assert.equal(flags.length, 1);
    assert.equal(flags[0]!.id, "P1");
  });

  it("P2 emits with a band label", () => {
    const enr = new Map([
      [
        "test",
        { server: "test", npm: { name: "pkg", versions: [], weeklyDownloads: 25000 } },
      ],
    ]);
    const flags = p2Adoption(mkServer(), { enrichments: enr });
    assert.equal(flags.length, 1);
    assert.match(flags[0]!.label, /broad/);
  });

  it("P3 flags pinned-and-current", () => {
    const enr = new Map([
      [
        "test",
        {
          server: "test",
          npm: { name: "pkg", versions: ["1.0.0", "1.1.0", "1.2.0", "1.2.1", "1.3.0"] },
        },
      ],
    ]);
    const s = mkServer({ command: "npx", args: ["-y", "@scope/pkg@1.2.1"] });
    const flags = p3Pinned(s, { enrichments: enr });
    assert.equal(flags.length, 1);
    assert.match(flags[0]!.label, /current/);
  });

  it("P5 flags project-scoped filesystem install", () => {
    const home = process.env["HOME"] ?? "/Users/me";
    const s = mkServer({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", home + "/code/proj"],
      packageHints: { npm: "@modelcontextprotocol/server-filesystem" },
    });
    const flags = p5ScopedInstall(s, {});
    assert.equal(flags.length, 1);
  });
});
