/**
 * Validation utilities for input validation
 * Provides centralized validation functions for addresses, hex strings, and transaction parameters
 */

/**
 * Validate if a value is a valid Ethereum address
 * @param address - Value to validate
 * @returns true if valid address format (0x + 40 hex chars)
 */
export function isValidAddress(address: unknown): address is string {
  if (typeof address !== "string") return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate and normalize an Ethereum address
 * @param address - Value to validate
 * @returns Lowercased address if valid
 * @throws Error if invalid
 */
export function validateAddress(address: unknown): string {
  if (!isValidAddress(address)) {
    throw new Error("Invalid Ethereum address format");
  }
  return address.toLowerCase();
}

/**
 * Validate if a value is a valid hex string
 * @param value - Value to validate
 * @returns true if valid hex string (0x + hex chars)
 */
export function isValidHex(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^0x[a-fA-F0-9]*$/.test(value);
}

/**
 * Validate if a value is a valid non-empty hex string
 * @param value - Value to validate
 * @returns true if valid hex string with at least one hex char
 */
export function isValidHexValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^0x[a-fA-F0-9]+$/.test(value);
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate transaction parameters (eth_sendTransaction)
 * @param params - Transaction parameters array
 * @returns Validation result
 */
export function validateTransactionParams(params: unknown[]): ValidationResult {
  if (!params?.[0] || typeof params[0] !== "object") {
    return { valid: false, error: "Invalid transaction object" };
  }

  const tx = params[0] as Record<string, unknown>;

  // Validate 'from' address (required by EIP-1474)
  if (tx.from !== undefined && tx.from !== null) {
    if (!isValidAddress(tx.from)) {
      return { valid: false, error: "Invalid 'from' address format" };
    }
  }

  // Validate 'to' address (optional for contract creation)
  if (tx.to !== undefined && tx.to !== null) {
    if (!isValidAddress(tx.to)) {
      return { valid: false, error: "Invalid 'to' address format" };
    }
  }

  // Validate 'value' (optional, must be hex if present)
  if (tx.value !== undefined && tx.value !== null) {
    if (!isValidHexValue(tx.value)) {
      return { valid: false, error: "Invalid value format (must be hex)" };
    }
  }

  // Validate 'data' (optional, must be hex if present, can be empty "0x")
  if (tx.data !== undefined && tx.data !== null) {
    if (!isValidHex(tx.data)) {
      return { valid: false, error: "Invalid data format (must be hex)" };
    }
  }

  // Validate 'gas' (optional, must be hex if present)
  if (tx.gas !== undefined && tx.gas !== null) {
    if (!isValidHexValue(tx.gas)) {
      return { valid: false, error: "Invalid gas format (must be hex)" };
    }
  }

  // Validate 'gasPrice' (optional, must be hex if present)
  if (tx.gasPrice !== undefined && tx.gasPrice !== null) {
    if (!isValidHexValue(tx.gasPrice)) {
      return { valid: false, error: "Invalid gasPrice format (must be hex)" };
    }
  }

  // Validate 'maxFeePerGas' (optional, must be hex if present)
  if (tx.maxFeePerGas !== undefined && tx.maxFeePerGas !== null) {
    if (!isValidHexValue(tx.maxFeePerGas)) {
      return { valid: false, error: "Invalid maxFeePerGas format (must be hex)" };
    }
  }

  // Validate 'maxPriorityFeePerGas' (optional, must be hex if present)
  if (tx.maxPriorityFeePerGas !== undefined && tx.maxPriorityFeePerGas !== null) {
    if (!isValidHexValue(tx.maxPriorityFeePerGas)) {
      return { valid: false, error: "Invalid maxPriorityFeePerGas format (must be hex)" };
    }
  }

  // Validate 'nonce' (optional, must be hex if present)
  if (tx.nonce !== undefined && tx.nonce !== null) {
    if (!isValidHexValue(tx.nonce)) {
      return { valid: false, error: "Invalid nonce format (must be hex)" };
    }
  }

  return { valid: true };
}

/**
 * Validate personal_sign parameters
 * @param params - Sign parameters array [message, address]
 * @returns Validation result
 */
export function validatePersonalSignParams(params: unknown[]): ValidationResult {
  if (!params || params.length < 2) {
    return { valid: false, error: "personal_sign requires [message, address] parameters" };
  }

  const [message, address] = params;

  // Message should be a hex string
  if (typeof message !== "string") {
    return { valid: false, error: "Invalid message format" };
  }

  // If message is hex, validate format
  if (message.startsWith("0x") && !isValidHex(message)) {
    return { valid: false, error: "Invalid hex message format" };
  }

  // Address must be valid
  if (!isValidAddress(address)) {
    return { valid: false, error: "Invalid signer address format" };
  }

  return { valid: true };
}

/**
 * Validate eth_signTypedData parameters
 * @param params - Sign parameters array [address, typedData]
 * @returns Validation result
 */
export function validateTypedDataParams(params: unknown[]): ValidationResult {
  if (!params || params.length < 2) {
    return { valid: false, error: "signTypedData requires [address, typedData] parameters" };
  }

  const [address, typedData] = params;

  // Address must be valid
  if (!isValidAddress(address)) {
    return { valid: false, error: "Invalid signer address format" };
  }

  // TypedData should be an object or valid JSON string
  if (typedData === null || typedData === undefined) {
    return { valid: false, error: "Missing typed data" };
  }

  // If it's a string, try to parse it
  if (typeof typedData === "string") {
    try {
      JSON.parse(typedData);
    } catch {
      return { valid: false, error: "Invalid typed data JSON" };
    }
  } else if (typeof typedData !== "object") {
    return { valid: false, error: "Invalid typed data format" };
  }

  return { valid: true };
}

/**
 * Validate origin URL format
 * @param origin - Origin string to validate
 * @returns true if valid origin (http or https protocol)
 */
export function isValidOrigin(origin: string): boolean {
  if (!origin || typeof origin !== "string") {
    return false;
  }

  try {
    const url = new URL(origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Extract and validate origin from sender.
 *
 * CRITICAL: must return the origin of the *frame* that sent the message,
 * not the top-frame URL. Content scripts run in every frame
 * (`manifest.json` sets `all_frames: true`), so a malicious iframe
 * embedded in a trusted tab would otherwise inherit the tab's permissions.
 *
 * Precedence:
 *   1. `sender.origin` — Chrome populates this with the frame's origin;
 *      authoritative for permission decisions.
 *   2. `sender.url` — frame URL, derive origin from it.
 *   3. The message-body `origin` field is **ignored** for security
 *      decisions (content-script-provided, untrusted).
 *
 * `sender.tab.url` is deliberately NOT consulted — it's the top-frame URL
 * and using it for permission checks is the iframe-spoofing bug.
 */
export function extractValidOrigin(
  sender: chrome.runtime.MessageSender,
  _providedOrigin?: string
): string | null {
  if (sender.origin && isValidOrigin(sender.origin)) {
    return sender.origin;
  }

  if (sender.url) {
    try {
      const origin = new URL(sender.url).origin;
      if (isValidOrigin(origin)) {
        return origin;
      }
    } catch {
      // Invalid URL, fall through
    }
  }

  return null;
}

/**
 * Validate transaction hash format
 * @param hash - Transaction hash to validate
 * @returns true if valid tx hash (0x + 64 hex chars)
 */
export function isValidTxHash(hash: unknown): hash is string {
  if (typeof hash !== "string") return false;
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}
