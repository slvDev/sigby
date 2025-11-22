/**
 * Message types for communication between extension components
 * (content script ↔ background ↔ popup ↔ offscreen)
 */

/**
 * All available message types in the extension
 */
export enum MessageType {
  // Authentication & Account Management
  CREATE_ACCOUNT = "CREATE_ACCOUNT",
  CONNECT_ACCOUNT = "CONNECT_ACCOUNT",
  DISCONNECT_ACCOUNT = "DISCONNECT_ACCOUNT",
  GET_ACCOUNT = "GET_ACCOUNT",

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

  // dApp Connection Management
  REQUEST_CONNECTION = "REQUEST_CONNECTION",
  APPROVE_CONNECTION = "APPROVE_CONNECTION",
  REJECT_CONNECTION = "REJECT_CONNECTION",
  DISCONNECT_DAPP = "DISCONNECT_DAPP",
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
 * Chain switch payload
 */
export interface ChainSwitchPayload {
  /** Chain ID to switch to */
  chainId: number;
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
