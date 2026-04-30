/**
 * Account and wallet-related type definitions
 */

/**
 * Account information stored in extension storage
 */
export interface Account {
  /** Ethereum address (0x...) */
  address: string;
  /** WebAuthn credential ID (base64) - managed by Porto SDK */
  credentialId: string;
  /** Public key (hex string) - managed by Porto SDK */
  publicKey: string;
  /** Display name for the account */
  displayName: string;
  /** Timestamp of account creation */
  createdAt: number;
  /** Last authentication timestamp */
  lastAuthAt?: number;
  /** Sequential account index for keychain label (Account #1, #2, etc.) */
  accountIndex: number;
}

/**
 * Connected dApp information
 */
export interface ConnectedDapp {
  /** Origin of the dApp (e.g., https://uniswap.org) */
  origin: string;
  /** Whether currently connected */
  connected: boolean;
  /** Granted permissions */
  permissions: string[];
  /** Connection timestamp */
  timestamp: number;
  /** Last interaction timestamp */
  lastInteractionAt?: number;
  /** Which account this connection is for */
  accountAddress: string;
  /** Per-origin chain context (defaults to settings.defaultChain if not set) */
  chainId?: number;
  /** dApp metadata */
  metadata?: {
    name?: string;
    icon?: string;
  };
}

/**
 * User settings
 */
export interface Settings {
  /** Default chain ID */
  defaultChain: number;
  /**
   * Auto-lock idle timeout in minutes.
   * - Positive numbers: idle-lock after N minutes.
   * - `0`: popup-side "never" (no idle auto-lock). The popup's
   *   `AutoLockMinutes` union stores this as the string `"never"`;
   *   `0` is just the wire/storage form.
   */
  autoLockTimeout: number;
  /** Show test networks */
  showTestNetworks?: boolean;
  /** Currency for displaying values */
  currency?: string;
  /** Language preference */
  language?: string;
  /**
   * Persisted "user has seen the welcome flow" marker. The popup
   * derives an in-memory `isOnboardingActive` flag on hydrate from this
   * value plus `accountOrder.length`; the welcome flow renders while
   * that in-memory flag is true. Once persisted as `true` here, future
   * popup boots never re-arm the in-memory flag, so a wipe-and-recreate
   * does NOT replay onboarding.
   *
   * Backfilled to `true` for users who already had accounts when this
   * field was introduced.
   */
  hasCompletedOnboarding?: boolean;
}

/**
 * Transaction record for history
 */
export interface Transaction {
  /** Unique transaction ID */
  id: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Value in hex wei */
  value: string;
  /** Transaction data */
  data: string;
  /** Chain ID */
  chainId: number;
  /** Transaction status */
  status: TransactionStatus;
  /** Origin dApp (if initiated from dApp) */
  origin?: string;
  /** Creation timestamp */
  timestamp: number;
  /** Transaction hash (intent ID from Porto) */
  hash?: string;
  /** Confirmation timestamp */
  confirmedAt?: number;
  /** Error message (if failed) */
  error?: string;
  /** Gas estimate */
  gasEstimate?: string;
  /** Gas price */
  gasPrice?: string;
}

/**
 * Transaction status enum
 */
export enum TransactionStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  SENT = "sent",
  CONFIRMED = "confirmed",
  FAILED = "failed",
}

/**
 * Balance information for a token
 */
export interface TokenBalance {
  /** Token contract address (or 'native' for native currency) */
  address: string;
  /** Token symbol (ETH, USDC, etc.) */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimals */
  decimals: number;
  /** Raw balance (in token's smallest unit) */
  balance: string;
  /** Formatted balance (human readable) */
  formatted: string;
  /** USD value as string from Porto (e.g., "1.00") */
  usdValue?: string;
  /** Token logo URL */
  logoUrl?: string;
  /** Whether this is a user-added custom token (not from Porto) */
  isCustom?: boolean;
}

/**
 * NFT metadata
 */
export interface NFT {
  /** NFT contract address */
  contractAddress: string;
  /** Token ID */
  tokenId: string;
  /** NFT name */
  name?: string;
  /** NFT description */
  description?: string;
  /** Image URL */
  imageUrl?: string;
  /** Collection name */
  collectionName?: string;
  /** Chain ID */
  chainId: number;
}

/**
 * Cached token metadata (doesn't change)
 */
export interface TokenMetadata {
  /** Token contract address */
  address: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimals */
  decimals: number;
  /** Chain ID where this token exists */
  chainId: number;
  /** Cache timestamp */
  cachedAt: number;
}
