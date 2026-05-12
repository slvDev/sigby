/**
 * EIP-1193 provider error codes and helpers.
 *
 * dApps switch on `error.code`, not on the message text — so every rejection
 * that crosses the provider boundary must carry a numeric code. This module
 * defines the codes we use, a serializable error shape for postMessage /
 * chrome.runtime.sendMessage transit, and the class the injected provider
 * throws back to page-context callers.
 */

export const RPC_ERROR_CODES = {
  // EIP-1193 user-facing
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  // EIP-3326
  UNRECOGNIZED_CHAIN: 4902,
  // JSON-RPC 2.0
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

/** Serializable shape carried over postMessage / chrome.runtime.sendMessage. */
export interface SerializedRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Type guard for the serialized shape. */
export function isSerializedRpcError(v: unknown): v is SerializedRpcError {
  return (
    v !== null &&
    typeof v === "object" &&
    typeof (v as any).code === "number" &&
    typeof (v as any).message === "string"
  );
}

/**
 * Provider-facing error class. The page-context provider rejects with this
 * so dApps can do `if (err.code === 4001) …`.
 */
export class ProviderRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "ProviderRpcError";
    this.code = code;
    this.data = data;
  }

  toJSON(): SerializedRpcError {
    return { code: this.code, message: this.message, data: this.data };
  }
}

/**
 * Normalize any thrown value into the serialized shape. Used at the
 * background <-> content-script <-> provider boundaries.
 */
export function serializeRpcError(err: unknown): SerializedRpcError {
  if (err instanceof ProviderRpcError) return err.toJSON();
  if (isSerializedRpcError(err)) return err;
  if (err instanceof Error) {
    return { code: RPC_ERROR_CODES.INTERNAL, message: err.message };
  }
  return { code: RPC_ERROR_CODES.INTERNAL, message: String(err ?? "Unknown error") };
}

/** Reconstruct a ProviderRpcError from its serialized form. */
export function deserializeRpcError(obj: SerializedRpcError): ProviderRpcError {
  return new ProviderRpcError(obj.code, obj.message, obj.data);
}

/**
 * Narrow a MessageResponse.error (which may be string or structured) to a
 * display string. Use at popup sinks so a stray structured error never
 * renders as "[object Object]".
 */
export function errorToString(err: unknown): string {
  const portoDeficitMessage = portoQuoteDeficitMessage(err);
  if (portoDeficitMessage) return portoDeficitMessage;

  if (err === undefined || err === null) return "";
  if (typeof err === "string") return err;
  if (isSerializedRpcError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

function portoQuoteDeficitMessage(err: unknown): string | null {
  const message = rawErrorMessage(err);
  if (!message.includes("quote has asset deficits")) return null;

  const requestBody = extractRequestBody(message);
  const deficits = requestBody
    ? extractQuoteAssetDeficits(requestBody)
    : [];

  if (deficits.length === 0) {
    return "Insufficient funds. Add funds or reduce the amount before sending.";
  }

  const first = deficits[0];
  if (!first) {
    return "Insufficient funds. Add funds or reduce the amount before sending.";
  }

  return `Insufficient ${first.symbol}. Need ${first.required}, short ${first.deficit}. Add funds or reduce the amount before sending.`;
}

function rawErrorMessage(err: unknown): string {
  if (err === undefined || err === null) return "";
  if (typeof err === "string") return err;
  if (isSerializedRpcError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

function extractRequestBody(message: string): unknown | null {
  const marker = "Request body: ";
  const start = message.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = start + marker.length;
  const detailsStart = message.indexOf(" Details:", jsonStart);
  const json = message.slice(
    jsonStart,
    detailsStart === -1 ? undefined : detailsStart
  );

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractQuoteAssetDeficits(requestBody: unknown): Array<{
  deficit: string;
  required: string;
  symbol: string;
}> {
  const quotes =
    (requestBody as any)?.params?.[0]?.context?.quote?.quotes;
  if (!Array.isArray(quotes)) return [];

  return quotes.flatMap((quote) => {
    const deficits = quote?.assetDeficits;
    if (!Array.isArray(deficits)) return [];

    return deficits.map((deficit) => {
      const decimals =
        typeof deficit?.decimals === "number" ? deficit.decimals : 18;
      const symbol =
        typeof deficit?.symbol === "string" ? deficit.symbol : "token";

      return {
        deficit: formatTokenAmount(deficit?.deficit, decimals),
        required: formatTokenAmount(deficit?.required, decimals),
        symbol,
      };
    });
  });
}

function formatTokenAmount(value: unknown, decimals: number): string {
  try {
    const raw =
      typeof value === "bigint"
        ? value
        : typeof value === "number"
          ? BigInt(value)
          : typeof value === "string" && value.startsWith("0x")
            ? BigInt(value)
            : typeof value === "string"
              ? BigInt(value)
              : 0n;
    if (raw === 0n) return "0";

    const scale = 10n ** BigInt(Math.max(0, decimals));
    const whole = raw / scale;
    const fraction = raw % scale;
    if (fraction === 0n) return whole.toString();

    const fractionText = fraction
      .toString()
      .padStart(Math.max(0, decimals), "0")
      .replace(/0+$/, "");
    return `${whole}.${fractionText}`;
  } catch {
    return "unknown";
  }
}

/** Common factories. */
export const rpcErrors = {
  userRejected: (message = "User rejected the request") =>
    new ProviderRpcError(RPC_ERROR_CODES.USER_REJECTED, message),
  unauthorized: (message = "The requested account has not been authorized by the user") =>
    new ProviderRpcError(RPC_ERROR_CODES.UNAUTHORIZED, message),
  unsupportedMethod: (method: string) =>
    new ProviderRpcError(RPC_ERROR_CODES.UNSUPPORTED_METHOD, `Method not supported: ${method}`),
  disconnected: (message = "The provider is disconnected from all chains") =>
    new ProviderRpcError(RPC_ERROR_CODES.DISCONNECTED, message),
  chainDisconnected: (message = "The provider is disconnected from the specified chain") =>
    new ProviderRpcError(RPC_ERROR_CODES.CHAIN_DISCONNECTED, message),
  unrecognizedChain: (message = "Unrecognized chain ID") =>
    new ProviderRpcError(RPC_ERROR_CODES.UNRECOGNIZED_CHAIN, message),
  invalidParams: (message = "Invalid params") =>
    new ProviderRpcError(RPC_ERROR_CODES.INVALID_PARAMS, message),
  internal: (message = "Internal error", data?: unknown) =>
    new ProviderRpcError(RPC_ERROR_CODES.INTERNAL, message, data),
};
