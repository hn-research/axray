#!/usr/bin/env node
/**
 * ax-ray CLI.
 *
 *   discoverServers() → fetchEnrichments() → analyze() → terminal / --json
 *
 * The terminal renderer is dual-surfaced (positive ATTESTED block above
 * SEVERITY-grouped findings) so the same scan reads as "discover what's
 * good" + "see what's risky" in one screen.
 */

import { Command } from "commander";
import pc from "picocolors";
import { discoverServers } from "./discovery/index.js";
import { fetchEnrichments } from "./enrichments/index.js";
import { analyze } from "./engine/index.js";
import type { Finding, PositiveFlag, ScanResult, ServerTrust } from "./types.js";

const program = new Command();

program
  .name("ax-ray")
  .description(
    "See what your AI agents can actually do — and find the tools worth trusting.",
  )
  .version("0.0.0");

interface ScanOpts {
  connect: boolean;
  json: boolean;
  project?: string;
  enrich?: boolean;
}

program
  .command("scan", { isDefault: true })
  .description(
    "Scan local MCP configs (static by default; --connect for deep mode)",
  )
  .option("--connect", "deep mode: introspect tools/list", false)
  .option("--json", "machine-readable output", false)
  .option(
    "--project <path>",
    "project root for project-local configs (default: cwd)",
  )
  .option("--no-enrich", "skip npm/registry enrichments")
  .action(async (opts: ScanOpts) => {
    const discoverOpts: { projectRoot?: string } = {};
    if (opts.project !== undefined) discoverOpts.projectRoot = opts.project;
    const servers = await discoverServers(discoverOpts);

    if (servers.length === 0) {
      if (opts.json) {
        process.stdout.write(
          JSON.stringify({ servers: [], note: "no MCP configs found" }) + "\n",
        );
      } else {
        console.log("");
        console.log(pc.dim("  No MCP configs found on this machine."));
        console.log(
          pc.dim("  Checked: Claude Desktop · Cursor · Claude Code."),
        );
        console.log("");
      }
      process.exit(0);
    }

    const enrichments = opts.enrich !== false
      ? await fetchEnrichments(servers)
      : undefined;
    const result = analyze(
      servers,
      undefined,
      enrichments ? { enrichments } : {},
    );

    if (opts.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      process.exit(exitCodeFor(result));
    }

    renderTerminal(result);
    process.exit(exitCodeFor(result));
  });

function exitCodeFor(r: ScanResult): number {
  if (r.summary.counts.critical > 0) return 2;
  if (r.summary.counts.high > 0) return 1;
  return 0;
}

function renderTerminal(result: ScanResult): void {
  const byClient = new Map<string, number>();
  for (const s of result.servers)
    byClient.set(s.source, (byClient.get(s.source) ?? 0) + 1);

  const { riskScore, coverageScore, grade, counts } = result.summary;
  const totalTools = 0; // populated in deep mode
  const attested = result.trust.filter((t) => t.tier >= 2).length;

  console.log("");
  console.log(
    `  ${pc.bold("ax-ray")}  ${pc.dim(`v${program.version()}`)}   ${pc.dim(
      `· ${result.servers.length} server${result.servers.length === 1 ? "" : "s"} across ${byClient.size} client${byClient.size === 1 ? "" : "s"} · mode: ${result.mode}`,
    )}`,
  );
  const riskBar = bar(riskScore, 18);
  const coverageBar = bar(coverageScore, 18);
  console.log(
    `  ${pc.bold("RISK")}     ${pad(riskScore, 3)} / 100  (${gradeColor(grade)(grade)})   ${riskBar}` +
      `     ${pc.bold("COVERAGE")} ${pad(coverageScore, 3)} / 100   ${attested} / ${result.servers.length} attested  ${coverageBar}`,
  );
  console.log("");

  const positiveServers = result.trust.filter(
    (t) => t.positiveFlags.length > 0 && t.findings.every((f) => f.severity === "info"),
  );
  if (positiveServers.length > 0) {
    console.log(`  ${pc.green("OK / ATTESTED")}`);
    for (const t of positiveServers) {
      console.log(
        `    ${pc.green("✓")}  ${pc.bold(t.server.padEnd(22))}  ${flagLine(t.positiveFlags)}`,
      );
    }
    console.log("");
  }

  for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
    const rows = result.trust.flatMap((t) =>
      t.findings
        .filter((f) => f.severity === sev)
        .map((f) => ({ trust: t, finding: f })),
    );
    if (rows.length === 0) continue;
    console.log(`  ${sevHeader(sev)}`);
    for (const { trust, finding } of rows) {
      console.log(
        `    ${sevIcon(sev)}  ${pc.bold(trust.server)}${finding.subject ? pc.dim(" › ") + finding.subject : ""}  ${pc.dim(`[${finding.id}]`)}`,
      );
      console.log(`        ${finding.title}`);
      for (const e of finding.evidence) {
        console.log(`        ${pc.dim("·")} ${pc.dim(e)}`);
      }
      console.log(`        ${pc.dim("→")} ${pc.dim(finding.remediation)}`);
    }
    console.log("");
  }

  console.log(
    pc.dim(
      `  ${counts.critical} crit · ${counts.high} high · ${counts.medium} med · ${counts.low} low · ${counts.info} info`,
    ),
  );
  console.log("");
  // Suppress unused-var warning until deep mode populates per-tool counts.
  void totalTools;
}

function flagLine(flags: PositiveFlag[]): string {
  return flags
    .map((f) => pc.dim(`${f.id} ${f.label}`))
    .join(pc.dim("  ·  "));
}

function sevHeader(s: Finding["severity"]): string {
  if (s === "critical") return pc.bold(pc.red("CRITICAL"));
  if (s === "high") return pc.bold(pc.yellow("HIGH"));
  if (s === "medium") return pc.bold(pc.magenta("MEDIUM"));
  if (s === "low") return pc.dim(pc.bold("LOW"));
  return pc.dim("INFO");
}

function sevIcon(s: Finding["severity"]): string {
  if (s === "critical") return pc.red("✗");
  if (s === "high") return pc.yellow("✗");
  if (s === "medium") return pc.magenta("⚠");
  if (s === "low") return pc.dim("·");
  return pc.dim("ℹ");
}

function gradeColor(g: ServerTrust["grade"]) {
  if (g === "A") return pc.green;
  if (g === "B") return pc.green;
  if (g === "C") return pc.yellow;
  if (g === "D") return pc.red;
  return pc.red;
}

function bar(score: number, width: number): string {
  const filled = Math.round((score / 100) * width);
  const head = "▓".repeat(Math.max(0, Math.min(width, filled)));
  const tail = "░".repeat(Math.max(0, width - head.length));
  return pc.dim(head + tail);
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, " ");
}

program.parseAsync(process.argv);
