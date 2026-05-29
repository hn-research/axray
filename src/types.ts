/**
 * Canonical types — see SPEC.md §2.
 *
 * Consumed by: the CLI today, the BigQuery indexer next (different caller,
 * same engine), and the registry verifier later. Keep this file the single
 * source of truth for the wire shapes.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type TrustTier = 0 | 1 | 2 | 3 | 4;

export type SourceClient =
  | "claude-desktop"
  | "cursor"
  | "claude-code"
  | "committed-repo"
  | (string & {});

export type Transport = "stdio" | "sse" | "http";

export interface PackageHints {
  npm?: string;
  pypi?: string;
  repo?: string;
}

export interface ServerSpec {
  /** Server key from the `mcpServers` block (e.g. "filesystem"). */
  name: string;
  source: SourceClient;
  transport: Transport;
  // stdio:
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // remote:
  url?: string;
  // provenance:
  configPath: string;
  /** File mode in octal, e.g. "644". Empty if not stat-able. */
  configPerms?: string;
  /**
   * Optional sub-context within the config file — e.g. the project path
   * when a server is nested under `projects.<path>.mcpServers` in Claude
   * Code's `~/.claude.json`. Free-form display string; not parsed.
   */
  scope?: string;
  packageHints?: PackageHints;
}

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: object;
}

export interface Finding {
  id: string; // "S1", "D1", ...
  severity: Severity;
  server: string;
  subject?: string;
  title: string;
  detail: string;
  remediation: string;
  /** Strings the user can re-verify (no opinion, just facts). */
  evidence: string[];
}

export interface PositiveFlag {
  id: string; // "P1", "P2", ...
  server: string;
  label: string;
  detail: string;
  signal: string;
}

export interface ServerTrust {
  server: string;
  tier: TrustTier;
  grade: Grade;
  positiveFlags: PositiveFlag[];
  findings: Finding[];
}

export interface SummaryCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ScanSummary {
  riskScore: number;
  coverageScore: number;
  grade: Grade;
  counts: SummaryCounts;
}

export interface ScanResult {
  scannedAt: string;
  mode: "static" | "deep";
  servers: ServerSpec[];
  trust: ServerTrust[];
  summary: ScanSummary;
}

/** Per-server enrichments from external sources (npm today; GitHub later). */
export interface ServerEnrichment {
  server: string;
  npm?: {
    name: string;
    versions: string[];
    latest?: string;
    repository?: string;
    homepage?: string;
  };
}

export type Enrichments = Map<string /* server.name */, ServerEnrichment>;
