/**
 * The reusable detection engine. Single public entry point: `analyze`.
 *
 * Two callers in the design:
 *   - CLI: feeds locally-discovered servers + (deep mode) live tools/list.
 *   - BigQuery indexer (next): feeds parsed committed configs and NO tools.
 * Same engine, different caller.
 *
 * Day-1 status: contract + dispatcher only. The S- and D-checks land Day 2/3.
 * Result currently carries empty findings/flags; the scoring formula and
 * `ScanResult` shape are wired so callers can integrate before the checks
 * are filled in.
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

  // TODO Day 2: run static checks S1–S6 (secrets, fs roots, dangerous launch,
  //   supply-chain, insecure remote, missing manifest) → findings + P1–P5.
  // TODO Day 3: run deep checks D1–D3 (tool poisoning, dangerous capability
  //   surface, over-permissive inputs) against toolsByServer → findings + P4.
  const findings: Finding[] = [];
  const positiveFlags: PositiveFlag[] = [];

  const trust: ServerTrust[] = servers.map((s) => {
    const sFindings = findings.filter((f) => f.server === s.name);
    const sFlags = positiveFlags.filter((p) => p.server === s.name);
    const tier: TrustTier = pickTier(sFlags);
    const grade = sFindings.length === 0 ? "C" : toGrade(scoreFromFindings(sFindings));
    return {
      server: s.name,
      tier,
      grade,
      positiveFlags: sFlags,
      findings: sFindings,
    };
  });

  // Acknowledge enrichments will be consumed by Day-2 positive-flag checks.
  void options.enrichments;

  return {
    scannedAt: new Date().toISOString(),
    mode,
    servers,
    trust,
    summary: computeSummary(trust),
  };
}

/** Placeholder tier picker. Day 2 elevates to Tier-2 when P1∧P2 hold. */
function pickTier(flags: PositiveFlag[]): TrustTier {
  if (flags.length === 0) return 1;
  return 1;
}

function scoreFromFindings(findings: Finding[]): number {
  let p = 0;
  for (const f of findings) {
    if (f.severity === "critical") p += 40;
    else if (f.severity === "high") p += 15;
    else if (f.severity === "medium") p += 5;
    else if (f.severity === "low") p += 1;
  }
  return Math.max(0, 100 - p);
}
