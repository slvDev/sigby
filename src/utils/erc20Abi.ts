/**
 * Minimal ERC-20 ABI utilities for custom token balance fetching
 * Only used for tokens that Porto's wallet_getAssets doesn't return
 */

import type { Hex } from "viem";

// Function selectors (first 4 bytes of keccak256 hash of function signature)
const SELECTOR_BALANCE_OF = "0x70a08231"; // balanceOf(address)
const SELECTOR_DECIMALS = "0x313ce567";   // decimals()
const SELECTOR_SYMBOL = "0x95d89b41";     // symbol()
const SELECTOR_NAME = "0x06fdde03";       // name()
const SELECTOR_TRANSFER = "0xa9059cbb";   // transfer(address,uint256)

/**
 * Encode a balanceOf(address) call
 */
export function encodeBalanceOf(address: string): string {
  const cleanAddress = address.replace("0x", "").toLowerCase().padStart(64, "0");
  return SELECTOR_BALANCE_OF + cleanAddress;
}

/**
 * Encode a decimals() call
 */
export function encodeDecimals(): string {
  return SELECTOR_DECIMALS;
}

/**
 * Encode a symbol() call
 */
export function encodeSymbol(): string {
  return SELECTOR_SYMBOL;
}

/**
 * Encode a name() call
 */
export function encodeName(): string {
  return SELECTOR_NAME;
}

/**
 * Encode a transfer(address,uint256) call for ERC-20 transfers
 * @param to Recipient address
 * @param amount Amount in token's smallest unit (wei equivalent)
 */
export function encodeTransfer(to: string, amount: bigint): string {
  const toParam = to.slice(2).toLowerCase().padStart(64, "0");
  const amountParam = amount.toString(16).padStart(64, "0");
  return SELECTOR_TRANSFER + toParam + amountParam;
}

/**
 * Decode a uint256 result (e.g., balance)
 */
export function decodeUint256(hex: Hex): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

/**
 * Decode a uint8 result (e.g., decimals)
 */
export function decodeUint8(hex: Hex): number {
  if (!hex || hex === "0x") return 18; // Default to 18 decimals
  return Number(BigInt(hex));
}

/**
 * Decode a string result (e.g., symbol, name)
 * Handles both ABI-encoded strings and raw strings
 */
export function decodeString(hex: Hex): string {
  if (!hex || hex === "0x") return "";

  try {
    // Remove 0x prefix
    const data = hex.slice(2);

    // If it's a short response (likely not ABI-encoded), try to decode directly
    if (data.length <= 64) {
      return hexToString(data);
    }

    // ABI-encoded string format:
    // - First 32 bytes: offset to string data (usually 0x20 = 32)
    // - Next 32 bytes: string length
    // - Remaining: string data padded to 32 bytes

    const offset = parseInt(data.slice(0, 64), 16);
    const start = offset * 2; // Convert byte offset to hex char offset
    const length = parseInt(data.slice(start, start + 64), 16);
    const stringData = data.slice(start + 64, start + 64 + length * 2);

    return hexToString(stringData);
  } catch (error) {
    console.error("[ERC20] Failed to decode string:", error);
    return "";
  }
}

/**
 * Convert hex string to UTF-8 string
 */
function hexToString(hex: string): string {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break; // Stop at null terminator
    str += String.fromCharCode(code);
  }
  return str.trim();
}

/**
 * Parse a decimal amount string to raw token units (wei equivalent)
 * Handles fractional amounts precisely without floating-point errors
 * @param amount User input like "0.1" or "123.456789"
 * @param decimals Token decimals (e.g., 6 for USDC, 18 for ETH)
 * @returns BigInt in smallest token unit
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  // Remove any whitespace
  const cleaned = amount.trim();

  // Handle empty or invalid input
  if (!cleaned || cleaned === "." || cleaned === "-") {
    return 0n;
  }

  // Split into integer and decimal parts
  const parts = cleaned.split(".");
  const intPart = parts[0] || "0";
  let decPart = parts[1] || "";

  // Truncate or pad decimal part to match token decimals
  if (decPart.length > decimals) {
    // Truncate excess decimals
    decPart = decPart.slice(0, decimals);
  } else {
    // Pad with zeros
    decPart = decPart.padEnd(decimals, "0");
  }

  // Combine and convert to BigInt
  const combined = intPart + decPart;

  // Remove leading zeros (but keep at least one digit)
  const normalized = combined.replace(/^0+/, "") || "0";

  return BigInt(normalized);
}

/**
 * Format a token balance for display
 */
export function formatTokenBalance(balance: bigint, decimals: number): string {
  if (balance === 0n) return "0";

  const divisor = 10n ** BigInt(decimals);
  const intPart = balance / divisor;
  const fracPart = balance % divisor;

  // Pad fractional part with leading zeros
  const fracStr = fracPart.toString().padStart(decimals, "0");
  // Take first 6 decimal places
  const trimmedFrac = fracStr.slice(0, 6).replace(/0+$/, "");

  if (trimmedFrac.length === 0) {
    return intPart.toString();
  }
  return `${intPart}.${trimmedFrac}`;
}
