# `ax-ray`

> **See what your AI agents can actually do — and find the MCP servers and clients worth trusting.**

```sh
npx ax-ray
```

`ax-ray` discovers the MCP servers and agent-client capability surfaces
configured on your machine — Claude Desktop (legacy + DXT extensions),
Cursor, Claude Code, Cline, Continue — introspects them **read-only**,
and shows you the real picture: what's risky, what's well-attested, and
what concrete change would narrow the surface.

It does this without certifying anything. Every claim it makes you can
re-verify from public sources. Trust is in the math and the open
methodology, not in us.

## What you see

- A **TRUST score** — secrets in your config, tools that can do dangerous
  things, hidden instructions in tool descriptions ("tool poisoning"),
  permissive agent-client allowlists, lifecycle hooks that run shell
  commands, project-shipped rules with prompt-injection patterns.
- A **COVERAGE score** — which servers are well-attested by independent
  signals (popular npm packages, real source repos, scoped filesystem
  installs, Claude Desktop DXT directory installs).
- An **OK / ATTESTED band** alongside findings — same scan, both sides.
- A **HOW TO FIX** surface (opt-in) — per-finding remediation, including
  publisher-declared safer-mode knobs (e.g. an MCP server's manifest
  exposes `ALLOW_ONLY_READONLY_TOOLS` you haven't enabled).

See [SPEC.md](./SPEC.md) for the design, the tiered trust model, the
scoring formula, and the check catalog. See
[CONTRIBUTING.md](./CONTRIBUTING.md) to add a new client adapter or
check.

## Usage

```sh
ax-ray [scan] [options]
```

`scan` is the default subcommand and may be omitted.

### Flags

| Flag | Default | What it does |
|---|---|---|
| `--connect` | `false` | **Deep mode.** Opens each discovered MCP server (stdio via spawn, SSE/HTTP via network), calls `tools/list` only — never `tools/call` — under a 15-second per-server timeout. Enables checks D1, D2, D3, P4 against live tool descriptions and input schemas. |
| `--json` | `false` | Machine-readable output. Writes the full `ScanResult` JSON to stdout instead of the terminal report. Exit code semantics unchanged. |
| `--project <path>` | `cwd` | Project root for project-local config walking (`.cursor/mcp.json`, `.mcp.json`, `.claude/settings.json`, `.cursorrules`, `.cursor/rules/*`). |
| `--no-enrich` | enrich on | Skip npm/registry lookups that feed positive flags P1 (verified repo), P2 (adoption), P3 (pinned + current). Mechanical static checks still fire. |
| `--demo` | `false` | Use baked-in synthetic data instead of scanning your machine. Pair with `--connect` to also activate the synthetic deep-mode tool surface. Nothing on your machine is read. |
| `-v`, `--verbose` | `false` | Append a **SCAN COVERAGE** section listing every client looked for (found / not-present) and the catalog of every S / P / C / CC / D check. |
| `--debug` | `false` | Append a **DEBUG** section listing config-shaped files near our targets that ax-ray did NOT read. Helps spot vendor-added configs we don't yet adapt. Does not recurse into app-state directories. |
| `--how-to-fix` | `false` | Append a **HOW TO FIX** section: per-finding remediation templates with variables interpolated from real data, plus dynamic **SAFER MODE** hints derived from each server's own `user_config` declaration. |
| `--version` | — | Print version and exit. |
| `-h`, `--help` | — | Print help and exit. |

### Exit codes

| Code | When |
|---|---|
| `0` | No findings above info-level. |
| `1` | At least one **high** finding (no criticals). |
| `2` | At least one **critical** finding. |

Suitable for CI gates: `npx ax-ray && <next-step>` blocks downstream on any high+ finding.

### Common recipes

```sh
# Default scan — static, fast, no spawn, no network reads of MCP servers.
ax-ray

# Same plus live MCP introspection (slower; spawns stdio servers).
ax-ray --connect

# Default + expanded per-finding remediation including safer-mode hints.
ax-ray --connect --how-to-fix

# Maximum visibility in one run.
ax-ray --connect --how-to-fix --verbose --debug

# Try the tool with no setup (synthetic data baked into the binary).
ax-ray --demo
ax-ray --demo --connect --how-to-fix

# Machine-readable output for piping into other tools or CI.
ax-ray --json
ax-ray --connect --json > scan.json

# CI gate — fail the build on any high+ finding.
ax-ray --connect || exit 1

# Scan a specific project root (walks up from there).
ax-ray --project ~/code/some-repo

# Fully offline — skip the npm registry lookups too.
ax-ray --no-enrich
```

## Trust posture

Five properties that make `ax-ray` safe to run on a whim:

- **Read-only.** Never calls `tools/call`. Never writes a file. Never modifies any config.
- **Local.** No telemetry. The only outbound network is to `registry.npmjs.org` for enrichment data and (under `--connect`) to remote MCP endpoints. Both are visible in code.
- **Reproducible.** The same input produces the same output. No LLM calls. The scoring formula is in [SPEC.md](./SPEC.md) §6 and re-derivable from the report.
- **Narrow.** Every file path the tool reads is enumerated in [`src/discovery/path-map.ts`](./src/discovery/path-map.ts). We never walk arbitrary app-state directories (Cookies, IndexedDB, telemetry).
- **No certification.** The report says "observed," "attested by N signals," "directory-installed" — never "verified" or "trusted." Trust is in the evidence the report shows, which the user can re-check.

## Status

v0.1, in active construction. The CLI half of an open trust layer for
MCP and agent clients — the umbrella brand for the upcoming registry /
insights site is TBD; the scanner stands on its own.

## License

Apache-2.0.
