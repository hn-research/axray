import type {
  ClientCapability,
  Enrichments,
  Finding,
  PositiveFlag,
} from "../../types.js";

export interface CapabilityCheckCtx {
  enrichments?: Enrichments;
}

export type CapabilityCheck = (
  cap: ClientCapability,
  ctx: CapabilityCheckCtx,
) => Finding[];

export type CapabilityPositive = (
  cap: ClientCapability,
  ctx: CapabilityCheckCtx,
) => PositiveFlag[];

export function capId(cap: ClientCapability): string {
  return `${cap.client}:${cap.scope}:${cap.configPath}`;
}
