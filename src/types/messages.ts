/**
 * Message types for communication between extension components
 * (content script ↔ background ↔ popup ↔ offscreen)
 */

/**
 * All available message types in the extension
 */
export enum MessageType {
  // Account management (popup ↔ background)
  CREATE_ACCOUNT = "CREATE_ACCOUNT",
  CONNECT_ACCOUNT = "CONNECT_ACCOUNT",
  GET_ACCOUNT = "GET_ACCOUNT",
  GET_ALL_ACCOUNTS = "GET_ALL_ACCOUNTS",
  SWITCH_ACCOUNT = "SWITCH_ACCOUNT",
  UPDATE_ACCOUNT = "UPDATE_ACCOUNT",
  DELETE_ACCOUNT = "DELETE_ACCOUNT",

  // Per-account dApp management
  GET_ACCOUNT_DAPPS = "GET_ACCOUNT_DAPPS",
  CONNECT_ACCOUNT_DAPP = "CONNECT_ACCOUNT_DAPP",
  DISCONNECT_ACCOUNT_DAPP = "DISCONNECT_ACCOUNT_DAPP",

  // dApp RPC bridge
  DAPP_REQUEST = "DAPP_REQUEST",

  // Network / chain (popup UI)
  SWITCH_CHAIN = "SWITCH_CHAIN",

  // Wallet state
  GET_STATE = "GET_STATE",

  // Events (emitted to dApps)
  EMIT_EVENT = "EMIT_EVENT",

  // Connection approval flow
  APPROVE_CONNECTION = "APPROVE_CONNECTION",
  REJECT_CONNECTION = "REJECT_CONNECTION",
  IS_ORIGIN_KNOWN = "IS_ORIGIN_KNOWN",

  // Signing approval flow (SW-death recoverable via storage)
  GET_PENDING_SIGNING = "GET_PENDING_SIGNING",
  APPROVE_SIGNING = "APPROVE_SIGNING",
  REJECT_SIGNING = "REJECT_SIGNING",
  POLL_SIGNING_REQUEST = "POLL_SIGNING_REQUEST",
  LIST_PENDING_APPROVALS = "LIST_PENDING_APPROVALS",
  RESUME_PENDING_APPROVAL = "RESUME_PENDING_APPROVAL",

  // Custom token management
  GET_TOKEN_BALANCES = "GET_TOKEN_BALANCES",
  GET_TOKEN_BALANCE = "GET_TOKEN_BALANCE",
  ADD_CUSTOM_TOKEN = "ADD_CUSTOM_TOKEN",
  REMOVE_CUSTOM_TOKEN = "REMOVE_CUSTOM_TOKEN",
  GET_CUSTOM_TOKENS = "GET_CUSTOM_TOKENS",

  // Settings
  GET_SETTINGS = "GET_SETTINGS",
  UPDATE_SETTINGS = "UPDATE_SETTINGS",

  // Lock status (dApp-observable via _metamask.isUnlocked shim)
  IS_WALLET_LOCKED = "IS_WALLET_LOCKED",
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
 * Standard response structure for all messages.
 *
 * `error` may be a plain string (legacy / internal-only paths) or a structured
 * `{ code, message, data? }` shape when the error will be surfaced to a dApp.
 * dApp-boundary handlers in messageHandler.ts should prefer the structured
 * form so the injected provider can rehydrate a ProviderRpcError with the
 * EIP-1193 numeric code the dApp expects.
 */
export interface MessageResponse<T = any> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data (if successful) */
  data?: T;
  /** Error (string for internal paths, structured for dApp-boundary errors) */
  error?: string | { code: number; message: string; data?: unknown };
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
  /**
   * Optional chain override. Used by the popup when it dispatches a
   * DAPP_REQUEST for its own needs (e.g. eth_getBalance) — without this,
   * the background falls back to the per-origin chain for an origin it
   * doesn't know and silently serves balances on the wrong chain.
   */
  chainId?: number;
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

/**
 * Poll signing request payload (from content script, after SW restart)
 */
export interface PollSigningRequestPayload {
  /** Request ID to poll */
  requestId: string;
}

/**
 * Poll signing request response (sent back to content script)
 */
export interface PollSigningRequestResponse {
  /** Current state of the request */
  state: "pending" | "approved" | "rejected" | "not-found";
  /** Signed result when state is approved */
  result?: string;
  /** Error shape when state is rejected */
  error?: { code: number; message: string };
}

/**
 * Summary entry for the Home-page pending-approvals queue.
 */
export interface PendingApprovalSummary {
  requestId: string;
  method: string;
  origin: string;
  createdAt: number;
  metadata?: {
    favicon?: string;
    title?: string;
  };
}

/**
 * Resume a dismissed approval — reopens the approval popup.
 */
export interface ResumePendingApprovalPayload {
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

