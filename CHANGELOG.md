# Changelog

## 0.1.0 — initial public release

First shippable version.

### Discovery
- Claude Desktop: legacy `mcpServers` block + DXT (extensions-installations.json, per-extension settings, blocklist).
- Cursor: global `User/settings.json`, `.cursor/mcp.json`, project `.cursorrules` and `.cursor/rules/*.{mdc,md,txt}`.
- Claude Code: global `~/.claude.json` (with per-project `mcpServers` map), `.claude/settings(.local).json`, project `.mcp.json` and `.claude/settings(.local).json`.
- Cline (saoudrizwan.claude-dev) in VS Code / Cursor / VSCodium / Insiders / Windsurf hosts: MCP settings + `cline_custom_instructions.md`.
- Continue.dev: `~/.continue/config.json` (both `mcpServers` and `experimental.modelContextProtocolServers` shapes), `systemMessage`, `~/.continue/rules/*`.
- npm enrichment with packument + weekly downloads.

### Findings
- S1–S7: secrets / world-readable config, over-broad fs root, dangerous launch, supply-chain risk, insecure remote, manifest absence, vendor blocklist hit.
- C1–C6, CC1–CC2: lifecycle hooks, permissive allowlists, broad additionalDirectories, project-shipped permissions, apiKeyHelper visibility, enableAllProjectMcpServers, rule-file content scanning, inline API key in client settings.
- D1–D3: tool-description poisoning, dangerous capability surface (exec / destructive / fs-write / network / credential), over-permissive tool inputs.
- Positive flags P1, P2, P3, P4, P5, P7, CP1, CP2.

### CLI
- `--connect` deep mode (MCP `tools/list` only; 15 s per-server timeout; bounded concurrency).
- `--how-to-fix` expanded remediation with publisher-declared safer-mode hints derived from each server's `user_config`.
- `--demo` baked-in synthetic surface (no install, no network).
- `--verbose` SCAN COVERAGE catalog.
- `--debug` lists unread config-shaped files near our targets.
- `--json` machine-readable output. CI exit codes 0 / 1 / 2.

### Engine
- Reusable `analyze()` pure function. No I/O inside the engine.
- Mode label (`static` / `deep`) reflects user opt-in, decoupled from D-check execution (DXT manifest tools light up D-checks in `static` mode).
- TRUST and COVERAGE scores; per-server / per-capability grades; cross-finding dedup for file-level findings.
