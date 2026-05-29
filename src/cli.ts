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
import { discoverCapabilities } from "./discovery/capabilities.js";
import { fetchEnrichments } from "./enrichments/index.js";
import { analyze } from "./engine/index.js";
import { getDemoInputs } from "./demo.js";
import type {
  CapabilityTrust,
  Finding,
  PositiveFlag,
  ScanResult,
  ServerTrust,
} from "./types.js";

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
  demo: boolean;
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
  .option("--demo", "run against a baked-in synthetic surface — no install, no network, no setup", false)
  .action(async (opts: ScanOpts) => {
    if (opts.demo) {
      const demo = getDemoInputs();
      const result = analyze(demo.servers, undefined, {
        enrichments: demo.enrichments,
        capabilities: demo.capabilities,
      });
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        process.exit(exitCodeFor(result));
      }
      console.log("");
      console.log(
        pc.dim("  [demo mode] · synthetic data; nothing on your machine was scanned."),
      );
      renderTerminal(result);
      process.exit(exitCodeFor(result));
    }

    const discoverOpts: { projectRoot?: string } = {};
    if (opts.project !== undefined) discoverOpts.projectRoot = opts.project;
    const [servers, capabilities] = await Promise.all([
      discoverServers(discoverOpts),
      discoverCapabilities(discoverOpts),
    ]);

    if (servers.length === 0 && capabilities.length === 0) {
      if (opts.json) {
        process.stdout.write(
          JSON.stringify({
            servers: [],
            capabilities: [],
            note: "no MCP configs and no Claude Code / Cursor capability configs found",
          }) + "\n",
        );
      } else {
        console.log("");
        console.log(
          pc.dim("  No agent configs found on this machine."),
        );
        console.log(
          pc.dim("  Checked: Claude Desktop · Cursor · Claude Code (MCP + native)."),
        );
        console.log("");
      }
      process.exit(0);
    }

    const enrichments = opts.enrich !== false
      ? await fetchEnrichments(servers)
      : undefined;
    const analyzeOpts: { enrichments?: typeof enrichments; capabilities: typeof capabilities } = {
      capabilities,
    };
    if (enrichments) analyzeOpts.enrichments = enrichments;
    const result = analyze(servers, undefined, analyzeOpts);

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
  for (const c of result.capabilities) byClient.set(c.client, byClient.get(c.client) ?? 0);

  const { riskScore, coverageScore, grade, counts } = result.summary;
  const attested = result.trust.filter((t) => t.tier >= 2).length;

  console.log("");
  console.log(
    `  ${pc.bold("ax-ray")}  ${pc.dim(`v${program.version()}`)}   ${pc.dim(
      `· ${result.servers.length} MCP server${result.servers.length === 1 ? "" : "s"} · ${result.capabilities.length} client config${result.capabilities.length === 1 ? "" : "s"} · ${byClient.size} client${byClient.size === 1 ? "" : "s"} · mode: ${result.mode}`,
    )}`,
  );
  const riskBar = bar(riskScore, 18);
  const coverageBar = bar(coverageScore, 18);
  const totalSubjects = Math.max(1, result.servers.length);
  console.log(
    `  ${pc.bold("TRUST")}    ${pad(riskScore, 3)} / 100  (${gradeColor(grade)(grade)})   ${riskBar}` +
      `     ${pc.bold("COVERAGE")} ${pad(coverageScore, 3)} / 100   ${attested} / ${totalSubjects} attested  ${coverageBar}`,
  );
  console.log("");

  // Agent-client capability summary — surfaces native (non-MCP) surface.
  if (result.capabilityTrust.length > 0) {
    console.log(`  ${pc.cyan("AGENT CLIENTS")}`);
    for (const ct of result.capabilityTrust) {
      const cap = result.capabilities.find((c) => c.configPath === ct.configPath);
      const hooks = cap?.hooks.length ?? 0;
      const allow = cap?.permissions.allow.length ?? 0;
      const dirs = cap?.permissions.additionalDirectories.length ?? 0;
      const positives =
        ct.positiveFlags.length > 0 ? "  " + flagLine(ct.positiveFlags) : "";
      const headline = `${ct.client} · ${ct.scope}`;
      console.log(
        `    ${pc.cyan("●")}  ${pc.bold(headline.padEnd(22))}  ${pc.dim(
          `${hooks} hook(s) · ${allow} allow · ${dirs} extra dir(s) · grade ${gradeColor(ct.grade)(ct.grade)}`,
        )}${positives}`,
      );
      console.log(`        ${pc.dim(shortenPath(ct.configPath))}`);
    }
    console.log("");
  }

  const positiveServers = result.trust.filter(
    (t) => t.positiveFlags.length > 0 && t.findings.every((f) => f.severity === "info"),
  );
  if (positiveServers.length > 0) {
    console.log(`  ${pc.green("OK / ATTESTED  (MCP servers)")}`);
    for (const t of positiveServers) {
      console.log(
        `    ${pc.green("✓")}  ${pc.bold(t.server.padEnd(22))}  ${flagLine(t.positiveFlags)}`,
      );
    }
    console.log("");
  }

  const allFindings = [
    ...result.trust.flatMap((t) =>
      t.findings.map((f) => ({ subject: t.server, finding: f })),
    ),
    ...result.capabilityTrust.flatMap((c) =>
      c.findings.map((f) => ({ subject: subjectLabel(c), finding: f })),
    ),
  ];

  for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
    const rows = allFindings.filter((r) => r.finding.severity === sev);
    if (rows.length === 0) continue;
    console.log(`  ${sevHeader(sev)}`);
    for (const { subject, finding } of rows) {
      console.log(
        `    ${sevIcon(sev)}  ${pc.bold(subject)}${finding.subject ? pc.dim(" › ") + finding.subject : ""}  ${pc.dim(`[${finding.id}]`)}`,
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
}

function subjectLabel(c: CapabilityTrust): string {
  return `${c.client}:${c.scope}`;
}

function shortenPath(p: string): string {
  const home = process.env["HOME"];
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
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
