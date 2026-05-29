/**
 * P4 — Clean tool surface.
 *
 * Server's introspected tools fired no D1/D2/D3 findings: descriptions
 * are clean, no exec/credential surface, no unconstrained string
 * inputs. Pairs with the static positive flags (P1/P2/P3/P5) for
 * Tier-2-style elevation in deep mode.
 *
 * Note: empty tools/list also satisfies this — a server that exposes
 * nothing isn't a dangerous surface. The detail string distinguishes
 * the two cases so the report is honest.
 */

import type { PositiveFlag, ServerSpec, ToolInfo } from "../../types.js";
import type { DeepPositiveCheck } from "./types.js";
import { d1ToolPoisoning } from "./d1-tool-poisoning.js";
import { d2DangerousCapabilities } from "./d2-dangerous-capabilities.js";
import { d3PermissiveInputs } from "./d3-permissive-inputs.js";

export const p4CleanSurface: DeepPositiveCheck = (
  server: ServerSpec,
  tools: ToolInfo[],
  ctx,
): PositiveFlag[] => {
  const hits = [
    ...d1ToolPoisoning(server, tools, ctx),
    ...d2DangerousCapabilities(server, tools, ctx),
    ...d3PermissiveInputs(server, tools, ctx),
  ];
  if (hits.length > 0) return [];
  const detail =
    tools.length === 0
      ? "no tools/list response — nothing exposed."
      : `${tools.length} tool(s) inspected; no description-injection, no powerful capability surface, no unconstrained inputs.`;
  return [
    {
      id: "P4",
      server: server.name,
      label: "tool surface clean",
      detail,
      signal: `tools=${tools.length};no-D*`,
    },
  ];
};
