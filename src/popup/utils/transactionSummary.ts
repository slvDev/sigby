/**
 * Derivations and formatters for Porto call-bundle history entries.
 * Pure functions — no hooks, no React, no side effects. Shared by the
 * History list and the TransactionDetail page so both read the same
 * direction/amount/counterparty from a single source.
 *
 * Wire-format note: Porto's `wallet_getCallsHistory` is returned in
 * wire shape (hex bigints, hex chain ids, decimal-string fiat), so
 * these helpers decode explicitly. See
 * `node_modules/porto/src/core/internal/relay/schema/capabilities.ts`.
 */

import type {
  PortoAssetDiffEntry,
  PortoAssetDiffs,
  PortoFeeTotals,
  PortoHistoryEntry,
} from "../../types/porto";

export type TransactionDirection =
  | "send"
  | "receive"
  | "swap"
  | "approve"
  | "call"
  | "unknown";

export interface TransactionPrimary {
  /** Formatted absolute amount, e.g. "1.234". */
  amount: string;
  symbol: string;
  /** Signed formatted amount including +/− prefix. */
  signedAmount: string;
  /** Formatted fiat string (e.g. "$12.34") when priced. */
  usdValue?: string;
}

export interface TransactionSummary {
  direction: TransactionDirection;
  title: string;
  primary?: TransactionPrimary;
  /** Counterparty address for sends/receives, if one can be identified. */
  counterparty?: string;
}

function sameAddress(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Decode a hex-encoded bigint from wire format. Returns 0n on malformed
 * input rather than throwing — the summary code should degrade, not crash.
 */
function hexToBigInt(hex: string): bigint {
  try {
    if (!hex) return 0n;
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

/**
 * Format a raw bigint amount using `decimals`, trimming trailing zeros.
 * Conservative: no locale digits, no scientific notation.
 */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const d = Math.max(0, Number.isFinite(decimals) ? decimals : 0);
  if (d === 0) return raw.toString();
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const base = 10n ** BigInt(d);
  const whole = abs / base;
  const frac = abs % base;
  if (frac === 0n) return `${neg ? "-" : ""}${whole.toString()}`;
  const fracStr = frac.toString().padStart(d, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${fracStr ? `.${fracStr}` : ""}`;
}

export function formatUsd(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const abs = Math.abs(n);
  return `$${abs.toLocaleString(undefined, {
    minimumFractionDigits: abs < 1 ? 4 : 2,
    maximumFractionDigits: abs < 1 ? 6 : 2,
  })}`;
}

/**
 * Flatten asset diffs across all chains for a specific account. Porto
 * groups per chain and per account within; we don't care about the
 * chain boundary at the summary level since a single bundle typically
 * executes on one chain (the relay may emit a multi-chain group for
 * interop bundles, which we still summarise by magnitude).
 */
export function flattenAssetDiffs(
  diffs: PortoAssetDiffs | undefined,
  account: string,
): PortoAssetDiffEntry[] {
  if (!diffs) return [];
  const out: PortoAssetDiffEntry[] = [];
  for (const chainKey of Object.keys(diffs)) {
    const chainRows = diffs[chainKey] || [];
    for (const row of chainRows) {
      const [addr, entries] = row;
      if (!sameAddress(addr, account)) continue;
      for (const entry of entries) out.push(entry);
    }
  }
  return out;
}

/**
 * Pick the fee-total entry for the chain the bundle ran on. Porto's
 * `feeTotals` keying has been observed as both lower-cased hex and
 * mixed-case hex; try both before giving up.
 */
function pickFeeTotal(
  feeTotals: PortoFeeTotals | undefined,
  chainKey: string,
): { currency: string; value: string } | undefined {
  if (!feeTotals || !chainKey) return undefined;
  if (feeTotals[chainKey]) return feeTotals[chainKey];
  const lower = chainKey.toLowerCase();
  if (feeTotals[lower]) return feeTotals[lower];
  return undefined;
}

/**
 * Parse a human-unit decimal string (e.g. "0.001323") into the raw bigint
 * at the given decimals. Returns null on malformed input.
 */
function decimalStringToRaw(value: string, decimals: number): bigint | null {
  if (!value) return null;
  const d = Math.max(0, Number.isFinite(decimals) ? decimals : 0);
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart, fracPart = ""] = unsigned.split(".");
  const fracPadded = (fracPart + "0".repeat(d)).slice(0, d);
  try {
    const raw = BigInt(wholePart) * 10n ** BigInt(d) + BigInt(fracPadded || "0");
    return negative ? -raw : raw;
  } catch {
    return null;
  }
}

/**
 * Remove the Porto fee transfer from a user's asset diffs. Porto records
 * the fee payment as an outgoing ERC-20 Transfer on the user side even
 * though the "Network fee" card already shows it; without this filter the
 * summary table double-counts and approval-only txs get misclassified as
 * sends of the fee token.
 *
 * Matches by currency symbol + approximate magnitude (within 1 token base
 * unit). Removes the single closest match; never partially subtracts from
 * a larger diff — that would introduce more confusion than it removes.
 */
export function excludeFeeFromDiffs(
  mine: PortoAssetDiffEntry[],
  feeTotals: PortoFeeTotals | undefined,
  chainKey: string,
): PortoAssetDiffEntry[] {
  const total = pickFeeTotal(feeTotals, chainKey);
  if (!total || !total.currency || mine.length === 0) return mine;

  const currency = total.currency.toUpperCase();
  const candidates = mine
    .map((d, i) => ({ entry: d, index: i }))
    .filter(
      (c) =>
        c.entry.direction === "outgoing" &&
        (c.entry.symbol || "").toUpperCase() === currency,
    );
  if (candidates.length === 0) return mine;

  const best = candidates
    .map((c) => {
      const decimals = c.entry.decimals ?? 0;
      const raw = hexToBigInt(c.entry.value);
      const abs = raw < 0n ? -raw : raw;
      const feeRaw = decimalStringToRaw(total.value, decimals);
      if (feeRaw === null) return null;
      const diff = abs > feeRaw ? abs - feeRaw : feeRaw - abs;
      return { index: c.index, diff, abs, feeRaw };
    })
    .filter((x): x is { index: number; diff: bigint; abs: bigint; feeRaw: bigint } => x !== null)
    .sort((a, b) => (a.diff < b.diff ? -1 : a.diff > b.diff ? 1 : 0))[0];
  if (!best) return mine;

  // Tolerance: 1 unit of the smallest denomination. If the closest match
  // is wildly off (e.g. the fee currency happens to coincide with the
  // user's outgoing swap leg), leave everything alone.
  if (best.diff > 1n) return mine;

  return mine.filter((_, i) => i !== best.index);
}

/** Entries relating to accounts OTHER than the active one. Used to derive counterparties. */
function otherPartyDiffs(
  diffs: PortoAssetDiffs | undefined,
  account: string,
): Array<{ address: string; entry: PortoAssetDiffEntry }> {
  if (!diffs) return [];
  const out: Array<{ address: string; entry: PortoAssetDiffEntry }> = [];
  for (const chainKey of Object.keys(diffs)) {
    const chainRows = diffs[chainKey] || [];
    for (const row of chainRows) {
      const [addr, entries] = row;
      if (sameAddress(addr, account)) continue;
      for (const entry of entries) out.push({ address: addr, entry });
    }
  }
  return out;
}

function fiatMagnitude(entry: PortoAssetDiffEntry): number {
  const f = entry.fiat?.value;
  if (!f) return 0;
  const n = Math.abs(Number(f));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Rank asset diffs so the "primary" diff is the largest-value movement
 * for the active account. Falls back to raw bigint comparison when
 * fiat isn't priced.
 */
function pickPrimary(
  mine: PortoAssetDiffEntry[],
): PortoAssetDiffEntry | undefined {
  if (mine.length === 0) return undefined;
  const byFiat = [...mine].sort((a, b) => fiatMagnitude(b) - fiatMagnitude(a));
  if (fiatMagnitude(byFiat[0]) > 0) return byFiat[0];
  return [...mine].sort((a, b) => {
    const av = hexToBigInt(a.value);
    const bv = hexToBigInt(b.value);
    const aa = av < 0n ? -av : av;
    const bb = bv < 0n ? -bv : bv;
    return aa > bb ? -1 : aa < bb ? 1 : 0;
  })[0];
}

/**
 * Derive a human-readable summary from a history entry. The heuristic:
 *  - no diffs → "Contract call"
 *  - only outgoing diffs for `account` → "Sent"
 *  - only incoming → "Received"
 *  - both directions → "Swap"
 * Counterparty is the non-self address that received the primary
 * outgoing diff (for sends) or sent the primary incoming diff (for
 * receives); undefined if ambiguous.
 */
export function deriveSummary(
  entry: PortoHistoryEntry,
  account: string,
): TransactionSummary {
  const diffs = entry.capabilities?.assetDiffs;
  const rawMine = flattenAssetDiffs(diffs, account);
  const chainKey = entry.transactions?.[0]?.chainId || "";
  const mine = excludeFeeFromDiffs(
    rawMine,
    entry.capabilities?.feeTotals,
    chainKey,
  );

  if (mine.length === 0) {
    return { direction: "call", title: "Contract call" };
  }

  const outs = mine.filter((d) => d.direction === "outgoing");
  const ins = mine.filter((d) => d.direction === "incoming");

  let direction: TransactionDirection;
  let title: string;
  if (outs.length > 0 && ins.length === 0) {
    direction = "send";
    title = "Sent";
  } else if (ins.length > 0 && outs.length === 0) {
    direction = "receive";
    title = "Received";
  } else if (ins.length > 0 && outs.length > 0) {
    direction = "swap";
    title = "Swap";
  } else {
    direction = "unknown";
    title = "Transaction";
  }

  const primaryEntry = pickPrimary(mine);
  let primary: TransactionPrimary | undefined;
  if (primaryEntry) {
    const raw = hexToBigInt(primaryEntry.value);
    const abs = raw < 0n ? -raw : raw;
    const decimals = primaryEntry.decimals ?? 0;
    const amount = formatTokenAmount(abs, decimals);
    const sign = primaryEntry.direction === "outgoing" ? "-" : "+";
    primary = {
      amount,
      symbol: primaryEntry.symbol,
      signedAmount: `${sign}${amount}`,
      usdValue: formatUsd(primaryEntry.fiat?.value),
    };
  }

  // Counterparty: the "other" account that mirrors the primary entry.
  // For sends: the counterparty received what we sent (incoming on their side).
  // For receives: the counterparty sent what we got (outgoing on their side).
  let counterparty: string | undefined;
  if (primaryEntry && (direction === "send" || direction === "receive")) {
    const others = otherPartyDiffs(diffs, account);
    const wantDir = direction === "send" ? "incoming" : "outgoing";
    const match = others.find(
      (o) =>
        o.entry.direction === wantDir &&
        (o.entry.symbol === primaryEntry.symbol ||
          sameAddress(o.entry.address ?? undefined, primaryEntry.address ?? undefined)),
    );
    counterparty = match?.address;
  }

  return { direction, title, primary, counterparty };
}

/**
 * Format a unix (seconds) timestamp as a relative time. Tiers mirror
 * common wallet UIs: "Just now" under 1 min, minutes under an hour,
 * hours under a day, days under a week, then absolute date.
 */
export function formatRelativeTime(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "";
  const nowSec = Math.floor(Date.now() / 1000);
  const delta = nowSec - Math.floor(unixSeconds);
  if (delta < 0) return "Just now";
  if (delta < 60) return "Just now";
  if (delta < 3600) {
    const m = Math.floor(delta / 60);
    return `${m} min${m === 1 ? "" : "s"} ago`;
  }
  if (delta < 86_400) {
    const h = Math.floor(delta / 3600);
    return `${h} hr${h === 1 ? "" : "s"} ago`;
  }
  if (delta < 86_400 * 7) {
    const d = Math.floor(delta / 86_400);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return formatAbsoluteTime(unixSeconds);
}

export function formatAbsoluteTime(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return "";
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
