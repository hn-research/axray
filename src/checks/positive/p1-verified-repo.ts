/**
 * P1 — Package resolves to a credible source repo.
 *
 * Tier-1 signal: npm metadata has a non-empty `repository` field that
 * parses to a known code-hosting origin (GitHub, GitLab, Bitbucket,
 * Codeberg, sourcehut). No remote fetch is performed — presence and
 * shape of the URL is the observation.
 */

import type { PositiveFlag, ServerSpec } from "../../types.js";
import type { CheckCtx, PositiveCheck } from "../types.js";

const KNOWN_FORGES = new Set<string>([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "codeberg.org",
  "git.sr.ht",
]);

export const p1VerifiedRepo: PositiveCheck = (
  server: ServerSpec,
  ctx: CheckCtx,
): PositiveFlag[] => {
  const npm = ctx.enrichments?.get(server.name)?.npm;
  if (!npm?.repository) return [];
  const url = normalizeRepoUrl(npm.repository);
  if (!url) return [];
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return [];
  }
  if (!KNOWN_FORGES.has(host)) return [];
  return [
    {
      id: "P1",
      server: server.name,
      label: "source repo resolves",
      detail: `package's npm metadata points to a public repo on ${host}.`,
      signal: `npm:repository=${url}`,
    },
  ];
};

function normalizeRepoUrl(raw: string): string | undefined {
  let u = raw.trim();
  u = u.replace(/^git\+/, "").replace(/\.git$/, "");
  if (u.startsWith("git@")) {
    // git@host:user/repo → https://host/user/repo
    const m = /^git@([^:]+):(.+)$/.exec(u);
    if (m) u = `https://${m[1]}/${m[2]}`;
  } else if (u.startsWith("ssh://")) {
    u = u.replace(/^ssh:\/\/(?:[^@]+@)?/, "https://");
  } else if (!/^https?:\/\//.test(u)) {
    return undefined;
  }
  return u;
}
