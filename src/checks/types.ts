/**
 * Shared types for the static + positive check modules.
 *
 * Every check is a pure function over (ServerSpec, CheckCtx) → results.
 * No I/O happens inside a check — all external lookups are pre-fetched
 * into `ctx.enrichments` so the engine remains synchronous and testable
 * without network access.
 */

import type {
  Enrichments,
  Finding,
  PositiveFlag,
  ServerSpec,
} from "../types.js";

export interface CheckCtx {
  enrichments?: Enrichments;
}

export type StaticCheck = (server: ServerSpec, ctx: CheckCtx) => Finding[];
export type PositiveCheck = (
  server: ServerSpec,
  ctx: CheckCtx,
) => PositiveFlag[];
