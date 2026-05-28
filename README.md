# `mcp-xray`

> **See what your AI agents can actually do — and find the MCP servers worth trusting.**

```sh
npx mcp-xray
```

`mcp-xray` discovers the MCP servers configured for your agent clients
(Claude Desktop, Cursor, Claude Code), introspects their tools
**read-only**, and shows you the real picture — both what's risky on
your machine *and* what's well-attested.

It does this without certifying anything. Every claim it makes you can
re-verify from public sources. Trust is in the math and the open
methodology, not in us.

## What you'll see

- A **risk score** — secrets in your config, tools that can do dangerous
  things, hidden instructions in tool descriptions ("tool poisoning").
- A **coverage score** — which servers are well-attested by independent
  signals (popular npm packages, real source repos, scoped installs).
- A **shareable report** you can act on in five minutes.

Read [SPEC.md](./SPEC.md) for the full design, the tiered trust model,
and the v0.1 build plan.

## Status

v0.1, in active construction. Part of the [Glasshouse](https://glasshouse.dev)
open trust layer for MCP.

## License

Apache-2.0.
