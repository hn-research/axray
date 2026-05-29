import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Finding, ServerSpec } from "../src/types.ts";
import { buildRemediation } from "../src/remediation/index.ts";
import { findSaferModeHints } from "../src/remediation/safer-mode-hints.ts";

function srv(over: Partial<ServerSpec> = {}): ServerSpec {
  return {
    name: "demo-server",
    source: "claude-desktop",
    transport: "stdio",
    configPath: "/fake/config.json",
    configPerms: "600",
    ...over,
  };
}

function finding(id: string, sev: Finding["severity"] = "medium", over: Partial<Finding> = {}): Finding {
  return {
    id,
    severity: sev,
    server: "demo-server",
    title: "x",
    detail: "x",
    remediation: "short",
    evidence: [],
    ...over,
  };
}

describe("findSaferModeHints", () => {
  it("returns a hit for D2 against a manifest with a readonly key", () => {
    const hits = findSaferModeHints("D2", [
      "ALLOW_ONLY_READONLY_TOOLS",
      "K8S_NAMESPACE",
    ]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.key, "ALLOW_ONLY_READONLY_TOOLS");
  });

  it("returns multiple hits when multiple keys match", () => {
    const hits = findSaferModeHints("D2", [
      "ALLOW_ONLY_NON_DESTRUCTIVE_TOOLS",
      "ALLOW_ONLY_READONLY_TOOLS",
      "MASK_SECRETS",
    ]);
    assert.equal(hits.length, 2); // readonly + non_destructive (MASK_SECRETS is S1)
  });

  it("empty when no user_config", () => {
    assert.deepEqual(findSaferModeHints("D2", []), []);
    assert.deepEqual(findSaferModeHints("D2", undefined), []);
  });

  it("empty for finding ids with no pattern set", () => {
    assert.deepEqual(findSaferModeHints("S6", ["READONLY"]), []);
  });
});

describe("buildRemediation", () => {
  it("returns expanded template for a D3 finding with interpolated server", () => {
    const r = buildRemediation(
      finding("D3", "medium", { subject: "shell_exec" }),
      srv({ name: "wide-open" }),
    );
    assert.ok(r);
    assert.match(r.fix, /wide-open/);
    assert.equal(r.saferMode.length, 0);
  });

  it("surfaces safer-mode hints from server.userConfigKeys", () => {
    const r = buildRemediation(
      finding("D2"),
      srv({
        userConfigKeys: [
          "ALLOW_ONLY_READONLY_TOOLS",
          "K8S_TOKEN",
          "MASK_SECRETS",
        ],
      }),
    );
    assert.ok(r);
    const keys = r.saferMode.map((h) => h.key);
    assert.deepEqual(keys.sort(), ["ALLOW_ONLY_READONLY_TOOLS"].sort());
  });

  it("interpolates configPath from server", () => {
    const r = buildRemediation(finding("S2"), srv({ configPath: "/x/y.json" }));
    assert.ok(r);
    assert.match(r.fix, /\/x\/y\.json/);
  });

  it("returns undefined for unknown finding ids", () => {
    assert.equal(buildRemediation(finding("Z99"), srv()), undefined);
  });
});
