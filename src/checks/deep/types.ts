import type {
  Enrichments,
  Finding,
  PositiveFlag,
  ServerSpec,
  ToolInfo,
} from "../../types.js";

export interface DeepCheckCtx {
  enrichments?: Enrichments;
}

export type DeepCheck = (
  server: ServerSpec,
  tools: ToolInfo[],
  ctx: DeepCheckCtx,
) => Finding[];

export type DeepPositiveCheck = (
  server: ServerSpec,
  tools: ToolInfo[],
  ctx: DeepCheckCtx,
) => PositiveFlag[];
