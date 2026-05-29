/**
 * Filesystem helpers used by the discovery clients.
 *
 * Pure I/O + best-effort: every function returns undefined on error rather
 * than throwing, because a missing config is a normal outcome, not an
 * exceptional one.
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join, parse } from "node:path";

export interface LoadedJson {
  data: unknown;
  /** File mode in octal string (e.g. "644"). */
  perms: string;
}

/** Read + parse a JSON file. Returns undefined if missing or unparseable. */
export async function readJsonIfExists(
  path: string,
): Promise<LoadedJson | undefined> {
  let text: string;
  let perms: string;
  try {
    const [t, st] = await Promise.all([readFile(path, "utf8"), stat(path)]);
    text = t;
    perms = (st.mode & 0o777).toString(8).padStart(3, "0");
  } catch {
    return undefined;
  }
  try {
    return { data: JSON.parse(text) as unknown, perms };
  } catch {
    return undefined;
  }
}

/**
 * Walk up from `start` looking for a file at the relative path. Returns the
 * first matching absolute path, or undefined.
 */
export async function findUp(
  start: string,
  fileRel: string,
): Promise<string | undefined> {
  let dir = start;
  const root = parse(start).root;
  // Guard against runaway loops on broken paths.
  for (let i = 0; i < 64; i++) {
    const candidate = join(dir, fileRel);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // not here; walk up
    }
    if (dir === root) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}
