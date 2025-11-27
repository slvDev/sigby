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
  /** Auto-lock timeout in minutes (0 = disabled) */
  autoLockTimeout: number;
  /** Show test networks */
  showTestNetworks?: boolean;
  /** Currency for displaying values */
  currency?: string;
  /** Language preference */
  language?: string;
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
 * Wallet state (runtime state, not persisted)
 */
export interface WalletState {
  /** Current account (null if not authenticated) */
  account: Account | null;
  /** Current chain ID */
  chainId: number;
  /** Whether wallet is locked */
  isLocked: boolean;
  /** Whether wallet is initialized */
  isInitialized: boolean;
  /** Connected dApps map (origin -> ConnectedDapp) */
  connectedDapps: Map<string, ConnectedDapp>;
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
  /** Value in USD */
  valueUSD?: number;
  /** Token logo URL */
  logoUrl?: string;
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
