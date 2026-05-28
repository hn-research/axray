#!/usr/bin/env node
/**
 * `mcp-xray` CLI entry. Day-1 stub — wired up so `npm run dev` works
 * the moment dependencies are installed; the actual command tree lands
 * in subsequent commits per SPEC.md §11 (Build plan).
 */

import { Command } from "commander";

const program = new Command();

program
  .name("mcp-xray")
  .description(
    "See what your AI agents can actually do — and find MCP servers worth trusting.",
  )
  .version("0.0.0");

program
  .command("scan", { isDefault: true })
  .description("Scan local MCP configs (static; --connect for deep mode)")
  .option("--connect", "deep mode: launch stdio servers / connect to remote and introspect tools/list", false)
  .option("--json", "machine-readable output", false)
  .action((_opts) => {
    console.log("mcp-xray v0.0.0 — not implemented yet. See SPEC.md.");
    process.exit(0);
  });

program.parseAsync(process.argv);
