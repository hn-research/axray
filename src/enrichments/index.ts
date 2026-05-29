import type { Enrichments, ServerSpec } from "../types.js";
import { fetchNpmPackuments } from "./npm.js";

export interface EnrichmentOptions {
  signal?: AbortSignal;
}

export async function fetchEnrichments(
  servers: ServerSpec[],
  opts: EnrichmentOptions = {},
): Promise<Enrichments> {
  return fetchNpmPackuments(servers, opts.signal);
}
