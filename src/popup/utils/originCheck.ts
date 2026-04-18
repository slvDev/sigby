/**
 * Origin analysis helpers for approval screens.
 *
 * Two distinct risks we want to surface separately:
 *   - `isPunycode`: hostname includes an `xn--…` label. These are IDN domains
 *     the browser is rendering in its ASCII compatibility form — could be
 *     legitimate (unicode.org), could be a homograph like
 *     `xn--uniswp-30a.org`. We flag the domain; actually decoding to Unicode
 *     for display would require the `punycode` package, out of scope for now.
 *   - `mixedScripts`: the Unicode hostname mixes character sets (Latin with
 *     Cyrillic/Greek/Hebrew/Arabic/Han). Classic homograph risk that doesn't
 *     require Punycode — e.g. a URL typed with a Cyrillic `і`.
 */

export interface OriginAnalysis {
  /** Origin as received (may include scheme, may be "Unknown dApp"). */
  raw: string;
  /** Parsed hostname in its browser-normalized form. */
  hostname: string;
  /** URL scheme, lowercased (e.g. "https"). `null` when parsing fails. */
  scheme: string | null;
  /** True for `https:`. */
  isHttps: boolean;
  /** True if the hostname contains a Punycode (`xn--…`) label. */
  isPunycode: boolean;
  /** True if the hostname mixes character sets (homograph risk). */
  mixedScripts: boolean;
}

const PUNYCODE_PREFIX = "xn--";

// Minimal script buckets we care about for homograph detection. Full Unicode
// Script property would be overkill — we only need to flag "Latin mixed with
// Cyrillic/Greek/etc.", the classic homograph vector.
const SCRIPT_RANGES: Array<{ name: string; re: RegExp }> = [
  { name: "Latin", re: /[A-Za-z]/ },
  { name: "Cyrillic", re: /[\u0400-\u04FF]/ },
  { name: "Greek", re: /[\u0370-\u03FF]/ },
  { name: "Hebrew", re: /[\u0590-\u05FF]/ },
  { name: "Arabic", re: /[\u0600-\u06FF]/ },
  { name: "Han", re: /[\u4E00-\u9FFF]/ },
];

function detectMixedScripts(s: string): boolean {
  let hits = 0;
  for (const { re } of SCRIPT_RANGES) {
    if (re.test(s)) hits++;
    if (hits > 1) return true;
  }
  return false;
}

export function analyzeOrigin(raw: string): OriginAnalysis {
  let scheme: string | null = null;
  let hostname = raw;
  try {
    const url = new URL(raw);
    scheme = url.protocol.replace(/:$/, "").toLowerCase();
    hostname = url.hostname;
  } catch {
    // `raw` might already be a bare hostname — strip any leading scheme / path
    // by hand.
    const stripped = raw.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
    hostname = stripped || raw;
  }

  const isPunycode = hostname
    .split(".")
    .some((label) => label.startsWith(PUNYCODE_PREFIX));
  const mixedScripts = /[^\x00-\x7F]/.test(hostname)
    ? detectMixedScripts(hostname)
    : false;

  return {
    raw,
    hostname,
    scheme,
    isHttps: scheme === "https",
    isPunycode,
    mixedScripts,
  };
}
