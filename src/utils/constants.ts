/**
 * Application constants and configuration values
 */

/**
 * Porto Relay configuration
 */
export const PORTO_CONFIG = {
  /** Porto RPC relay URL */
  RELAY_URL: "https://rpc.porto.sh",
  /** Porto ID service URL */
  ID_URL: "https://id.porto.sh",
  /** Default timeout for Porto operations (ms) */
  TIMEOUT: 60000,
} as const;

/**
 * Supported chain IDs
 */
export const CHAIN_IDS = {
  // Mainnets
  ETHEREUM: 1,
  BASE: 8453,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  POLYGON: 137,
  // Testnets
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  ARBITRUM_SEPOLIA: 421614,
  OPTIMISM_SEPOLIA: 11155420,
  POLYGON_AMOY: 80002,
  HOLESKY: 17000,
} as const;

/**
 * Chain configuration interface
 */
export interface ChainConfig {
  id: number;
  name: string;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  isTestnet: boolean;
}

/**
 * Full chain configurations for all supported chains
 */
export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // Mainnets
  [CHAIN_IDS.ETHEREUM]: {
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com", "https://ethereum.publicnode.com"],
    blockExplorerUrls: ["https://etherscan.io"],
    isTestnet: false,
  },
  [CHAIN_IDS.BASE]: {
    id: 8453,
    name: "Base",
    shortName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org", "https://base.llamarpc.com"],
    blockExplorerUrls: ["https://basescan.org"],
    isTestnet: false,
  },
  [CHAIN_IDS.ARBITRUM]: {
    id: 42161,
    name: "Arbitrum One",
    shortName: "ARB",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.llamarpc.com"],
    blockExplorerUrls: ["https://arbiscan.io"],
    isTestnet: false,
  },
  [CHAIN_IDS.OPTIMISM]: {
    id: 10,
    name: "Optimism",
    shortName: "OP",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.optimism.io", "https://optimism.llamarpc.com"],
    blockExplorerUrls: ["https://optimistic.etherscan.io"],
    isTestnet: false,
  },
  [CHAIN_IDS.POLYGON]: {
    id: 137,
    name: "Polygon",
    shortName: "POL",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com", "https://polygon.llamarpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
    isTestnet: false,
  },
  // Testnets
  [CHAIN_IDS.SEPOLIA]: {
    id: 11155111,
    name: "Sepolia",
    shortName: "SEP",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org", "https://ethereum-sepolia.publicnode.com"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    isTestnet: true,
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    id: 84532,
    name: "Base Sepolia",
    shortName: "BSEP",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
    isTestnet: true,
  },
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: {
    id: 421614,
    name: "Arbitrum Sepolia",
    shortName: "ASEP",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
    isTestnet: true,
  },
  [CHAIN_IDS.OPTIMISM_SEPOLIA]: {
    id: 11155420,
    name: "Optimism Sepolia",
    shortName: "OSEP",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.optimism.io"],
    blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
    isTestnet: true,
  },
  [CHAIN_IDS.POLYGON_AMOY]: {
    id: 80002,
    name: "Polygon Amoy",
    shortName: "AMOY",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com"],
    isTestnet: true,
  },
  [CHAIN_IDS.HOLESKY]: {
    id: 17000,
    name: "Holesky",
    shortName: "HOL",
    nativeCurrency: { name: "Holesky Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://ethereum-holesky.publicnode.com"],
    blockExplorerUrls: ["https://holesky.etherscan.io"],
    isTestnet: true,
  },
};

/**
 * Mainnet chain IDs array
 */
export const MAINNET_CHAIN_IDS = [
  CHAIN_IDS.ETHEREUM,
  CHAIN_IDS.BASE,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.OPTIMISM,
  CHAIN_IDS.POLYGON,
] as const;

/**
 * Testnet chain IDs array
 */
export const TESTNET_CHAIN_IDS = [
  CHAIN_IDS.SEPOLIA,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.ARBITRUM_SEPOLIA,
  CHAIN_IDS.OPTIMISM_SEPOLIA,
  CHAIN_IDS.POLYGON_AMOY,
  CHAIN_IDS.HOLESKY,
] as const;

/**
 * Default chain ID on first install
 */
export const DEFAULT_CHAIN_ID = CHAIN_IDS.BASE;

/**
 * Storage keys for chrome.storage.local
 */
export const STORAGE_KEYS = {
  // Multi-account storage
  ACCOUNTS: "accounts", // Record<address, Account>
  ACTIVE_ACCOUNT: "activeAccount", // Currently active account address
  ACCOUNT_ORDER: "accountOrder", // Array of addresses for UI display order
  ACCOUNT_COUNT: "accountCount", // Total accounts created (for keychain numbering)

  // Per-account dApp connections
  ACCOUNT_DAPPS: "accountDapps", // Record<address, Record<origin, ConnectedDapp>>

  // Global settings
  SETTINGS: "settings",
  TRANSACTION_HISTORY: "transactionHistory",

  // Token management (Phase 7)
  CUSTOM_TOKENS: "customTokens", // Record<address, Record<chainId, string[]>>
  TOKEN_METADATA_CACHE: "tokenMetadataCache", // Record<tokenAddress, TokenMetadata>

  // Persisted signing requests (survives SW termination)
  PENDING_SIGNING_REQUESTS: "pendingSigningRequests", // Record<requestId, PersistedSigningRequest>

  // Legacy keys (kept for migration)
  ACCOUNT: "account",
  CONNECTED_DAPPS: "connectedDapps",
} as const;

/**
 * Message passing configuration
 */
export const MESSAGE_CONFIG = {
  /** Timeout for message responses (ms) */
  RESPONSE_TIMEOUT: 30000,
  /** Max retries for failed messages */
  MAX_RETRIES: 3,
} as const;

/**
 * UI configuration
 */
export const UI_CONFIG = {
  /** Popup window dimensions */
  POPUP_WIDTH: 400,
  POPUP_HEIGHT: 600,
  /** Auto-lock timeout options (minutes) */
  AUTO_LOCK_OPTIONS: [0, 5, 10, 30, 60],
  /** Default auto-lock timeout (minutes, 0 = disabled) */
  DEFAULT_AUTO_LOCK: 0,
} as const;

/**
 * Transaction configuration
 */
export const TRANSACTION_CONFIG = {
  /** Max transactions to store in history */
  MAX_HISTORY_SIZE: 100,
  /** Transaction status polling interval (ms) - 1 minute (chrome.alarms minimum) */
  STATUS_POLL_INTERVAL: 60000,
  /** Max polling attempts before giving up */
  MAX_POLL_ATTEMPTS: 10, // 10 minutes at 1 minute intervals
} as const;

/**
 * WebAuthn configuration
 */
export const WEBAUTHN_CONFIG = {
  /** Timeout for WebAuthn operations (ms) */
  TIMEOUT: 60000,
  /** Relying party name */
  RP_NAME: "Berth",
  /** Relying party ID - domain for passkey association */
  RP_ID: "porto.sh",
  /** User verification requirement */
  USER_VERIFICATION: "required" as const,
  /** Authenticator attachment */
  AUTHENTICATOR_ATTACHMENT: "platform" as const,
  /** Resident key requirement */
  RESIDENT_KEY: "required" as const,
  /** Supported algorithms for passkey creation */
  ALGORITHMS: [
    { type: "public-key" as const, alg: -7 },  // ES256 (P-256)
    { type: "public-key" as const, alg: -257 }, // RS256 (RSA)
  ],
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  // Authentication errors
  NO_ACCOUNT: "No account found. Please create or connect an account.",
  AUTH_FAILED: "Authentication failed. Please try again.",
  WEBAUTHN_NOT_SUPPORTED: "WebAuthn is not supported in this browser.",
  WEBAUTHN_CANCELLED: "Authentication was cancelled.",
  WEBAUTHN_TIMEOUT: "Biometric authentication timed out.",
  NO_PASSKEY_FOUND: "No passkey found. Please create an account first.",
  PASSKEY_SYNC_REQUIRED: "Please enable iCloud Keychain or Google Password Manager.",
  INVALID_SIGNATURE: "Invalid WebAuthn signature.",

  // Transaction errors
  TX_REJECTED: "Transaction was rejected by user.",
  TX_FAILED: "Transaction failed to send.",
  INSUFFICIENT_FUNDS: "Insufficient funds for this transaction.",
  INVALID_ADDRESS: "Invalid Ethereum address.",
  QUOTE_EXPIRED: "Fee quote expired. Please retry transaction.",
  INTENT_SIMULATION_FAILED: "Transaction simulation failed.",
  INTENT_SUBMISSION_FAILED: "Transaction submission failed.",

  // Validation errors
  INVALID_TX_OBJECT: "Invalid transaction object.",
  INVALID_TO_ADDRESS: "Invalid 'to' address format.",
  INVALID_FROM_ADDRESS: "Invalid 'from' address format.",
  INVALID_VALUE_FORMAT: "Invalid value format (must be hex).",
  INVALID_DATA_FORMAT: "Invalid data format (must be hex).",
  INVALID_GAS_FORMAT: "Invalid gas format (must be hex).",
  INVALID_NONCE_FORMAT: "Invalid nonce format (must be hex).",
  INVALID_MESSAGE_FORMAT: "Invalid message format.",
  INVALID_TYPED_DATA: "Invalid typed data format.",
  INVALID_ORIGIN: "Invalid or missing dApp origin.",

  // Signing errors
  SIGNING_REJECTED: "User rejected the signing request.",
  SIGNING_TIMEOUT: "Signing request timed out.",
  SIGNING_FAILED: "Signing operation failed.",
  SIGNING_REQUEST_NOT_FOUND: "Signing request not found or expired.",

  // Network errors
  NETWORK_ERROR: "Network request failed. Please check your connection.",
  PORTO_UNAVAILABLE: "Porto service is unavailable. Please try again later.",
  PORTO_RELAY_ERROR: "Porto Relay unavailable. Please try again.",
  UNSUPPORTED_CHAIN: "This chain is not supported.",

  // dApp errors
  DAPP_NOT_CONNECTED: "dApp is not connected. Please connect first.",
  PERMISSION_DENIED: "Permission denied.",
  INVALID_REQUEST: "Invalid request from dApp.",

  // General errors
  UNKNOWN_ERROR: "An unknown error occurred.",
  SERVICE_WORKER_ERROR: "Extension service worker error.",
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  ACCOUNT_CREATED: "Account created successfully!",
  ACCOUNT_CONNECTED: "Account connected successfully!",
  TRANSACTION_SENT: "Transaction sent successfully!",
  DAPP_CONNECTED: "dApp connected successfully!",
} as const;

/**
 * EIP-1193 provider events
 */
export const PROVIDER_EVENTS = {
  ACCOUNTS_CHANGED: "accountsChanged",
  CHAIN_CHANGED: "chainChanged",
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  MESSAGE: "message",
} as const;

/**
 * Extension metadata
 */
export const EXTENSION_METADATA = {
  NAME: "Berth",
  VERSION: "0.1.0",
  DESCRIPTION: "A browser wallet that signs with a passkey. Built on Porto.",
  PROVIDER_RDNS: "com.berthwallet",
  PROVIDER_UUID: "e6a4f8b2-9c3d-4a1b-8b5f-7d2c4e6a1f93",
} as const;
