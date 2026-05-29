import type { Finding, ServerSpec } from "../../types.js";
import type { CheckCtx, StaticCheck } from "../types.js";
import { s1Secrets } from "./s1-secrets.js";
import { s2FilesystemRoot } from "./s2-fs-root.js";
import { s3DangerousLaunch } from "./s3-dangerous-launch.js";
import { s4SupplyChain } from "./s4-supply-chain.js";
import { s5InsecureRemote } from "./s5-insecure-remote.js";
import { s6NoManifest } from "./s6-no-manifest.js";

const ALL: StaticCheck[] = [
  s1Secrets,
  s2FilesystemRoot,
  s3DangerousLaunch,
  s4SupplyChain,
  s5InsecureRemote,
  s6NoManifest,
];

export function runStaticChecks(
  server: ServerSpec,
  ctx: CheckCtx,
): Finding[] {
  const out: Finding[] = [];
  for (const check of ALL) out.push(...check(server, ctx));
  return out;
}

export {
  s1Secrets,
  s2FilesystemRoot,
  s3DangerousLaunch,
  s4SupplyChain,
  s5InsecureRemote,
  s6NoManifest,
};
