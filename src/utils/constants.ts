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
  ETHEREUM: 1,
  GOERLI: 5,
  SEPOLIA: 11155111,
  BASE: 8453,
  BASE_GOERLI: 84531,
  ARBITRUM: 42161,
  ARBITRUM_GOERLI: 421613,
  OPTIMISM: 10,
  OPTIMISM_GOERLI: 420,
  POLYGON: 137,
  POLYGON_MUMBAI: 80001,
} as const;

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
  /** Transaction status polling interval (ms) */
  STATUS_POLL_INTERVAL: 2000,
  /** Max polling attempts before giving up */
  MAX_POLL_ATTEMPTS: 150, // 5 minutes at 2s intervals
} as const;

/**
 * WebAuthn configuration
 */
export const WEBAUTHN_CONFIG = {
  /** Timeout for WebAuthn operations (ms) */
  TIMEOUT: 60000,
  /** Relying party name */
  RP_NAME: "Porto Wallet",
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
  NAME: "Porto Wallet",
  VERSION: "0.1.0",
  DESCRIPTION: "Next-gen crypto wallet with biometric authentication",
  PROVIDER_RDNS: "sh.porto.wallet",
  PROVIDER_UUID: "porto-wallet-extension",
} as const;
