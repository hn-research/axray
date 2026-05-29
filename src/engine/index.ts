/**
 * The reusable detection engine. Single public entry point: `analyze`.
 *
 * Two intended callers:
 *   - CLI: feeds locally-discovered servers + capabilities + (deep
 *     mode) live tools/list.
 *   - Ecosystem indexer: feeds parsed committed configs and NO tools.
 * Same engine, different caller.
 *
 * Pure: all external lookups (npm, GitHub, etc.) are pre-fetched into
 * `options.enrichments`. `analyze` itself does no I/O, so it's
 * deterministic, fast, and testable without network.
 *
 * The engine surfaces two distinct subject kinds:
 *   - MCP servers: `ServerSpec[]` → `ServerTrust[]`
 *   - Native client capability records: `ClientCapability[]` →
 *     `CapabilityTrust[]`
 * They share the same Finding / PositiveFlag types so the report and
 * scoring don't need to special-case.
 */

import type {
  ClientCapability,
  CapabilityTrust,
  Enrichments,
  Finding,
  PositiveFlag,
  ScanResult,
  ServerSpec,
  ServerTrust,
  ToolInfo,
  TrustTier,
} from "../types.js";
import { runStaticChecks } from "../checks/static/index.js";
import { runPositiveChecks } from "../checks/positive/index.js";
import {
  runCapabilityChecks,
  runCapabilityPositive,
} from "../checks/capability/index.js";
import { runDeepChecks, runDeepPositive } from "../checks/deep/index.js";
import { computeSummary, toGrade } from "./scoring.js";

export interface AnalyzeOptions {
  enrichments?: Enrichments;
  capabilities?: ClientCapability[];
  /**
   * Reflects what the user opted into, NOT whether D-checks ran. If a
   * server's tools are available statically (e.g. DXT manifest), the
   * deep checks still fire — but the report label stays "static"
   * unless the caller actually performed live introspection.
   */
  mode?: "static" | "deep";
}

export function analyze(
  servers: ServerSpec[],
  toolsByServer?: Map<string, ToolInfo[]>,
  options: AnalyzeOptions = {},
): ScanResult {
  const mode = options.mode ?? "static";
  const ctx = options.enrichments
    ? { enrichments: options.enrichments }
    : {};
  const capabilities = options.capabilities ?? [];

  const rawTrust: ServerTrust[] = servers.map((s) => {
    const findings = runStaticChecks(s, ctx);
    const positiveFlags = runPositiveChecks(s, ctx);
    const introspectedTools = toolsByServer?.get(s.name);
    if (introspectedTools) {
      findings.push(...runDeepChecks(s, introspectedTools, ctx));
      positiveFlags.push(...runDeepPositive(s, introspectedTools, ctx));
    }
    return {
      server: s.name,
      tier: pickServerTier(positiveFlags),
      grade: toGrade(scoreForFindings(findings)),
      positiveFlags,
      findings,
    };
  });

  const capabilityTrust: CapabilityTrust[] = capabilities.map((cap) => {
    const findings = runCapabilityChecks(cap, ctx);
    const positiveFlags = runCapabilityPositive(cap, ctx);
    return {
      client: cap.client,
      scope: cap.scope,
      configPath: cap.configPath,
      grade: toGrade(scoreForFindings(findings)),
      positiveFlags,
      findings,
    };
  });

  const allTrustForSummary = [
    ...rawTrust,
    ...capabilityTrust.map((c) => ({
      server: c.configPath,
      tier: 1 as TrustTier,
      grade: c.grade,
      positiveFlags: c.positiveFlags,
      findings: c.findings,
    })),
  ];

  const trust = dedupeFileLevelFindings(rawTrust);

  return {
    scannedAt: new Date().toISOString(),
    mode,
    servers,
    trust,
    capabilities,
    capabilityTrust,
    summary: computeSummary(allTrustForSummary),
  };
}

/**
 * Server tier elevation. Tier-3 (publisher-attested) requires a signed
 * manifest, which is a roadmap feature.
 */
function pickServerTier(flags: PositiveFlag[]): TrustTier {
  const has = (id: string) => flags.some((f) => f.id === id);
  // Deep-mode elevation: a clean tool surface (P4) alongside attested
  // identity (P1 ∧ P2) is meaningfully stronger than static alone.
  if (has("P1") && has("P2") && has("P4")) return 2;
  if (has("P1") && has("P2")) return 2;
  return 1;
}

/**
 * Some findings describe a property of a config FILE (e.g. world-
 * readable perms) rather than the subject that triggered them. When N
 * servers live in the same file, identical evidence repeats. We keep
 * the first occurrence and drop the rest so the report reads cleanly.
 *
 * Per-server grade is recomputed from the deduped finding set so a
 * server that lost a finding to dedup grades accordingly.
 */
function dedupeFileLevelFindings(trust: ServerTrust[]): ServerTrust[] {
  const seen = new Set<string>();
  return trust.map((t) => {
    const findings = t.findings.filter((f) => {
      const sig = `${f.id}${f.evidence.join("")}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    return {
      ...t,
      findings,
      grade: toGrade(scoreForFindings(findings)),
    };
  });
}

/**
 * Per-subject score uses the same weights as the aggregate, but without
 * per-category caps — a single critical finding on one subject should
 * collapse that subject's grade even if the whole-machine score keeps
 * its category cap.
 */
function scoreForFindings(findings: Finding[]): number {
  let p = 0;
  for (const f of findings) {
    if (f.severity === "critical") p += 40;
    else if (f.severity === "high") p += 15;
    else if (f.severity === "medium") p += 5;
    else if (f.severity === "low") p += 1;
  }
  return Math.max(0, 100 - p);
}
