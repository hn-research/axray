/**
 * The reusable detection engine. Single public entry point: `analyze`.
 *
 * Two intended callers:
 *   - CLI: feeds locally-discovered servers + (deep mode) live tools/list.
 *   - Ecosystem indexer: feeds parsed committed configs and NO tools.
 * Same engine, different caller.
 *
 * Pure: all external lookups (npm, GitHub, etc.) are pre-fetched into
 * `options.enrichments`. `analyze` itself does no I/O, so it's
 * deterministic, fast, and testable without network.
 */

import type {
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
import { computeSummary, toGrade } from "./scoring.js";

export interface AnalyzeOptions {
  enrichments?: Enrichments;
}

export function analyze(
  servers: ServerSpec[],
  toolsByServer?: Map<string, ToolInfo[]>,
  options: AnalyzeOptions = {},
): ScanResult {
  const mode = toolsByServer ? "deep" : "static";
  const ctx = options.enrichments
    ? { enrichments: options.enrichments }
    : {};

  const rawTrust: ServerTrust[] = servers.map((s) => {
    const findings = runStaticChecks(s, ctx);
    const positiveFlags = runPositiveChecks(s, ctx);
    return {
      server: s.name,
      tier: pickTier(positiveFlags),
      grade: toGrade(scoreForServer(findings)),
      positiveFlags,
      findings,
    };
  });
  const trust = dedupeFileLevelFindings(rawTrust);

  return {
    scannedAt: new Date().toISOString(),
    mode,
    servers,
    trust,
    summary: computeSummary(trust),
  };
}

/**
 * Tier elevation from observed signals. Tier-3 (publisher-attested)
 * requires a signed manifest, which is a roadmap feature.
 */
function pickTier(flags: PositiveFlag[]): TrustTier {
  const has = (id: string) => flags.some((f) => f.id === id);
  if (has("P1") && has("P2")) return 2;
  return 1;
}

/**
 * Per-server score uses the same weights as the aggregate, but without
 * per-category caps — a single critical finding on one server should
 * collapse that server's grade, even if the whole-machine score keeps
 * its category cap.
 */
/**
 * Some findings describe a property of the config FILE (e.g. world-
 * readable perms) rather than the server. When N servers live in the
 * same file, the same evidence repeats N times. We keep the first
 * occurrence and drop the rest so the report reads cleanly.
 *
 * Heuristic: identical (id, evidence) tuple → duplicate. Per-server
 * findings (e.g. S1 with a secret hit, S2 with a path arg) differ in
 * evidence across servers, so they're preserved.
 *
 * Per-server grade is recomputed from the deduped finding set so a
 * server that lost a finding to dedup grades accordingly.
 */
function dedupeFileLevelFindings(trust: ServerTrust[]): ServerTrust[] {
  const seen = new Set<string>();
  return trust.map((t) => {
    const findings = t.findings.filter((f) => {
      const sig = `${f.id}${f.evidence.join("")}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    return {
      ...t,
      findings,
      grade: toGrade(scoreForServer(findings)),
    };
  });
}

function scoreForServer(findings: Finding[]): number {
  let p = 0;
  for (const f of findings) {
    if (f.severity === "critical") p += 40;
    else if (f.severity === "high") p += 15;
    else if (f.severity === "medium") p += 5;
    else if (f.severity === "low") p += 1;
  }
  return Math.max(0, 100 - p);
}
