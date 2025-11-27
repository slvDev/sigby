/**
 * Message types for communication between extension components
 * (content script ↔ background ↔ popup ↔ offscreen)
 */

/**
 * All available message types in the extension
 */
export enum MessageType {
  // Authentication & Account Management (Legacy - single account)
  CREATE_ACCOUNT = "CREATE_ACCOUNT",
  CONNECT_ACCOUNT = "CONNECT_ACCOUNT",
  DISCONNECT_ACCOUNT = "DISCONNECT_ACCOUNT",
  GET_ACCOUNT = "GET_ACCOUNT",

  // Multi-Account Management
  GET_ALL_ACCOUNTS = "GET_ALL_ACCOUNTS",
  SWITCH_ACCOUNT = "SWITCH_ACCOUNT",
  UPDATE_ACCOUNT = "UPDATE_ACCOUNT",
  DELETE_ACCOUNT = "DELETE_ACCOUNT",

  // Per-Account dApp Management
  GET_ACCOUNT_DAPPS = "GET_ACCOUNT_DAPPS",
  CONNECT_ACCOUNT_DAPP = "CONNECT_ACCOUNT_DAPP",
  DISCONNECT_ACCOUNT_DAPP = "DISCONNECT_ACCOUNT_DAPP",

  // dApp Communication (EIP-1193 Methods)
  DAPP_REQUEST = "DAPP_REQUEST",
  ETH_REQUEST_ACCOUNTS = "ETH_REQUEST_ACCOUNTS",
  ETH_ACCOUNTS = "ETH_ACCOUNTS",
  ETH_CHAIN_ID = "ETH_CHAIN_ID",
  ETH_SEND_TRANSACTION = "ETH_SEND_TRANSACTION",
  ETH_SIGN = "ETH_SIGN",
  ETH_SIGN_TYPED_DATA = "ETH_SIGN_TYPED_DATA",
  ETH_SIGN_TYPED_DATA_V3 = "ETH_SIGN_TYPED_DATA_V3",
  ETH_SIGN_TYPED_DATA_V4 = "ETH_SIGN_TYPED_DATA_V4",
  PERSONAL_SIGN = "PERSONAL_SIGN",

  // Transaction Management
  APPROVE_TRANSACTION = "APPROVE_TRANSACTION",
  REJECT_TRANSACTION = "REJECT_TRANSACTION",
  GET_TRANSACTION = "GET_TRANSACTION",
  GET_TRANSACTION_STATUS = "GET_TRANSACTION_STATUS",

  // Network/Chain Management
  SWITCH_CHAIN = "SWITCH_CHAIN",
  ADD_CHAIN = "ADD_CHAIN",
  GET_CHAIN_FOR_ORIGIN = "GET_CHAIN_FOR_ORIGIN",
  GET_SUPPORTED_CHAINS = "GET_SUPPORTED_CHAINS",

  // State Management
  GET_STATE = "GET_STATE",
  UPDATE_STATE = "UPDATE_STATE",
  GET_PORTFOLIO = "GET_PORTFOLIO",

  // UI Actions
  OPEN_POPUP = "OPEN_POPUP",
  CLOSE_POPUP = "CLOSE_POPUP",

  // Events (emitted to dApps)
  EMIT_EVENT = "EMIT_EVENT",

  // WebAuthn (for offscreen document)
  WEBAUTHN_CREATE = "WEBAUTHN_CREATE",
  WEBAUTHN_GET = "WEBAUTHN_GET",

  // Porto SDK Operations (proxied to offscreen document)
  PORTO_CREATE_ACCOUNT = "PORTO_CREATE_ACCOUNT",
  PORTO_CONNECT_ACCOUNT = "PORTO_CONNECT_ACCOUNT",
  PORTO_SIGN_TRANSACTION = "PORTO_SIGN_TRANSACTION",

  // dApp Connection Management
  REQUEST_CONNECTION = "REQUEST_CONNECTION",
  APPROVE_CONNECTION = "APPROVE_CONNECTION",
  REJECT_CONNECTION = "REJECT_CONNECTION",
  DISCONNECT_DAPP = "DISCONNECT_DAPP",

  // Signing Request Management (Phase 4)
  GET_PENDING_SIGNING = "GET_PENDING_SIGNING",
  APPROVE_SIGNING = "APPROVE_SIGNING",
  REJECT_SIGNING = "REJECT_SIGNING",

  // Token Management (Phase 7)
  GET_TOKEN_BALANCES = "GET_TOKEN_BALANCES",
  GET_TOKEN_BALANCE = "GET_TOKEN_BALANCE",
  ADD_CUSTOM_TOKEN = "ADD_CUSTOM_TOKEN",
  REMOVE_CUSTOM_TOKEN = "REMOVE_CUSTOM_TOKEN",
  GET_CUSTOM_TOKENS = "GET_CUSTOM_TOKENS",
}

/**
 * Base message structure for all internal extension messages
 */
export interface Message<T = any> {
  /** Type of message being sent */
  type: MessageType;
  /** Optional payload data */
  payload?: T;
  /** Unique identifier for request-response correlation */
  requestId?: string;
}

/**
 * Standard response structure for all messages
 */
export interface MessageResponse<T = any> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data (if successful) */
  data?: T;
  /** Error message (if failed) */
  error?: string;
  /** Original request ID for correlation */
  requestId?: string;
}

/**
 * dApp request payload structure
 */
export interface DappRequestPayload {
  /** RPC method being requested */
  method: string;
  /** Parameters for the RPC method */
  params?: any[];
  /** Origin of the requesting dApp */
  origin: string;
}

/**
 * Transaction approval payload
 */
export interface TransactionPayload {
  /** Transaction ID */
  txId: string;
}

/**
 * Account payload structure
 */
export interface AccountPayload {
  /** Display name for the account */
  displayName?: string;
}

/**
 * Chain switch payload (for wallet_switchEthereumChain)
 */
export interface ChainSwitchPayload {
  /** Chain ID to switch to */
  chainId: number;
  /** Origin requesting the switch (for per-origin chain context) */
  origin?: string;
}

/**
 * Get chain for origin payload
 */
export interface GetChainForOriginPayload {
  /** dApp origin */
  origin: string;
}

/**
 * Event emission payload (for dApps)
 */
export interface EventPayload {
  /** Event name (e.g., 'accountsChanged', 'chainChanged') */
  event: string;
  /** Event data */
  data: any;
}

/**
 * WebAuthn creation options
 */
export interface WebAuthnCreatePayload {
  /** Challenge from server */
  challenge: Uint8Array;
  /** User ID */
  userId: Uint8Array;
  /** User name/display name */
  userName: string;
}

/**
 * WebAuthn get options
 */
export interface WebAuthnGetPayload {
  /** Challenge from server */
  challenge: Uint8Array;
  /** Optional credential ID to use */
  credentialId?: Uint8Array;
}

/**
 * Portfolio data response
 */
export interface PortfolioData {
  /** User's wallet address */
  address: string;
  /** Total portfolio value in USD */
  totalValue: number;
  /** 24h change percentage */
  change24h: number;
  /** Native balances across chains */
  balances: Array<{
    chainId: number;
    chainName: string;
    balance: string;
    formatted: string;
  }>;
  /** Token balances */
  tokens?: Array<{
    address: string;
    symbol: string;
    balance: string;
    value: number;
  }>;
}

// ==================== MULTI-ACCOUNT PAYLOADS ====================

/**
 * Switch account payload
 */
export interface SwitchAccountPayload {
  /** Address of account to switch to */
  address: string;
}

/**
 * Update account payload
 */
export interface UpdateAccountPayload {
  /** Address of account to update */
  address: string;
  /** Updated display name */
  displayName?: string;
}

/**
 * Delete account payload
 */
export interface DeleteAccountPayload {
  /** Address of account to delete */
  address: string;
}

/**
 * Get account dApps payload
 */
export interface GetAccountDappsPayload {
  /** Account address */
  address: string;
}

/**
 * Connect account to dApp payload
 */
export interface ConnectAccountDappPayload {
  /** Account address */
  address: string;
  /** dApp origin */
  origin: string;
  /** Optional dApp metadata */
  metadata?: {
    name?: string;
    icon?: string;
  };
}

/**
 * Disconnect account from dApp payload
 */
export interface DisconnectAccountDappPayload {
  /** Account address */
  address: string;
  /** dApp origin */
  origin: string;
}

// ==================== CONNECTION APPROVAL PAYLOADS ====================

/**
 * Request connection payload (from dApp)
 */
export interface RequestConnectionPayload {
  /** dApp origin */
  origin: string;
  /** Optional metadata */
  favicon?: string;
  title?: string;
}

/**
 * Approve connection payload (from popup)
 */
export interface ApproveConnectionPayload {
  /** dApp origin */
  origin: string;
  /** Account address to connect */
  accountAddress: string;
}

/**
 * Reject connection payload (from popup)
 */
export interface RejectConnectionPayload {
  /** dApp origin */
  origin: string;
  /** Account address */
  accountAddress: string;
}

// ==================== SIGNING REQUEST PAYLOADS (Phase 4) ====================

/**
 * Signing request data stored by DappManager
 */
export interface SigningRequest {
  /** Unique request identifier */
  requestId: string;
  /** Signing method (eth_sendTransaction, personal_sign, eth_signTypedData_v4) */
  method: string;
  /** Method parameters from dApp */
  params: any[];
  /** dApp origin */
  origin: string;
  /** Account address to sign with */
  accountAddress: string;
  /** Chain ID for the request */
  chainId: number;
  /** Timestamp when request was created */
  timestamp: number;
  /** dApp metadata */
  metadata?: {
    favicon?: string;
    title?: string;
  };
}

/**
 * Get pending signing request payload
 */
export interface GetPendingSigningPayload {
  /** Request ID to fetch */
  requestId: string;
}

/**
 * Approve signing request payload (from popup)
 */
export interface ApproveSigningPayload {
  /** Request ID */
  requestId: string;
  /** Signed result (transaction hash or signature) */
  result: string;
}

/**
 * Reject signing request payload (from popup)
 */
export interface RejectSigningPayload {
  /** Request ID */
  requestId: string;
}

// ==================== TOKEN MANAGEMENT PAYLOADS (Phase 7) ====================

/**
 * Get token balances payload
 */
export interface GetTokenBalancesPayload {
  /** Account address */
  address: string;
  /** Chain ID */
  chainId: number;
}

/**
 * Get single token balance payload
 */
export interface GetTokenBalancePayload {
  /** Account address */
  ownerAddress: string;
  /** Token contract address */
  tokenAddress: string;
  /** Chain ID */
  chainId: number;
}

/**
 * Add custom token payload
 */
export interface AddCustomTokenPayload {
  /** Account address */
  accountAddress: string;
  /** Token contract address */
  tokenAddress: string;
  /** Chain ID */
  chainId: number;
}

/**
 * Remove custom token payload
 */
export interface RemoveCustomTokenPayload {
  /** Account address */
  accountAddress: string;
  /** Token contract address */
  tokenAddress: string;
  /** Chain ID */
  chainId: number;
}

/**
 * Get custom tokens payload
 */
export interface GetCustomTokensPayload {
  /** Account address */
  accountAddress: string;
  /** Chain ID (optional, if omitted returns all chains) */
  chainId?: number;
}

/**
 * Get portfolio payload (already defined, ensuring it has correct structure)
 */
export interface GetPortfolioPayload {
  /** Account address */
  address: string;
  /** Chain IDs to include (optional, if omitted uses all chains) */
  chainIds?: number[];
}
