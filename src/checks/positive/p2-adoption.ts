/**
 * P2 — Broad adoption signal from the npm registry.
 *
 * Bands:
 *   ≥ 10000 weekly downloads → "broad"
 *   ≥  1000                 → "moderate"
 *   ≥   100                 → "small but real"
 *   <  100                  → no flag
 *
 * Adoption isn't safety, but it's a real independent signal: more eyes
 * on a package, more chance compromise is observed quickly. Used with
 * P1 to elevate a server to Tier-2.
 */

import type { PositiveFlag, ServerSpec } from "../../types.js";
import type { CheckCtx, PositiveCheck } from "../types.js";

interface Band {
  min: number;
  label: string;
}

const BANDS: Band[] = [
  { min: 10000, label: "broad" },
  { min: 1000, label: "moderate" },
  { min: 100, label: "small but real" },
];

export const p2Adoption: PositiveCheck = (
  server: ServerSpec,
  ctx: CheckCtx,
): PositiveFlag[] => {
  const npm = ctx.enrichments?.get(server.name)?.npm;
  if (!npm || typeof npm.weeklyDownloads !== "number") return [];
  const dl = npm.weeklyDownloads;
  const band = BANDS.find((b) => dl >= b.min);
  if (!band) return [];
  return [
    {
      id: "P2",
      server: server.name,
      label: `adoption: ${band.label}`,
      detail: `${dl.toLocaleString()} weekly downloads on npm.`,
      signal: `npm:weeklyDownloads=${dl}`,
    },
  ];
};
