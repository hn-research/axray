#!/usr/bin/env node
/**
 * ax-ray CLI. Day-1 wiring:
 *
 *   discoverServers() → fetchEnrichments() → analyze() → terminal / --json
 *
 * Checks land Day 2/3 inside the engine; the CLI surface is stable from
 * Day 1 so we don't churn it later.
 */

import { Command } from "commander";
import pc from "picocolors";
import { discoverServers } from "./discovery/index.js";
import { fetchEnrichments } from "./enrichments/index.js";
import { analyze } from "./engine/index.js";

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
  enrich?: boolean; // --no-enrich sets this to false
}

program
  .command("scan", { isDefault: true })
  .description(
    "Scan local MCP configs (static by default; --connect for deep mode)",
  )
  .option("--connect", "deep mode: introspect tools/list (Day 3)", false)
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
      process.exit(0);
    }

    renderTerminal(result, enrichments);
    process.exit(0);
  });

function renderTerminal(
  result: ReturnType<typeof analyze>,
  enrichments: Awaited<ReturnType<typeof fetchEnrichments>> | undefined,
): void {
  const byClient = new Map<string, number>();
  for (const s of result.servers)
    byClient.set(s.source, (byClient.get(s.source) ?? 0) + 1);

  console.log("");
  console.log(
    `  ${pc.bold("ax-ray")}  ${pc.dim(`v${program.version()}`)}   ${pc.dim(
      `· ${result.servers.length} server${result.servers.length === 1 ? "" : "s"} across ${byClient.size} client${byClient.size === 1 ? "" : "s"} · mode: ${result.mode}`,
    )}`,
  );
  console.log("");

  for (const s of result.servers) {
    const transport = pc.dim(`[${s.transport.padEnd(5)}]`);
    const enr = enrichments?.get(s.name)?.npm;
    const tail = enr
      ? pc.dim(
          `  ${enr.name}${enr.latest ? "@" + enr.latest : ""}${enr.repository ? "  ·  " + cleanRepo(enr.repository) : ""}`,
        )
      : "";
    const sourceLabel = s.scope ? `${s.source} · ${shortenPath(s.scope)}` : s.source;
    console.log(
      `  ${transport}  ${pc.bold(s.name.padEnd(20))}  ${pc.dim(`(${sourceLabel})`)}${tail}`,
    );
  }
  console.log("");
  console.log(
    pc.dim(
      "  Day-1 build: discovery only. Checks (S1–S6, D1–D3) land Day 2/3.",
    ),
  );
  console.log("");
}

function shortenPath(p: string): string {
  const home = process.env["HOME"];
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}

function cleanRepo(url: string): string {
  return url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^https?:\/\//, "");
}

program.parseAsync(process.argv);
