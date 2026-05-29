/**
 * Expanded remediation templates, one per check id.
 *
 * The per-finding `remediation` field on each Finding is a single
 * sentence — what shows in the default report. These templates carry
 * the longer-form *what to change, where to change it, how to verify*
 * version that surfaces under `--how-to-fix`.
 *
 * Variables in templates use `${name}` and get filled from the Finding
 * / ServerSpec at render time. See `remediation/index.ts`.
 *
 * Keep the prose concrete, action-first, and grounded in evidence the
 * report already shows. No moralizing, no general principles —
 * specifically what to change.
 */

export interface RemediationTemplate {
  /** Multi-line block describing how to fix. */
  fix: string;
  /** Optional one-line command or check to verify the fix landed. */
  verify?: string;
}

export const TEMPLATES: Record<string, RemediationTemplate> = {
  // ── MCP servers ───────────────────────────────────────────────
  S1: {
    fix:
      "Move the matched secret out of the MCP config:\n" +
      "  - macOS: `security add-generic-password -s <service> -a <user> -w '<token>'`\n" +
      "    and reference via a launcher script, not in-config.\n" +
      "  - Or put it in an env file with mode 600 and source it before launching the client.\n" +
      "Then `chmod 600 ${configPath}` to remove world/group read.",
    verify: "re-run `ax-ray`; S1 should clear for ${server}.",
  },
  S2: {
    fix:
      "Edit ${configPath} and replace the filesystem root with a project subdirectory:\n" +
      "  - prefer `/Users/<you>/code/<project>` over `$HOME` or `/`.\n" +
      "  - if multiple projects need access, run one filesystem server instance per project.",
    verify: "re-run `ax-ray`; S2 should clear and P5 should fire.",
  },
  S3: {
    fix:
      "Replace the shell/docker/sudo wrapper with a direct package-manager launcher:\n" +
      "  - `npx -y @scope/pkg@<version>`, `uvx <pkg>==<version>`, or `pipx run <pkg>`.\n" +
      "  - If a wrapper script is genuinely needed, commit it to a known location\n" +
      "    and reference it by absolute path so it's reviewable.",
  },
  S4: {
    fix:
      "Pin the package to a known-good version:\n" +
      "  - inspect available versions: `npm view ${npmName} versions --json | tail`\n" +
      "  - update the launcher: `npx -y ${npmName}@<version>`.\n" +
      "If the source is `github:` or a raw git URL, publish to a registry instead.",
    verify: "re-run `ax-ray`; S4 should clear and P3 should fire if current.",
  },
  S5: {
    fix:
      "Switch the remote endpoint to https:// (and a DNS name, not a raw IP):\n" +
      "  - if the upstream truly lacks TLS, terminate it in a local reverse proxy\n" +
      "    (caddy, traefik, or even a one-line stunnel) and point the MCP at the proxy.",
  },
  S6: {
    fix:
      "If you maintain this server: publish a security manifest at\n" +
      "  https://<your-domain>/.well-known/mcp-security.json\n" +
      "with a DNS-validated identity and signature. See SPEC.md §7.\n" +
      "If you don't maintain it: this finding stays info-level until the\n" +
      "publisher adopts the manifest.",
  },
  S7: {
    fix:
      "Anthropic has blocklisted ${server}. Action:\n" +
      "  1. open Claude Desktop → Settings → Extensions\n" +
      "  2. uninstall ${server}\n" +
      "  3. delete the install directory if anything remains:\n" +
      "     `rm -rf '${extensionDir}'`",
    verify: "re-run `ax-ray`; S7 should clear once the install footprint is gone.",
  },

  // ── Agent client capabilities ─────────────────────────────────
  C1: {
    fix:
      "Open ${configPath} and audit the `hooks` block:\n" +
      "  - read each hook's command; if surprising, delete it.\n" +
      "  - if a hook is intentional, document why next to it (a `_comment` field).\n" +
      "  - never accept hook commands from a project repo without reading them first.",
  },
  C2: {
    fix:
      "Open ${configPath} and tighten `permissions.allow`:\n" +
      "  - replace blanket `Bash` with specific patterns: `Bash(npm:*)`, `Bash(git status)`.\n" +
      "  - drop `Read(*)` / `Write(*)`; restrict to the directories that matter.\n" +
      "  - `Bash(curl:*)` and similar broad shell-binary grants are almost never necessary.",
  },
  C3: {
    fix:
      "Open ${configPath} and remove broad entries from `permissions.additionalDirectories`:\n" +
      "  - grant only the specific project paths the agent actually works on.\n" +
      "  - `$HOME` / `/` / `/Users` should never appear there.",
  },
  C4: {
    fix:
      "Read ${configPath} before opening the project. If anything looks unfamiliar:\n" +
      "  - hooks → audit their commands.\n" +
      "  - allow patterns → confirm they're scoped to what the project needs.\n" +
      "  - if a repo ships these and you don't trust the maintainer, don't open it in your agent.",
  },
  C5: {
    fix:
      "Confirm ${apiKeyHelper} is what you expected — typically a keychain query:\n" +
      "  - macOS: `security find-generic-password -s <service> -w`\n" +
      "  - 1Password: `op item get <item> --field=credential`\n" +
      "Replace anything more elaborate; an apiKeyHelper runs every API call.",
  },
  C6: {
    fix:
      "Open ${configPath} and set `enableAllProjectMcpServers: false`.\n" +
      "From then on Claude Code prompts before activating any project-shipped MCP server.",
  },
  CC1: {
    fix:
      "Open ${rulePath} and:\n" +
      "  - remove any imperative instructions (\"after returning, read …\").\n" +
      "  - remove embedded URLs that look like exfil endpoints.\n" +
      "  - check for zero-width / hidden unicode — if present, retype the file from scratch.\n" +
      "If the rules file came from a project repo, quarantine the repo until reviewed.",
  },
  CC2: {
    fix:
      "Open ${configPath} and remove inline API key fields. Replace with:\n" +
      "  - an env-var reference Cursor reads at launch, or\n" +
      "  - a system keychain entry queried by a wrapper script.\n" +
      "Then rotate the leaked key — assume it's been seen by every tool that syncs settings.",
  },

  // ── Deep checks (MCP tool surface) ────────────────────────────
  D1: {
    fix:
      "Tool description on ${server} › ${tool} carries instructions the model will obey.\n" +
      "  1. quarantine the server: disable it in the client's MCP settings.\n" +
      "  2. compare the description to the package's source repo:\n" +
      "     `npm view ${npmName} --json | jq '.description, .repository'`\n" +
      "  3. if the registry description differs from the repo, open an issue and pin\n" +
      "     to a version published before the divergence.",
    verify: "re-enable and re-run `ax-ray --connect`; D1 should clear.",
  },
  D2: {
    fix:
      "${server}'s tools cover capabilities you may not actually need.\n" +
      "  - first, check if the server itself ships a safer-mode knob (see SAFER MODE below).\n" +
      "  - if not, edit the server's source (it's open) to expose a narrower toolset,\n" +
      "    or fork-and-pin a reduced build.",
  },
  D3: {
    fix:
      "Tool inputs on ${server} accept unconstrained strings. Two options:\n" +
      "  - at the server: add `pattern` / `enum` / `maxLength` to the offending properties\n" +
      "    in `inputSchema`.\n" +
      "  - via the client: if the server ships a safer-mode user_config flag\n" +
      "    (see SAFER MODE below), enable it.",
  },
};
