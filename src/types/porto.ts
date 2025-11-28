/**
 * Porto SDK Type Definitions
 * Types for Porto RPC methods used in the wallet
 */

/**
 * Porto wallet_getCallsHistory response entry
 * Status codes: 100=pending, 200=success, 400/500/600=failure
 */
export interface PortoHistoryEntry {
  id: string;
  status: number;
  timestamp?: number;
  transactions?: Array<{
    chainId: string; // Hex string like "0x2105"
    transactionHash: string;
  }>;
  // Legacy fields (may not be present)
  chainId?: string | number;
  atomic?: boolean;
  receipts?: Array<{
    transactionHash?: string;
    blockNumber?: number;
    status?: string;
  }>;
}

/**
 * Porto wallet_getCallsStatus response
 * Status codes: 100=pending, 200=success, 400/500/600=failure
 */
export interface PortoCallsStatus {
  id: string;
  chainId: number;
  status: number;
  atomic: boolean;
  receipts?: Array<{
    transactionHash: string;
    blockNumber: number;
    status: string;
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
 * Helper to check if Porto status indicates failure
 */
export function isPortoStatusFailed(status: number): boolean {
  return status >= 400;
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
 * Fee token info from wallet_getCapabilities
 */
export interface FeeToken {
  address: string;
  decimals: number;
  symbol: string;
  nativeRate?: string;
}

/**
 * Chain capabilities from wallet_getCapabilities
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
}

// ==================== PERMISSION TYPES ====================

/**
 * Permission call restriction
 */
export interface PermissionCall {
  to: string;                    // Contract address
  signature?: string;            // Function signature (e.g., "transfer(address,uint256)")
  selector?: string;             // Function selector (4 bytes)
}

/**
 * Spend limit for permissions
 */
export interface SpendLimit {
  token: string;                 // Token address (or 'native')
  limit: string;                 // Max amount (hex)
  period: 'transaction' | 'day' | 'week' | 'month' | 'total';
}

/**
 * Fee token for permission request
 */
export interface PermissionFeeToken {
  address?: string;              // Token address (omit for native)
  native?: boolean;              // True to use native token (ETH)
}

/**
 * Permission request structure
 * Note: When calling wallet_grantPermissions, Porto requires:
 * - At least 1 call in permissions.calls
 * - feeToken with a limit
 */
export interface PermissionRequest {
  expiry: number;                // Unix timestamp
  permissions: {
    calls?: PermissionCall[];    // Allowed contract calls
    spend?: SpendLimit[];        // Spend limits
  };
  feeToken?: PermissionFeeToken; // Fee token for gas
  key?: {                        // Optional custom key
    publicKey: string;
    type: 'secp256k1' | 'p256' | 'webauthn-p256';
  };
}

/**
 * Granted permission (response from wallet_grantPermissions)
 */
export interface GrantedPermission {
  id: string;                    // Permission ID
  expiry: number;
  key: {
    publicKey: string;
    type: string;
  };
  permissions: {
    calls?: PermissionCall[];
    spend?: SpendLimit[];
  };
  createdAt: number;
}

/**
 * Active permission (from wallet_getPermissions)
 */
export interface Permission extends GrantedPermission {
  isActive: boolean;
  usageCount?: number;
  lastUsed?: number;
}

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
