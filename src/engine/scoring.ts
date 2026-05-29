/**
 * Scoring — see SPEC.md §6. Deterministic, open, re-derivable from the
 * report. No opinions. Per-category penalty caps so a single bad server
 * can't drag the whole machine to F.
 */

import type {
  Grade,
  ScanSummary,
  ServerTrust,
  SummaryCounts,
} from "../types.js";

const CAPS = { critical: 80, high: 60, medium: 40, low: 10 } as const;
const WEIGHTS = { critical: 40, high: 15, medium: 5, low: 1 } as const;

export function computeSummary(trust: ServerTrust[]): ScanSummary {
  const counts: SummaryCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  let attested = 0;
  for (const t of trust) {
    for (const f of t.findings) counts[f.severity]++;
    if (t.tier >= 2) attested++;
  }
  const penalty =
    Math.min(counts.critical * WEIGHTS.critical, CAPS.critical) +
    Math.min(counts.high * WEIGHTS.high, CAPS.high) +
    Math.min(counts.medium * WEIGHTS.medium, CAPS.medium) +
    Math.min(counts.low * WEIGHTS.low, CAPS.low);
  const riskScore = clamp(100 - penalty, 0, 100);
  const coverageScore = trust.length
    ? Math.round((attested / trust.length) * 100)
    : 0;
  return { riskScore, coverageScore, grade: toGrade(riskScore), counts };
}

export function toGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
