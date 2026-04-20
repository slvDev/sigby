/**
 * Decode Porto Orchestrator `execute(bytes)` calldata into a list of inner
 * calls (approve / transfer / swap / native-transfer / unknown), and collapse
 * those calls into a human-readable summary.
 *
 * Pure sync. No hooks. No RPC. No side effects.
 *
 * Wire shape:
 *   The outer transaction hits the Porto Orchestrator with `execute(bytes
 *   encodedIntent)` (selector 0x09c5eabe). `encodedIntent` is `abi.encode`
 *   of the Intent struct documented in Porto's contracts (see
 *   docs/refs/portoDocs.xml `struct Intent { … }`). One of its fields —
 *   `executionData` — is itself `abi.encode(Call[])` where
 *   `Call = (address to, uint256 value, bytes data)`. That's the part we
 *   care about.
 *
 * We support two Intent struct layouts: the pre-`totalPayment`-rename v1
 * shape and the current v2 shape. On both, executionData is the second
 * field after `eoa`, so if struct decode fails we also fall back to a
 * tolerant scan that locates a well-formed `Call[]` blob inside the
 * outer bytes.
 */

import {
  decodeAbiParameters,
  decodeFunctionData,
  getAddress,
  parseAbiParameters,
  type AbiParameter,
  type Hex,
} from "viem";
import type {
  PortoAssetDiffEntry,
  PortoAssetDiffs,
  PortoAsset,
} from "../../types/porto";

export interface DecodedCall {
  to: string;
  value: bigint;
  data: Hex;
  kind:
    | "approve"
    | "transfer"
    | "transferFrom"
    | "swap"
    | "native-transfer"
    | "unknown";
  args?: {
    spender?: string;
    recipient?: string;
    sender?: string;
    tokenAmount?: bigint;
    tokenAddress?: string;
    isInfiniteApprove?: boolean;
  };
}

export interface DecodedSummary {
  title: string;
  direction: "send" | "receive" | "swap" | "call" | "approve";
}

// ────────────────────────────────────────────────────────────────────────
// Selectors
// ────────────────────────────────────────────────────────────────────────

const SEL_ERC20_APPROVE = "0x095ea7b3";
const SEL_ERC20_TRANSFER = "0xa9059cbb";
const SEL_ERC20_TRANSFER_FROM = "0x23b872dd";

// Uniswap V3 SwapRouter02 + UniversalRouter — minimal set. We only classify;
// we don't decode swap args.
const SWAP_SELECTORS = new Set<string>([
  "0x04e45aaf", // exactInputSingle
  "0xb858183f", // exactInput
  "0xdb3e2198", // exactOutputSingle
  "0x09b81346", // exactOutput
  "0x3593564c", // Universal Router execute(bytes,bytes[],uint256)
]);

const EXECUTE_BYTES_SELECTOR = "0x09c5eabe"; // execute(bytes)
const MAX_UINT256 = (1n << 256n) - 1n;

// ────────────────────────────────────────────────────────────────────────
// Intent struct shapes (two variants from the Porto contracts history)
// ────────────────────────────────────────────────────────────────────────

// v1 (pre-totalPayment rename) — matches the struct in portoDocs.xml.
const INTENT_V1_PARAMS: readonly AbiParameter[] = parseAbiParameters(
  "(address eoa," +
    "bytes executionData," +
    "uint256 nonce," +
    "address payer," +
    "address paymentToken," +
    "uint256 paymentMaxAmount," +
    "uint256 combinedGas," +
    "bytes[] encodedPreCalls," +
    "bytes[] encodedFundTransfers," +
    "address settler," +
    "uint256 expiry," +
    "bool isMultichain," +
    "address funder," +
    "bytes funderSignature," +
    "bytes settlerContext," +
    "uint256 paymentAmount," +
    "address paymentRecipient," +
    "bytes signature," +
    "bytes paymentSignature," +
    "address supportedAccountImplementation) intent",
);

// v2 — pre/total payment split per intent.ts union.
const INTENT_V2_PARAMS: readonly AbiParameter[] = parseAbiParameters(
  "(address eoa," +
    "bytes executionData," +
    "uint256 nonce," +
    "address payer," +
    "address paymentToken," +
    "uint256 prePaymentMaxAmount," +
    "uint256 totalPaymentMaxAmount," +
    "uint256 combinedGas," +
    "bytes[] encodedPreCalls," +
    "bytes[] encodedFundTransfers," +
    "address settler," +
    "uint256 expiry," +
    "bool isMultichain," +
    "address funder," +
    "bytes funderSignature," +
    "bytes settlerContext," +
    "uint256 prePaymentAmount," +
    "uint256 totalPaymentAmount," +
    "address paymentRecipient," +
    "bytes signature," +
    "bytes paymentSignature," +
    "address supportedAccountImplementation) intent",
);

const CALL_ARRAY_PARAMS: readonly AbiParameter[] = parseAbiParameters(
  "(address to, uint256 value, bytes data)[] calls",
);

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function safeChecksum(addr: string): string {
  try {
    return getAddress(addr);
  } catch {
    return addr;
  }
}

function lowerHex(input: string): string {
  return input.toLowerCase();
}

function readUint256At(hex: string, offsetBytes: number): bigint | null {
  try {
    const start = 2 + offsetBytes * 2;
    const slice = hex.slice(start, start + 64);
    if (slice.length !== 64) return null;
    return BigInt("0x" + slice);
  } catch {
    return null;
  }
}

function readBytesAt(hex: string, offsetBytes: number): Hex | null {
  const len = readUint256At(hex, offsetBytes);
  if (len === null) return null;
  const n = Number(len);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  const start = 2 + (offsetBytes + 32) * 2;
  const end = start + n * 2;
  if (end > hex.length) return null;
  return ("0x" + hex.slice(start, end)) as Hex;
}

/**
 * Scan-based fallback: walk `encodedIntent` looking for a plausible
 * abi-encoded `Call[]` blob nested inside. The Intent struct places
 * `executionData` as the 2nd field; its offset is stored at word 1 of the
 * struct tail. We try word-aligned dynamic-bytes pointers until one
 * decodes as `Call[]`.
 */
function scanForExecutionData(intentBytes: Hex): Hex | null {
  const hex = intentBytes.toLowerCase();
  if (!hex.startsWith("0x")) return null;

  const totalBytes = (hex.length - 2) / 2;
  for (let off = 0; off + 64 <= totalBytes; off += 32) {
    const pointer = readUint256At(hex, off);
    if (pointer === null) continue;
    const p = Number(pointer);
    if (!Number.isFinite(p) || p <= 0 || p + 32 > totalBytes) continue;

    const inner = readBytesAt(hex, p);
    if (!inner || inner.length <= 4) continue;

    const calls = tryDecodeCallArray(inner);
    if (calls) return inner;
  }
  return null;
}

function tryDecodeCallArray(
  blob: Hex,
): ReadonlyArray<{ to: string; value: bigint; data: Hex }> | null {
  try {
    const [calls] = decodeAbiParameters(CALL_ARRAY_PARAMS, blob) as unknown as [
      ReadonlyArray<{ to: string; value: bigint; data: Hex }>,
    ];
    if (!Array.isArray(calls) || calls.length === 0) return null;
    for (const c of calls) {
      if (
        typeof c?.to !== "string" ||
        typeof c.value !== "bigint" ||
        typeof c.data !== "string"
      ) {
        return null;
      }
    }
    return calls;
  } catch {
    return null;
  }
}

function tryDecodeIntent(
  params: readonly AbiParameter[],
  encoded: Hex,
): Hex | null {
  try {
    const [intent] = decodeAbiParameters(params, encoded) as unknown as [
      { executionData?: Hex },
    ];
    const data = intent?.executionData;
    if (typeof data === "string" && data.startsWith("0x")) return data as Hex;
    return null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Per-call decoding
// ────────────────────────────────────────────────────────────────────────

function decodeInnerCall(raw: {
  to: string;
  value: bigint;
  data: Hex;
}): DecodedCall {
  const to = safeChecksum(raw.to);
  const value = raw.value;
  const data = raw.data;

  if (!data || data === "0x" || data.length <= 2) {
    if (value > 0n) {
      return {
        to,
        value,
        data,
        kind: "native-transfer",
        args: { recipient: to, tokenAmount: value },
      };
    }
    return { to, value, data, kind: "unknown" };
  }

  const selector = lowerHex(data.slice(0, 10));

  if (selector === SEL_ERC20_APPROVE) {
    try {
      const [spender, amount] = decodeAbiParameters(
        [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        ("0x" + data.slice(10)) as Hex,
      ) as unknown as [string, bigint];
      return {
        to,
        value,
        data,
        kind: "approve",
        args: {
          spender: safeChecksum(spender),
          tokenAmount: amount,
          tokenAddress: to,
          isInfiniteApprove: amount === MAX_UINT256,
        },
      };
    } catch {
      return { to, value, data, kind: "unknown" };
    }
  }

  if (selector === SEL_ERC20_TRANSFER) {
    try {
      const [recipient, amount] = decodeAbiParameters(
        [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        ("0x" + data.slice(10)) as Hex,
      ) as unknown as [string, bigint];
      return {
        to,
        value,
        data,
        kind: "transfer",
        args: {
          recipient: safeChecksum(recipient),
          tokenAmount: amount,
          tokenAddress: to,
        },
      };
    } catch {
      return { to, value, data, kind: "unknown" };
    }
  }

  if (selector === SEL_ERC20_TRANSFER_FROM) {
    try {
      const [sender, recipient, amount] = decodeAbiParameters(
        [
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        ("0x" + data.slice(10)) as Hex,
      ) as unknown as [string, string, bigint];
      return {
        to,
        value,
        data,
        kind: "transferFrom",
        args: {
          sender: safeChecksum(sender),
          recipient: safeChecksum(recipient),
          tokenAmount: amount,
          tokenAddress: to,
        },
      };
    } catch {
      return { to, value, data, kind: "unknown" };
    }
  }

  if (SWAP_SELECTORS.has(selector)) {
    return { to, value, data, kind: "swap" };
  }

  return { to, value, data, kind: "unknown" };
}

// ────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────

export function decodeOrchestratorCalls(
  _toAddress: string,
  inputData: Hex,
): DecodedCall[] | null {
  if (!inputData || !inputData.startsWith("0x") || inputData.length < 10) {
    return null;
  }
  if (lowerHex(inputData.slice(0, 10)) !== EXECUTE_BYTES_SELECTOR) {
    return null;
  }

  let encodedIntent: Hex;
  try {
    const { args } = decodeFunctionData({
      abi: [
        {
          type: "function",
          name: "execute",
          stateMutability: "payable",
          inputs: [{ name: "encodedIntent", type: "bytes" }],
          outputs: [{ name: "err", type: "bytes4" }],
        },
      ] as const,
      data: inputData,
    });
    encodedIntent = (args?.[0] ?? "0x") as Hex;
  } catch {
    return null;
  }

  if (!encodedIntent || encodedIntent === "0x") return null;

  // Try the two known Intent struct shapes, then fall back to a tolerant
  // scan that hunts for the nested Call[] blob directly.
  let executionData: Hex | null = null;
  executionData = tryDecodeIntent(INTENT_V1_PARAMS, encodedIntent);
  if (!executionData)
    executionData = tryDecodeIntent(INTENT_V2_PARAMS, encodedIntent);
  if (!executionData) executionData = scanForExecutionData(encodedIntent);
  if (!executionData) return null;

  const calls = tryDecodeCallArray(executionData);
  if (!calls) return null;

  return calls.map(decodeInnerCall);
}

// ────────────────────────────────────────────────────────────────────────
// Token metadata lookup
// ────────────────────────────────────────────────────────────────────────

export interface TokenMeta {
  symbol?: string;
  decimals?: number;
  address: string;
}

export function resolveTokenMeta(
  address: string,
  diffs: PortoAssetDiffs | undefined,
  assets: ReadonlyArray<PortoAsset> | undefined,
): TokenMeta {
  const lc = address.toLowerCase();
  if (diffs) {
    for (const chainKey of Object.keys(diffs)) {
      for (const [, entries] of diffs[chainKey] || []) {
        for (const e of entries as ReadonlyArray<PortoAssetDiffEntry>) {
          if ((e.address || "").toLowerCase() === lc) {
            return {
              address,
              symbol: e.symbol,
              decimals: e.decimals ?? undefined,
            };
          }
        }
      }
    }
  }
  if (assets) {
    for (const a of assets) {
      if ((a.address || "").toLowerCase() === lc) {
        return {
          address,
          symbol: a.metadata?.symbol,
          decimals: a.metadata?.decimals,
        };
      }
    }
  }
  return { address };
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────

export interface SummaryInputs {
  diffs?: PortoAssetDiffs;
  assets?: ReadonlyArray<PortoAsset>;
  /** Native currency symbol for the active chain, e.g. "ETH". */
  nativeSymbol?: string;
}

export function summarizeDecodedCalls(
  calls: DecodedCall[],
  inputs: SummaryInputs = {},
): DecodedSummary | null {
  if (!calls || calls.length === 0) return null;

  const { diffs, assets, nativeSymbol } = inputs;
  const kinds = calls.map((c) => c.kind);
  const dominant = kinds.filter((k) => k !== "unknown");

  const symbolOf = (addr?: string): string | undefined =>
    addr ? resolveTokenMeta(addr, diffs, assets).symbol : undefined;

  const hasSwap = kinds.includes("swap");
  const approves = calls.filter((c) => c.kind === "approve");
  const transfers = calls.filter((c) => c.kind === "transfer");
  const natives = calls.filter((c) => c.kind === "native-transfer");
  const transferFroms = calls.filter((c) => c.kind === "transferFrom");

  if (hasSwap) {
    return { title: "Swap", direction: "swap" };
  }

  if (
    approves.length >= 1 &&
    transfers.length === 0 &&
    natives.length === 0 &&
    transferFroms.length === 0 &&
    (dominant.length === approves.length ||
      kinds.filter((k) => k === "unknown").length <= approves.length)
  ) {
    // Treat `[approve, <unknown router>]` as a swap intent, per §3.2.
    if (kinds.some((k) => k === "unknown") && approves.length === 1) {
      return { title: "Swap", direction: "swap" };
    }
    if (approves.length === 1) {
      const sym = symbolOf(approves[0].args?.tokenAddress);
      const label = sym || truncateAddress(approves[0].args?.tokenAddress ?? "");
      return { title: `Approve ${label}`.trim(), direction: "approve" };
    }
    return { title: "Approvals", direction: "approve" };
  }

  if (
    transfers.length === 1 &&
    approves.length === 0 &&
    natives.length === 0 &&
    transferFroms.length === 0 &&
    dominant.length === 1
  ) {
    const sym = symbolOf(transfers[0].args?.tokenAddress);
    const label = sym || truncateAddress(transfers[0].args?.tokenAddress ?? "");
    return { title: `Sent ${label}`.trim(), direction: "send" };
  }

  if (
    natives.length === 1 &&
    approves.length === 0 &&
    transfers.length === 0 &&
    transferFroms.length === 0 &&
    dominant.length === 1
  ) {
    return {
      title: `Sent ${nativeSymbol || "native"}`,
      direction: "send",
    };
  }

  if (
    transferFroms.length === 1 &&
    approves.length === 0 &&
    transfers.length === 0 &&
    natives.length === 0 &&
    dominant.length === 1
  ) {
    const sym = symbolOf(transferFroms[0].args?.tokenAddress);
    const label =
      sym || truncateAddress(transferFroms[0].args?.tokenAddress ?? "");
    return { title: `Transfer ${label}`.trim(), direction: "send" };
  }

  const totalTransfers = transfers.length + natives.length;
  if (
    totalTransfers >= 2 &&
    approves.length === 0 &&
    transferFroms.length === 0 &&
    dominant.length === totalTransfers
  ) {
    return { title: "Multi-send", direction: "send" };
  }

  return null;
}
