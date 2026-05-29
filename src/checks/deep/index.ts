import type { Finding, PositiveFlag, ServerSpec, ToolInfo } from "../../types.js";
import type { DeepCheck, DeepCheckCtx, DeepPositiveCheck } from "./types.js";
import { d1ToolPoisoning } from "./d1-tool-poisoning.js";
import { d2DangerousCapabilities } from "./d2-dangerous-capabilities.js";
import { d3PermissiveInputs } from "./d3-permissive-inputs.js";
import { p4CleanSurface } from "./p4-clean-surface.js";

const DEEP_CHECKS: DeepCheck[] = [
  d1ToolPoisoning,
  d2DangerousCapabilities,
  d3PermissiveInputs,
];

const DEEP_POSITIVE: DeepPositiveCheck[] = [p4CleanSurface];

export function runDeepChecks(
  server: ServerSpec,
  tools: ToolInfo[],
  ctx: DeepCheckCtx,
): Finding[] {
  const out: Finding[] = [];
  for (const c of DEEP_CHECKS) out.push(...c(server, tools, ctx));
  return out;
}

export function runDeepPositive(
  server: ServerSpec,
  tools: ToolInfo[],
  ctx: DeepCheckCtx,
): PositiveFlag[] {
  const out: PositiveFlag[] = [];
  for (const c of DEEP_POSITIVE) out.push(...c(server, tools, ctx));
  return out;
}

export { d1ToolPoisoning, d2DangerousCapabilities, d3PermissiveInputs, p4CleanSurface };
