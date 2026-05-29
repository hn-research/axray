/**
 * Manifest-introspection layer.
 *
 * The dynamic remediation surface. For each finding id, a small set of
 * regexes describes what publisher-declared `user_config` keys would
 * narrow the risk. At render time we match the server's actual
 * user_config keys against these patterns and surface matches as
 * "the publisher already shipped a safer mode you haven't enabled."
 *
 * Adding a new pattern is one line and applies to every server we
 * discover, today and tomorrow. No per-server hardcoding required.
 */

const PATTERNS_BY_FINDING: Record<string, RegExp[]> = {
  S1: [/mask[_-]?secret/i, /redact/i, /sanitize/i],
  D2: [
    /readonly/i,
    /read[_-]?only/i,
    /non[_-]destructive/i,
    /no[_-]?destructive/i,
    /restrict/i,
    /safe[_-]?mode/i,
    /disable[_-]?exec/i,
    /no[_-]?shell/i,
    /allowed[_-]?tools/i,
    /allow[_-]?list/i,
  ],
  D3: [
    /allowed[_-]?tools/i,
    /allow[_-]?list/i,
    /readonly/i,
    /restrict/i,
    /safe[_-]?mode/i,
  ],
};

export interface SaferModeHint {
  key: string;
  reason: string;
}

export function findSaferModeHints(
  findingId: string,
  userConfigKeys: string[] | undefined,
): SaferModeHint[] {
  if (!userConfigKeys || userConfigKeys.length === 0) return [];
  const patterns = PATTERNS_BY_FINDING[findingId];
  if (!patterns) return [];
  const hits: SaferModeHint[] = [];
  for (const key of userConfigKeys) {
    for (const re of patterns) {
      if (re.test(key)) {
        hits.push({
          key,
          reason: `the publisher's manifest declares this knob; setting it narrows the surface that triggered ${findingId}.`,
        });
        break;
      }
    }
  }
  return hits;
}
