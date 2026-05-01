/**
 * Porto SDK Type Definitions
 * Types for Porto RPC methods used in the wallet
 */

/**
 * Asset diff entry as returned on the wire by Porto.
 * See node_modules/porto/src/core/internal/relay/schema/capabilities.ts — `assetDiffs`.
 * `value` is a hex-encoded bigint; `fiat.value` is a decimal string; `direction`
 * is always present; `type` discriminates native (null) vs erc20 vs erc721.
 * The per-account assignment and per-chain grouping is preserved by
 * `PortoAssetDiffs` below.
 */
export interface PortoAssetDiffEntry {
  address?: string | null;
  decimals?: number | null;
  direction: 'incoming' | 'outgoing';
  fiat?: {
    currency: string;
    /** Decimal string (wire format). */
    value: string;
  };
  name?: string | null;
  symbol: string;
  /** 'erc20' | 'erc721' | null (native). */
  type: 'erc20' | 'erc721' | null;
  /** Hex-encoded bigint (wire format). */
  value: string;
  /** Present when type === 'erc721'. */
  uri?: string;
}

/**
 * Asset diffs keyed by chain id (hex). Each entry is a tuple of
 * (account address, list of per-token diffs for that account).
 */
export type PortoAssetDiffs = Record<
  string,
  ReadonlyArray<readonly [string, ReadonlyArray<PortoAssetDiffEntry>]>
>;

/**
 * Fee totals keyed by chain id (hex). `value` is a decimal string.
 */
export type PortoFeeTotals = Record<
  string,
  { currency: string; value: string }
>;

/**
 * Porto wallet_getCallsHistory response entry.
 * Status codes per EIP-5792: 1xx=pending, 2xx=success, 4xx/5xx=failure.
 */
export interface PortoHistoryEntry {
  id: string;
  status: number;
  timestamp?: number;
  transactions?: Array<{
    chainId: string; // Hex string like "0x2105"
    transactionHash: string;
  }>;
  /** Index of the bundle against the account (Porto relay ordering). */
  index?: number;
  /** Hash of the key that signed the bundle (admin or session). */
  keyHash?: string;
  /** Bundle capabilities. `quotes` left unknown — caller narrows if needed. */
  capabilities?: {
    assetDiffs?: PortoAssetDiffs;
    feeTotals?: PortoFeeTotals;
    quotes?: unknown;
  };
  // Legacy fields (may not be present)
  chainId?: string | number;
  atomic?: boolean;
  receipts?: Array<{
    transactionHash?: string;
    /** Hex (per EIP-5792 / Porto SDK `Hex.fromNumber`). */
    blockNumber?: string;
    /** Hex (receipt.status from the chain, e.g. "0x1" = success). */
    status?: string;
  }>;
}

/**
 * Porto wallet_getCallsStatus response.
 * Status codes per EIP-5792: 1xx=pending, 2xx=success, 4xx/5xx=failure.
 */
export interface PortoCallsStatus {
  id: string;
  chainId: number;
  status: number;
  atomic: boolean;
  receipts?: Array<{
    transactionHash: string;
    /** Hex. */
    blockNumber: string;
    /** Hex. */
    status: string;
    /** Hex block hash. */
    blockHash?: string;
    /** Hex gas-used count. */
    gasUsed?: string;
    /** Raw event logs emitted by the bundle's transactions. */
    logs?: Array<{
      address: string;
      data: string;
      topics: string[];
    }>;
  }>;
}

/**
 * Porto asset metadata from wallet_getAssets
 */
export interface PortoAssetMetadata {
  decimals: number;
  symbol: string;
  name?: string;
  fiat?: {
    value: string;
    currency: string;
  };
}

/**
 * Porto asset from wallet_getAssets
 * Note: Properties are nested in metadata object
 */
export interface PortoAsset {
  address: string; // Contract address, or 'native' for native currency
  balance: string; // Hex string (e.g., "0xf4240")
  type: 'native' | 'erc20';
  metadata: PortoAssetMetadata;
}

/**
 * Porto wallet_getAssets response
 * Keyed by hex chain ID (e.g., "0x2105" for Base)
 */
export type PortoAssets = Record<string, PortoAsset[]>;

/**
 * Helper to check if Porto status indicates success
 */
export function isPortoStatusSuccess(status: number): boolean {
  return status === 200;
}

/**
 * Helper to check if Porto status indicates pending
 */
export function isPortoStatusPending(status: number): boolean {
  return status === 100;
}

/**
 * Helper to check if Porto status indicates a terminal failure.
 * Terminal = anything that isn't pending (1xx) or success (200). That
 * includes 3xx offchain failures, which the old `>= 400` check missed —
 * the transaction watcher would poll those forever.
 */
export function isPortoStatusFailed(status: number): boolean {
  return status >= 300;
}

/**
 * Convert Porto status code to human-readable status
 */
export function portoStatusToString(status: number): 'pending' | 'confirmed' | 'failed' {
  if (status === 100) return 'pending';
  if (status === 200) return 'confirmed';
  return 'failed';
}

/**
 * Fee token info from wallet_getCapabilities.
 * Mirrors Porto's relay Token schema
 * (node_modules/porto/src/core/internal/relay/schema/token.ts).
 */
export interface FeeToken {
  address: string;
  decimals: number;
  symbol: string;
  uid: string;
  feeToken?: boolean;
  interop?: boolean;
  nativeRate?: string;
}

/**
 * Chain capabilities from wallet_getCapabilities.
 * Mirrors what Porto's relay-mode action returns (see
 * node_modules/porto/src/core/internal/modes/relay.ts:208-229).
 */
export interface ChainCapabilities {
  feeToken: {
    supported: boolean;
    tokens: FeeToken[];
  };
  atomic?: {
    status: 'supported' | 'unsupported';
  };
  merchant?: {
    supported: boolean;
  };
  permissions?: {
    supported: boolean;
  };
  requiredFunds?: {
    supported: boolean;
    tokens: FeeToken[];
  };
}

// ==================== PERMISSION TYPES ====================

/**
 * Permission call restriction.
 * Porto's schema (node_modules/porto/src/core/internal/schema/key.ts:31-46)
 * is a discriminated union — an entry may restrict by `to` alone, by
 * `signature` alone, or by both. Matching it here keeps the type honest.
 */
export type PermissionCall =
  | { to: string; signature?: string; selector?: string }
  | { signature: string; to?: string; selector?: string };

/**
 * Spend limit for permissions
 */
export interface SpendLimit {
  token: string;                 // Token address (or 'native')
  limit: string;                 // Max amount (hex)
  period: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
}

/**
 * Fee token for permission request.
 * Matches Porto's schema (node_modules/porto/src/core/internal/schema/key.ts:50):
 *   { limit: string (e.g. "100" or "0.5"), symbol?: 'native' | TokenSymbol }
 * `limit` is the total fees the session key is allowed to spend in this
 * token's units; `symbol` selects the fee token ('native' = chain native).
 */
export interface PermissionFeeToken {
  limit: string;
  symbol?: 'native' | string;
}

/**
 * Permission request structure.
 * Porto schema (`core/internal/schema/permissions.ts:22-23`):
 * - `expiry` is `z.number().gte(1)`.
 * - `feeToken` is `z.nullable(Key.FeeToken)` — `null` explicitly means
 *   "this session key cannot pay fees".
 */
export interface PermissionRequest {
  expiry: number;                       // Unix timestamp, >= 1
  permissions: {
    calls?: PermissionCall[];           // Allowed contract calls
    spend?: SpendLimit[];               // Spend limits
  };
  feeToken: PermissionFeeToken | null;  // null = no fee-paying capability
  key?: {                               // Optional custom key
    publicKey: string;
    type: 'secp256k1' | 'p256' | 'webauthn-p256';
  };
}

/**
 * Granted permission (response from wallet_grantPermissions).
 * Matches Porto's schema (wallet_grantPermissions.Response) —
 * `address` and `chainId` identify the account + chain the permission
 * applies to; `createdAt` was a Sigby-side invention and isn't returned
 * by the relay.
 */
export interface GrantedPermission {
  id: string;
  address: string;
  chainId: string;               // Hex
  expiry: number;
  key: {
    publicKey: string;
    type: string;
  };
  permissions: {
    calls?: PermissionCall[];
    spend?: SpendLimit[];
  };
}

/**
 * Active permission (from wallet_getPermissions).
 * Porto emits the same shape as GrantedPermission; liveness is derived from `expiry`.
 */
export type Permission = GrantedPermission;

// ==================== KEY TYPES ====================

/**
 * Account key (from wallet_getKeys)
 */
export interface AccountKey {
  id: string;
  publicKey: string;
  type: 'address' | 'p256' | 'secp256k1' | 'webauthn-p256';
  role: 'admin' | 'session';
  prehash?: boolean;
  createdAt?: number;
  permissions?: {
    calls?: PermissionCall[];
    spend?: SpendLimit[];
  };
}

// ==================== RELAY HEALTH ====================

/**
 * Relay health status
 */
export interface RelayHealth {
  status: 'online' | 'offline' | 'degraded';
  latency: number | null;
  version?: string;
  error?: string;
}
