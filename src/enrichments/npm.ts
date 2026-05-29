/**
 * npm-registry enrichment. v0.1 fetches the packument (name, versions,
 * latest tag, repo, homepage). Weekly downloads add Day 2 when P2
 * (adoption) needs them.
 *
 * Best-effort: any network/parse error yields `undefined`. The engine still
 * runs without enrichments (Tier-1 facts only).
 */

import type { ServerEnrichment, ServerSpec } from "../types.js";

const NPM_REGISTRY = "https://registry.npmjs.org";

interface RawPackument {
  name?: string;
  versions?: Record<string, unknown>;
  "dist-tags"?: { latest?: string };
  repository?: { url?: string } | string;
  homepage?: string;
}

export async function fetchNpmPackuments(
  servers: ServerSpec[],
  signal?: AbortSignal,
): Promise<Map<string, ServerEnrichment>> {
  const out = new Map<string, ServerEnrichment>();
  // Dedupe by package name (multiple servers can share a package).
  const pending = new Map<string, Promise<ServerEnrichment["npm"] | undefined>>();
  for (const s of servers) {
    const pkg = s.packageHints?.npm;
    if (!pkg) continue;
    if (!pending.has(pkg)) pending.set(pkg, fetchOne(pkg, signal));
  }
  for (const s of servers) {
    const pkg = s.packageHints?.npm;
    if (!pkg) continue;
    const npm = await pending.get(pkg);
    if (npm) out.set(s.name, { server: s.name, npm });
  }
  return out;
}

async function fetchOne(
  pkg: string,
  signal?: AbortSignal,
): Promise<ServerEnrichment["npm"] | undefined> {
  try {
    // npm registry accepts both @scope/pkg and unscoped names unencoded.
    const init: RequestInit = { headers: { Accept: "application/json" } };
    if (signal) init.signal = signal;
    const r = await fetch(`${NPM_REGISTRY}/${pkg}`, init);
    if (!r.ok) return undefined;
    const body = (await r.json()) as RawPackument;
    const repo =
      typeof body.repository === "string"
        ? body.repository
        : body.repository?.url;
    const npm: ServerEnrichment["npm"] = {
      name: body.name ?? pkg,
      versions: body.versions ? Object.keys(body.versions) : [],
    };
    if (body["dist-tags"]?.latest !== undefined) {
      npm.latest = body["dist-tags"].latest;
    }
    if (repo !== undefined) npm.repository = repo;
    if (body.homepage !== undefined) npm.homepage = body.homepage;
    return npm;
  } catch {
    return undefined;
  }
}
