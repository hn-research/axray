import type { PositiveFlag, ServerSpec } from "../../types.js";
import type { CheckCtx, PositiveCheck } from "../types.js";
import { p1VerifiedRepo } from "./p1-verified-repo.js";
import { p2Adoption } from "./p2-adoption.js";
import { p3Pinned } from "./p3-pinned.js";
import { p5ScopedInstall } from "./p5-scoped-install.js";
import { p7DxtDirectory } from "./p7-dxt-directory.js";

const ALL: PositiveCheck[] = [
  p1VerifiedRepo,
  p2Adoption,
  p3Pinned,
  p5ScopedInstall,
  p7DxtDirectory,
];

export function runPositiveChecks(
  server: ServerSpec,
  ctx: CheckCtx,
): PositiveFlag[] {
  const out: PositiveFlag[] = [];
  for (const check of ALL) out.push(...check(server, ctx));
  return out;
}

export { p1VerifiedRepo, p2Adoption, p3Pinned, p5ScopedInstall, p7DxtDirectory };
