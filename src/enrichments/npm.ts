/**
 * npm-registry enrichment.
 *
 * Two endpoints per package, fetched in parallel:
 *   - registry.npmjs.org/<pkg>                       — packument (name,
 *                                                     versions, latest,
 *                                                     repo, homepage)
 *   - api.npmjs.org/downloads/point/last-week/<pkg>  — weekly downloads
 *
 * Best-effort: any network/parse error yields `undefined` for that field;
 * partial enrichments are returned. The engine still runs without
 * enrichments (Tier-1 facts only).
 *
 * Packages are deduplicated across servers so a popular shared package is
 * fetched at most once per scan.
 */

import type { ServerEnrichment, ServerSpec } from "../types.js";

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";

interface RawPackument {
  name?: string;
  versions?: Record<string, unknown>;
  "dist-tags"?: { latest?: string };
  repository?: { url?: string } | string;
  homepage?: string;
}

interface RawDownloads {
  downloads?: number;
}

export async function fetchNpmPackuments(
  servers: ServerSpec[],
  signal?: AbortSignal,
): Promise<Map<string, ServerEnrichment>> {
  const out = new Map<string, ServerEnrichment>();
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
  const [packument, weekly] = await Promise.all([
    fetchPackument(pkg, signal),
    fetchWeeklyDownloads(pkg, signal),
  ]);
  if (!packument && weekly === undefined) return undefined;
  const npm: ServerEnrichment["npm"] = {
    name: packument?.name ?? pkg,
    versions: packument?.versions ? Object.keys(packument.versions) : [],
  };
  if (packument?.["dist-tags"]?.latest !== undefined) {
    npm.latest = packument["dist-tags"].latest;
  }
  const repo =
    typeof packument?.repository === "string"
      ? packument.repository
      : packument?.repository?.url;
  if (repo !== undefined) npm.repository = repo;
  if (packument?.homepage !== undefined) npm.homepage = packument.homepage;
  if (weekly !== undefined) npm.weeklyDownloads = weekly;
  return npm;
}

async function fetchPackument(
  pkg: string,
  signal?: AbortSignal,
): Promise<RawPackument | undefined> {
  try {
    const init: RequestInit = { headers: { Accept: "application/json" } };
    if (signal) init.signal = signal;
    const r = await fetch(`${REGISTRY}/${pkg}`, init);
    if (!r.ok) return undefined;
    return (await r.json()) as RawPackument;
  } catch {
    return undefined;
  }
}

async function fetchWeeklyDownloads(
  pkg: string,
  signal?: AbortSignal,
): Promise<number | undefined> {
  try {
    const init: RequestInit = { headers: { Accept: "application/json" } };
    if (signal) init.signal = signal;
    const r = await fetch(`${DOWNLOADS}/${pkg}`, init);
    if (!r.ok) return undefined;
    const body = (await r.json()) as RawDownloads;
    return typeof body.downloads === "number" ? body.downloads : undefined;
  } catch {
    return undefined;
  }
}
