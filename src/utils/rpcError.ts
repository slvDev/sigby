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
  if (err === undefined || err === null) return "";
  if (typeof err === "string") return err;
  if (isSerializedRpcError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
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
