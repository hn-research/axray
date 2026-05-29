import type {
  ClientCapability,
  Finding,
  PositiveFlag,
} from "../../types.js";
import type {
  CapabilityCheck,
  CapabilityCheckCtx,
  CapabilityPositive,
} from "./types.js";
import { c1Hooks } from "./c1-hooks.js";
import { c2PermissiveAllow } from "./c2-permissive-allow.js";
import { c3AdditionalDirs } from "./c3-additional-dirs.js";
import { c4ProjectPermissions } from "./c4-project-permissions.js";
import { c5ApiKeyHelper } from "./c5-api-key-helper.js";
import { c6AutoTrustMcp } from "./c6-auto-trust-mcp.js";
import { cp1Baseline, cp2OwnerOnly } from "./cp-baseline.js";

const STATIC: CapabilityCheck[] = [
  c1Hooks,
  c2PermissiveAllow,
  c3AdditionalDirs,
  c4ProjectPermissions,
  c5ApiKeyHelper,
  c6AutoTrustMcp,
];

const POSITIVE: CapabilityPositive[] = [cp1Baseline, cp2OwnerOnly];

export function runCapabilityChecks(
  cap: ClientCapability,
  ctx: CapabilityCheckCtx,
): Finding[] {
  const out: Finding[] = [];
  for (const c of STATIC) out.push(...c(cap, ctx));
  return out;
}

export function runCapabilityPositive(
  cap: ClientCapability,
  ctx: CapabilityCheckCtx,
): PositiveFlag[] {
  const out: PositiveFlag[] = [];
  for (const c of POSITIVE) out.push(...c(cap, ctx));
  return out;
}
