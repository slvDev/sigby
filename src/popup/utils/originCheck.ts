/**
 * Origin analysis helpers for approval screens.
 *
 * Browsers auto-encode IDN domains to Punycode (`xn--…`) in the URL string,
 * so a raw ASCII hostname may hide Unicode homoglyphs — `xn--uniswp-30a.org`
 * renders as `unісwap.org` (Cyrillic і). We decode back to the Unicode form
 * for display and flag the mismatch so the user sees both.
 */

export interface OriginAnalysis {
  /** Origin as received (may include scheme, may be "Unknown dApp"). */
  raw: string;
  /** Parsed hostname in its browser-normalized (ASCII/Punycode) form. */
  hostname: string;
  /** URL scheme, lowercased (e.g. "https"). `null` when parsing fails. */
  scheme: string | null;
  /** True for `https:`. */
  isHttps: boolean;
  /** True if the hostname uses Punycode (`xn--…` in any label). */
  isPunycode: boolean;
  /** Unicode rendering of the hostname, if different from `hostname`. */
  unicodeHostname: string | null;
  /** True if the Unicode form mixes scripts (homograph risk). */
  mixedScripts: boolean;
}

const PUNYCODE_PREFIX = "xn--";

// Minimal script buckets we care about for homograph detection. Full Unicode
// Script property is overkill here — we just want to flag "Latin mixed with
// Cyrillic/Greek/etc." which is the classic homograph attack.
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

/**
 * Best-effort Punycode → Unicode. Falls back to the input if `URL` can't
 * resolve (e.g. invalid label). Modern Chromium's `URL.hostname` does this
 * automatically for the full URL, but we may have just a bare hostname.
 */
function punycodeToUnicode(hostname: string): string | null {
  if (!hostname.split(".").some((label) => label.startsWith(PUNYCODE_PREFIX))) {
    return null;
  }
  try {
    // Construct a throwaway URL to let the engine decode the host.
    const decoded = new URL(`https://${hostname}`).hostname;
    // Some engines keep the Punycode form; if nothing changed, no IDN.
    return decoded !== hostname ? decoded : null;
  } catch {
    return null;
  }
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

  const labels = hostname.split(".");
  const isPunycode = labels.some((label) => label.startsWith(PUNYCODE_PREFIX));
  const unicodeHostname = punycodeToUnicode(hostname);
  const nonAscii = /[^\x00-\x7F]/.test(hostname) || (unicodeHostname !== null);
  const mixedScripts = nonAscii
    ? detectMixedScripts(unicodeHostname ?? hostname)
    : false;

  return {
    raw,
    hostname,
    scheme,
    isHttps: scheme === "https",
    isPunycode,
    unicodeHostname,
    mixedScripts,
  };
}
