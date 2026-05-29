# Contributing to ax-ray

Thanks for looking. ax-ray works by discovering agent-client configurations on the local machine, then running a fixed catalog of checks against them. This file is the map.

## Project shape

```
src/
  types.ts                       canonical wire types (ServerSpec, ClientCapability, ...)
  discovery/
    path-map.ts                  ⟵ single source of truth: every file/dir ax-ray reads
    common.ts                    shared mcpServers parser
    io.ts                        readJsonIfExists, findUp
    clients/                     one file per agent client
    capabilities.ts              top-level capability discovery aggregator
    index.ts                     top-level server + manifest-tools discovery aggregator
    unknown-configs.ts           --debug helper (lists unread JSON near our targets)
  enrichments/                   npm / GitHub / registry lookups (pre-fetched, then frozen)
  checks/
    static/                      S1–S6 — MCP server findings (no execution required)
    positive/                    P1, P2, P3, P5, P7 — MCP server positive flags
    capability/                  C1–C6, CC1–CC2, CP1–CP2 — agent-client findings
    deep/                        D1–D3, P4 — MCP tool-surface findings (manifest or live)
  introspect/                    --connect transports + orchestrator
  engine/                        analyze() — pure function; no I/O
  cli.ts                         single binary entry point
tests/                           node:test against pure check functions + fixtures
SPEC.md                          design + tiered trust model + scoring formula
```

## The path contract

**Every file path ax-ray reads is listed in `src/discovery/path-map.ts`.** That file is the single source of truth. When you add a new client adapter:

1. Add one or more `KnownPath` rows to `KNOWN_PATHS`.
2. Implement the adapter in `src/discovery/clients/<your-client>.ts` (and `<your-client>-native.ts` if it has non-MCP surface).
3. Wire the adapter into `src/discovery/index.ts` (MCP servers) and/or `src/discovery/capabilities.ts` (native capabilities).
4. Extend `CLIENT_MATRIX` in `src/cli.ts` so `--verbose` and `--debug` know about it.

That's the whole protocol. The `--debug` flag will then automatically include the new path in its known-file list.

## Adding a new check

Static check (`S*`), positive flag (`P*`/`CP*`), agent-client check (`C*` / `CC*`), or deep check (`D*`):

1. Add a single file under `src/checks/<group>/<id>-<short-name>.ts`.
2. Export a pure function matching the corresponding type in `src/checks/types.ts` (or `src/checks/capability/types.ts` / `src/checks/deep/types.ts`).
3. Register it in the matching `index.ts` so the engine runs it.
4. Add tests under `tests/`. Pure-function tests are the norm; integration tests use temp-dir fixtures.

Findings must include:
- a stable `id` (S1, S2, ...) so the verbose catalog can reference it
- `evidence: string[]` — strings the user can re-verify from public sources
- `remediation: string` — a concrete fix, not a general principle

## What ax-ray must NOT do

These constraints are load-bearing for the tool's trust posture:

- **No reading of app-state directories.** Cookies, Session Storage, IndexedDB, Crashpad dumps, telemetry payloads — these live alongside config files in some client support directories. ax-ray's path map only enumerates *config* files. Adapters must read named targets, not walk parent directories.
- **No `tools/call`.** Deep mode (`--connect`) calls `tools/list` only. Never invoke a tool.
- **No silent network.** Enrichments (npm/GitHub lookups) and `--connect` are the only outbound traffic. Anything else needs an explicit opt-in flag.
- **No black-box scoring.** The scoring formula is in `src/engine/scoring.ts`, documented in `SPEC.md` §6, and reproducible from the report.

## Development workflow

```sh
npm install
npm run dev                  # scan this machine
npm run dev -- --demo        # synthetic baked-in surface
npm run dev -- --debug       # adds the unknown-configs report
npm run dev -- --verbose     # adds the SCAN COVERAGE catalog
npx tsc --noEmit             # typecheck
node --test --import tsx ./tests/*.test.ts   # tests
```

## Commit style

One-line subject summarizing the change in functional/technical terms. No bullets, no trailers, no co-author lines.
