/**
 * --debug helper: list JSON / YAML files that live in directories
 * containing ax-ray's known config targets, but that ax-ray itself
 * doesn't read. Surfaces unknown configurations near our targets
 * without recursing or reading content — purely a directory listing.
 *
 * Used to spot when a vendor (Anthropic, Cursor, etc.) adds a new
 * config file we should write an adapter for. Reports filename +
 * size + mtime; never opens contents.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { KNOWN_PATHS, knownConfigParentDirs } from "./path-map.js";

/**
 * Directories whose entire contents are consumed by an adapter, even
 * though the path map only lists the directory (not each file inside).
 * Files inside any of these are excluded from the "unknown" list.
 */
const CONSUMED_DIR_SUFFIXES = [
  "/Claude Extensions Settings",
  "/.continue/rules",
];

export interface UnknownConfigEntry {
  path: string;
  bytes: number;
  modifiedAt: string;
}

export async function listUnknownConfigsNearKnownTargets(): Promise<
  UnknownConfigEntry[]
> {
  const knownFilePaths = new Set<string>();
  for (const p of KNOWN_PATHS) {
    const resolved = p.resolve();
    if (resolved && p.kind === "file") knownFilePaths.add(resolved);
  }

  const out: UnknownConfigEntry[] = [];
  for (const dir of knownConfigParentDirs()) {
    if (CONSUMED_DIR_SUFFIXES.some((s) => dir.endsWith(s))) continue;
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      // Filter to config-shaped files only — never touch unknown sqlite,
      // logs, caches, IndexedDB, cookies, etc.
      if (!/\.(json|jsonc|ya?ml|toml)$/i.test(e)) continue;
      const full = join(dir, e);
      if (knownFilePaths.has(full)) continue;
      try {
        const st = await stat(full);
        if (!st.isFile()) continue;
        out.push({
          path: full,
          bytes: st.size,
          modifiedAt: st.mtime.toISOString(),
        });
      } catch {
        // skip unreadable
      }
    }
  }
  return out;
}
