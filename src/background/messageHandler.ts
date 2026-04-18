/**
 * Message Handler
 * Routes messages between extension components and handles requests
 */

import type {
  Message,
  MessageResponse,
  DappRequestPayload,
  AccountPayload,
  TransactionPayload,
  ChainSwitchPayload,
  SwitchAccountPayload,
  UpdateAccountPayload,
  DeleteAccountPayload,
  GetAccountDappsPayload,
  ConnectAccountDappPayload,
  DisconnectAccountDappPayload,
  ApproveConnectionPayload,
  RejectConnectionPayload,
  GetPendingSigningPayload,
  ApproveSigningPayload,
  RejectSigningPayload,
  PollSigningRequestPayload,
  PollSigningRequestResponse,
  PendingApprovalSummary,
  ResumePendingApprovalPayload,
  GetTokenBalancesPayload,
  GetTokenBalancePayload,
  AddCustomTokenPayload,
  RemoveCustomTokenPayload,
  GetCustomTokensPayload,
  GetPortfolioPayload,
} from "../types/messages";
import { TransactionStatus, type Transaction } from "../types/account";
import { PortoService } from "./portoService";
import { AccountManager } from "./accountManager";
import { StorageManager } from "../utils/storage";
import { RpcHandler } from "./rpcHandler";
import { DappManager } from "./dappManager";
import { eventBroadcaster } from "./eventBroadcaster";
import { tokenService } from "./tokenService";
// portfolioService removed - using Porto's wallet_getAssets instead
// TransactionMonitor removed - using Porto's wallet_getCallsStatus instead
import { ERROR_MESSAGES, CHAIN_CONFIGS } from "../utils/constants";
import { MessageType as MT } from "../types/messages";
import {
  validateTransactionParams,
  validatePersonalSignParams,
  validateTypedDataParams,
  extractValidOrigin,
} from "../utils/validators";
import { RPC_ERROR_CODES, type SerializedRpcError } from "../utils/rpcError";

/**
 * Map Porto SDK errors to user-friendly messages
 */
function mapPortoError(error: Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes("not allowed") || msg.includes("cancelled") || msg.includes("canceled")) {
    return ERROR_MESSAGES.WEBAUTHN_CANCELLED;
  }
  if (msg.includes("timeout")) {
    return ERROR_MESSAGES.WEBAUTHN_TIMEOUT;
  }
  if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
    return ERROR_MESSAGES.INSUFFICIENT_FUNDS;
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  if (msg.includes("nonce") || msg.includes("replacement transaction")) {
    return "Transaction nonce conflict. Please try again.";
  }
  if (msg.includes("gas")) {
    return "Gas estimation failed. The transaction may fail.";
  }
  if (msg.includes("reverted") || msg.includes("revert")) {
    return "Transaction would revert. Check contract conditions.";
  }

  return error.message; // Fallback to original
}

/**
 * Convert any thrown value caught inside a signing/transaction handler into
 * a dApp-boundary error response with the correct EIP-1193 numeric code.
 *
 * - DappManager.rejectSigning throws `Error("User rejected the signing request")`
 *   when the approval popup is closed; map that to 4001.
 * - WebAuthn/Passkey cancel surfaces as "not allowed" / "cancelled" / "canceled"
 *   from the platform authenticator — also user-driven, map to 4001.
 * - Everything else is internal (-32603) with the user-friendly mapPortoError
 *   message so the popup error banners stay legible.
 */
function toDappErrorResponse(error: unknown): {
  success: false;
  error: SerializedRpcError;
} {
  const raw = error instanceof Error ? error : new Error(String(error ?? ERROR_MESSAGES.UNKNOWN_ERROR));
  const lower = raw.message.toLowerCase();
  const isUserReject =
    /user rejected|user denied|user cancel/.test(lower) ||
    lower.includes("not allowed") ||
    lower.includes("cancelled") ||
    lower.includes("canceled");

  if (isUserReject) {
    return {
      success: false,
      error: {
        code: RPC_ERROR_CODES.USER_REJECTED,
        message: "User rejected the request",
      },
    };
  }

  return {
    success: false,
    error: {
      code: RPC_ERROR_CODES.INTERNAL,
      message: mapPortoError(raw),
    },
  };
}

/**
 * Message Handler class
 * Central router for all extension messages
 */
export class MessageHandler {
  private rpcHandler: RpcHandler;
  private portoService: PortoService;

  constructor(
    portoService: PortoService,
    private accountManager: AccountManager,
    private storageManager: StorageManager,
    private dappManager: DappManager
  ) {
    // Store for Phase 4 transaction signing
    this.portoService = portoService;
    this.rpcHandler = new RpcHandler();
  }

  /**
   * Get Porto service instance (for Phase 4 transaction signing)
   * @internal
   */
  getPortoService(): PortoService {
    return this.portoService;
  }

  /**
   * Handle incoming message and route to appropriate handler
   * @param message - The message to handle
   * @param sender - Message sender information
   * @returns Promise resolving to message response
   */
  async handle(
    message: Message,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    const { requestId } = message;

    try {
      console.log("[MessageHandler] Handling message:", message.type);

      let response: MessageResponse;

      switch (message.type) {
        // Account management
        case MT.CREATE_ACCOUNT:
          response = await this.handleCreateAccount(message.payload as AccountPayload);
          break;

        case MT.CONNECT_ACCOUNT:
          response = await this.handleConnectAccount(message.payload);
          break;

        case MT.DISCONNECT_ACCOUNT:
          response = await this.handleDisconnectAccount();
          break;

        case MT.GET_ACCOUNT:
          response = await this.handleGetAccount();
          break;

        // Multi-account management
        case MT.GET_ALL_ACCOUNTS:
          response = await this.handleGetAllAccounts();
          break;

        case MT.SWITCH_ACCOUNT:
          response = await this.handleSwitchAccount(message.payload as SwitchAccountPayload);
          break;

        case MT.UPDATE_ACCOUNT:
          response = await this.handleUpdateAccount(message.payload as UpdateAccountPayload);
          break;

        case MT.DELETE_ACCOUNT:
          response = await this.handleDeleteAccount(message.payload as DeleteAccountPayload);
          break;

        // Per-account dApp management
        case MT.GET_ACCOUNT_DAPPS:
          response = await this.handleGetAccountDapps(message.payload as GetAccountDappsPayload);
          break;

        case MT.CONNECT_ACCOUNT_DAPP:
          response = await this.handleConnectAccountDapp(message.payload as ConnectAccountDappPayload);
          break;

        case MT.DISCONNECT_ACCOUNT_DAPP:
          response = await this.handleDisconnectAccountDapp(message.payload as DisconnectAccountDappPayload);
          break;

        // Connection approval (from popup)
        case MT.APPROVE_CONNECTION:
          response = await this.handleApproveConnection(message.payload as ApproveConnectionPayload);
          break;

        case MT.REJECT_CONNECTION:
          response = await this.handleRejectConnection(message.payload as RejectConnectionPayload);
          break;

        // Signing request management (Phase 4)
        case MT.GET_PENDING_SIGNING:
          response = await this.handleGetPendingSigning(message.payload as GetPendingSigningPayload);
          break;

        case MT.APPROVE_SIGNING:
          response = await this.handleApproveSigning(message.payload as ApproveSigningPayload);
          break;

        case MT.REJECT_SIGNING:
          response = await this.handleRejectSigning(message.payload as RejectSigningPayload);
          break;

        case MT.POLL_SIGNING_REQUEST:
          response = await this.handlePollSigningRequest(message.payload as PollSigningRequestPayload);
          break;

        case MT.LIST_PENDING_APPROVALS:
          response = await this.handleListPendingApprovals();
          break;

        case MT.RESUME_PENDING_APPROVAL:
          response = await this.handleResumePendingApproval(message.payload as ResumePendingApprovalPayload);
          break;

        // dApp requests
        case MT.DAPP_REQUEST:
          response = await this.handleDappRequest(message.payload as DappRequestPayload, sender);
          break;

        case MT.ETH_REQUEST_ACCOUNTS:
          response = await this.handleRequestAccounts(sender);
          break;

        case MT.ETH_ACCOUNTS:
          response = await this.handleGetAccounts();
          break;

        case MT.ETH_CHAIN_ID:
          response = await this.handleGetChainId();
          break;

        // Transaction management
        case MT.APPROVE_TRANSACTION:
          response = await this.handleApproveTransaction(message.payload as TransactionPayload);
          break;

        case MT.REJECT_TRANSACTION:
          response = await this.handleRejectTransaction(message.payload as TransactionPayload);
          break;

        case MT.GET_TRANSACTION:
          response = await this.handleGetTransaction(message.payload as TransactionPayload);
          break;

        // State management
        case MT.GET_STATE:
          response = await this.handleGetState();
          break;

        case MT.GET_PORTFOLIO:
          response = await this.handleGetPortfolio(message.payload as GetPortfolioPayload);
          break;

        // Token management (Phase 7)
        case MT.GET_TOKEN_BALANCES:
          response = await this.handleGetTokenBalances(message.payload as GetTokenBalancesPayload);
          break;

        case MT.GET_TOKEN_BALANCE:
          response = await this.handleGetTokenBalance(message.payload as GetTokenBalancePayload);
          break;

        case MT.ADD_CUSTOM_TOKEN:
          response = await this.handleAddCustomToken(message.payload as AddCustomTokenPayload);
          break;

        case MT.REMOVE_CUSTOM_TOKEN:
          response = await this.handleRemoveCustomToken(message.payload as RemoveCustomTokenPayload);
          break;

        case MT.GET_CUSTOM_TOKENS:
          response = await this.handleGetCustomTokens(message.payload as GetCustomTokensPayload);
          break;

        // Network management
        case MT.SWITCH_CHAIN:
          response = await this.handleSwitchChain(message.payload as ChainSwitchPayload);
          break;

        // WebAuthn - Porto runs in popup, not background
        case MT.WEBAUTHN_CREATE:
        case MT.WEBAUTHN_GET:
          response = { success: false, error: "WebAuthn operations run in popup context" };
          break;

        default:
          console.warn("[MessageHandler] Unknown message type:", message.type);
          response = {
            success: false,
            error: `Unknown message type: ${message.type}`,
          };
      }

      // Always include requestId in response
      return { ...response, requestId };
    } catch (error) {
      console.error("[MessageHandler] Error handling message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
        requestId,
      };
    }
  }

  /**
   * Handle account creation request (account created by popup)
   */
  private async handleCreateAccount(payload: any): Promise<MessageResponse> {
    try {
      if (!payload?.address) {
        throw new Error('Account address is required');
      }

      const account = await this.accountManager.createAccount(
        payload.address,
        payload?.displayName
      );

      return {
        success: true,
        data: { address: account.address },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.AUTH_FAILED,
      };
    }
  }

  /**
   * Handle account connection request (account authenticated by popup)
   */
  private async handleConnectAccount(payload: any): Promise<MessageResponse> {
    try {
      if (!payload?.address) {
        throw new Error('Account address is required');
      }

      const account = await this.accountManager.connectExistingAccount(
        payload.address,
        payload?.displayName
      );

      return {
        success: true,
        data: { address: account.address },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.AUTH_FAILED,
      };
    }
  }

  /**
   * Handle account disconnection request
   */
  private async handleDisconnectAccount(): Promise<MessageResponse> {
    try {
      await this.accountManager.disconnect();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle get account request
   */
  private async handleGetAccount(): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      return {
        success: true,
        data: account,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle dApp request (general)
   */
  private async handleDappRequest(
    payload: DappRequestPayload,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    try {
      const { method, params, origin } = payload;

      console.log("[MessageHandler] dApp request:", method, "from", origin);

      // Get the active account
      const account = await this.accountManager.getAccount();
      const accountAddress = account?.address || "";

      // Get per-origin chain ID for RPC calls
      const chainId = origin && accountAddress
        ? await this.dappManager.getChainIdForOrigin(origin, accountAddress)
        : (await this.storageManager.getSettings()).defaultChain;

      // Route based on method
      switch (method) {
        // Account methods
        case "eth_requestAccounts":
          return await this.handleRequestAccounts(sender, origin);

        case "eth_accounts":
          return await this.handleGetAccounts(origin);

        case "eth_coinbase":
          return await this.handleEthCoinbase();

        // Chain/Network methods
        case "eth_chainId":
          return await this.handleGetChainIdForOrigin(origin);

        case "net_version":
          return await this.handleNetVersionForOrigin(origin);

        // Read methods (via RPC)
        case "eth_getBalance":
          return await this.handleEthGetBalance(params || [], chainId);

        case "eth_call":
          return await this.handleEthCall(params || [], chainId);

        case "eth_estimateGas":
          return await this.handleEthEstimateGas(params || [], chainId);

        case "eth_blockNumber":
          return await this.handleEthBlockNumber(chainId);

        case "eth_getTransactionCount":
          return await this.handleEthGetTransactionCount(params || [], chainId);

        case "eth_getCode":
          return await this.handleEthGetCode(params || [], chainId);

        case "eth_getTransactionReceipt":
          return await this.handleEthGetTransactionReceipt(params || [], chainId);

        case "eth_getTransactionByHash":
          return await this.handleEthGetTransactionByHash(params || [], chainId);

        case "eth_gasPrice":
          return await this.handleEthGasPrice(chainId);

        // Transaction methods (Phase 4)
        case "eth_sendTransaction":
          return await this.handleEthSendTransaction(params || [], sender, origin);

        case "eth_sendRawTransaction":
          // TODO: Implement raw transaction sending
          return { success: false, error: "Raw transaction sending not yet supported" };

        // Signing methods (Phase 4)
        case "personal_sign":
          return await this.handlePersonalSign(params || [], sender, origin);

        case "eth_sign":
          // eth_sign is deprecated and insecure, redirect to personal_sign
          return await this.handlePersonalSign(params || [], sender, origin);

        case "eth_signTypedData":
        case "eth_signTypedData_v3":
        case "eth_signTypedData_v4":
          return await this.handleSignTypedData(params || [], sender, origin);

        // Wallet methods
        case "wallet_switchEthereumChain":
          return await this.handleWalletSwitchChainForOrigin(params || [], origin);

        case "wallet_addEthereumChain":
          return await this.handleWalletAddChain(params || [], origin);

        case "wallet_requestPermissions":
          return await this.handleWalletRequestPermissions(params || [], sender, origin);

        case "wallet_getPermissions":
          // Porto-aware dApps expect session-key permissions (Porto shape) here,
          // not the EIP-2255 dApp-connection shape we used to return. We can't
          // serve the Porto shape from the background without a Porto instance,
          // so return [] and let dApps fall back to eth_accounts for connectivity.
          return { success: true, data: [] };

        // EIP-5792: Wallet capabilities
        case "wallet_getCapabilities":
          return await this.handleWalletGetCapabilities(params, origin);

        // EIP-5792: Send calls (returns bundleId)
        case "wallet_sendCalls":
          return await this.handleWalletSendCalls(params || [], sender, origin);

        // EIP-5792: Get calls status
        case "wallet_getCallsStatus":
          return await this.handleWalletGetCallsStatus(params || [], origin);

        default:
          console.warn("[MessageHandler] Unsupported method:", method);
          return {
            success: false,
            error: {
              code: RPC_ERROR_CODES.UNSUPPORTED_METHOD,
              message: `Method not supported: ${method}`,
            },
          };
      }
    } catch (error) {
      console.error("[MessageHandler] dApp request error:", error);
      return toDappErrorResponse(error);
    }
  }

  /**
   * Handle eth_requestAccounts
   * Checks if dApp is connected and requests approval if not
   */
  private async handleRequestAccounts(
    sender: chrome.runtime.MessageSender,
    origin?: string
  ): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      if (!account) {
        return {
          success: false,
          error: ERROR_MESSAGES.NO_ACCOUNT,
        };
      }

      // Extract and validate origin (prefer sender.tab.url for security)
      const dappOrigin = extractValidOrigin(sender, origin);

      if (!dappOrigin) {
        console.warn("[MessageHandler] Could not determine dApp origin");
        // For popup access (no sender.tab), return account
        if (!sender.tab) {
          return {
            success: true,
            data: [account.address],
          };
        }
        return {
          success: false,
          error: ERROR_MESSAGES.INVALID_ORIGIN,
        };
      }

      // Check if dApp is already connected to this account
      const isConnected = await this.dappManager.isConnected(dappOrigin, account.address);

      if (isConnected) {
        console.log("[MessageHandler] dApp already connected:", dappOrigin);
        return {
          success: true,
          data: [account.address],
        };
      }

      // Request user approval via popup
      console.log("[MessageHandler] Requesting connection approval for:", dappOrigin);
      const approved = await this.dappManager.requestConnection(
        dappOrigin,
        account.address,
        {
          title: sender.tab?.title,
          favicon: sender.tab?.favIconUrl,
        }
      );

      if (approved) {
        return {
          success: true,
          data: [account.address],
        };
      } else {
        return {
          success: false,
          error: ERROR_MESSAGES.PERMISSION_DENIED,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle eth_accounts
   * Returns connected accounts (empty array if not connected)
   */
  private async handleGetAccounts(origin?: string): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      if (!account) {
        return {
          success: true,
          data: [],
        };
      }

      // If origin is provided, check if dApp is connected
      if (origin) {
        const isConnected = await this.dappManager.isConnected(origin, account.address);
        if (!isConnected) {
          // Return empty array for unconnected dApps (privacy)
          return {
            success: true,
            data: [],
          };
        }
      }

      return {
        success: true,
        data: [account.address],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle eth_chainId (global, for popup use)
   */
  private async handleGetChainId(): Promise<MessageResponse> {
    try {
      const settings = await this.storageManager.getSettings();
      const chainId = `0x${settings.defaultChain.toString(16)}`;

      return {
        success: true,
        data: chainId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle eth_chainId for a specific origin (per-origin chain context)
   */
  private async handleGetChainIdForOrigin(origin?: string): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      // If no origin or no account, fall back to global setting
      if (!origin || !account) {
        return await this.handleGetChainId();
      }

      // Get per-origin chain ID
      const chainId = await this.dappManager.getChainIdForOrigin(origin, account.address);
      const chainIdHex = `0x${chainId.toString(16)}`;

      return {
        success: true,
        data: chainIdHex,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle net_version for a specific origin (per-origin chain context)
   */
  private async handleNetVersionForOrigin(origin?: string): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      // If no origin or no account, fall back to global setting
      if (!origin || !account) {
        return await this.handleNetVersion();
      }

      // Get per-origin chain ID
      const chainId = await this.dappManager.getChainIdForOrigin(origin, account.address);

      return {
        success: true,
        data: chainId.toString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle transaction approval
   */
  private async handleApproveTransaction(
    _payload: TransactionPayload
  ): Promise<MessageResponse> {
    // TODO: Implement in Phase 4
    return {
      success: false,
      error: "Not implemented yet",
    };
  }

  /**
   * Handle transaction rejection
   */
  private async handleRejectTransaction(
    _payload: TransactionPayload
  ): Promise<MessageResponse> {
    // TODO: Implement in Phase 4
    return {
      success: false,
      error: "Not implemented yet",
    };
  }

  /**
   * Handle get transaction
   */
  private async handleGetTransaction(
    _payload: TransactionPayload
  ): Promise<MessageResponse> {
    // TODO: Implement in Phase 4
    return {
      success: false,
      error: "Not implemented yet",
    };
  }

  /**
   * Handle get state request (includes multi-account data)
   */
  private async handleGetState(): Promise<MessageResponse> {
    try {
      // Get all accounts
      const accounts = await this.accountManager.getAllAccounts();
      const accountOrder = await this.accountManager.getAccountOrder();
      const activeAddress = await this.accountManager.getActiveAccountAddress();
      const activeAccount = await this.accountManager.getActiveAccount();

      const isAuthenticated = accounts.length > 0 && activeAddress !== null;
      const settings = await this.storageManager.getSettings();
      const accountCount = await this.storageManager.getAccountCount();

      // Convert accounts array to record for easier lookup
      const accountsRecord: Record<string, any> = {};
      for (const acc of accounts) {
        accountsRecord[acc.address] = {
          address: acc.address,
          displayName: acc.displayName,
          accountIndex: acc.accountIndex,
          createdAt: acc.createdAt,
        };
      }

      return {
        success: true,
        data: {
          // Multi-account data
          accounts: accountsRecord,
          accountOrder,
          activeAddress,

          // Legacy single-account (for backward compatibility)
          account: activeAccount,
          isAuthenticated,
          chainId: settings.defaultChain,
          accountCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle get portfolio request
   */
  private async handleGetPortfolio(_payload: GetPortfolioPayload): Promise<MessageResponse> {
    // portfolioService removed - use wallet_getAssets from popup via Porto SDK
    console.warn("[MessageHandler] GET_PORTFOLIO deprecated - use wallet_getAssets via popup");
    return {
      success: false,
      error: "GET_PORTFOLIO is deprecated. Use wallet_getAssets via Porto SDK in popup context.",
    };
  }

  // ==================== TOKEN MANAGEMENT HANDLERS (Phase 7) ====================

  /**
   * Handle get token balances request
   */
  private async handleGetTokenBalances(payload: GetTokenBalancesPayload): Promise<MessageResponse> {
    try {
      console.log("[MessageHandler] Getting token balances for:", payload.address);

      const tokens = await tokenService.getTokenBalances(payload.address, payload.chainId);

      return {
        success: true,
        data: tokens,
      };
    } catch (error) {
      console.error("[MessageHandler] Get token balances error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle get single token balance request
   */
  private async handleGetTokenBalance(payload: GetTokenBalancePayload): Promise<MessageResponse> {
    try {
      console.log("[MessageHandler] Getting token balance:", payload.tokenAddress);

      const token = await tokenService.getTokenBalance(
        payload.ownerAddress,
        payload.tokenAddress,
        payload.chainId
      );

      return {
        success: true,
        data: token,
      };
    } catch (error) {
      console.error("[MessageHandler] Get token balance error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle add custom token request
   */
  private async handleAddCustomToken(payload: AddCustomTokenPayload): Promise<MessageResponse> {
    try {
      console.log("[MessageHandler] Adding custom token:", payload.tokenAddress);

      const token = await tokenService.addCustomToken(
        payload.accountAddress,
        payload.tokenAddress,
        payload.chainId
      );

      return {
        success: true,
        data: token,
      };
    } catch (error) {
      console.error("[MessageHandler] Add custom token error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add token. Make sure the address is a valid ERC-20 token contract.",
      };
    }
  }

  /**
   * Handle remove custom token request
   */
  private async handleRemoveCustomToken(payload: RemoveCustomTokenPayload): Promise<MessageResponse> {
    try {
      console.log("[MessageHandler] Removing custom token:", payload.tokenAddress);

      await tokenService.removeCustomToken(
        payload.accountAddress,
        payload.tokenAddress,
        payload.chainId
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error("[MessageHandler] Remove custom token error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle get custom tokens request
   */
  private async handleGetCustomTokens(payload: GetCustomTokensPayload): Promise<MessageResponse> {
    try {
      console.log("[MessageHandler] Getting custom tokens for:", payload.accountAddress);

      const tokens = await tokenService.getCustomTokenAddresses(
        payload.accountAddress,
        payload.chainId
      );

      return {
        success: true,
        data: tokens,
      };
    } catch (error) {
      console.error("[MessageHandler] Get custom tokens error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle chain switch request
   */
  private async handleSwitchChain(
    payload: ChainSwitchPayload
  ): Promise<MessageResponse> {
    try {
      const settings = await this.storageManager.getSettings();
      settings.defaultChain = payload.chainId;
      await this.storageManager.setSettings(settings);

      // Broadcast chainChanged event to all dApps
      await eventBroadcaster.chainChanged(payload.chainId);

      return {
        success: true,
        data: { chainId: payload.chainId },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  // ==================== MULTI-ACCOUNT HANDLERS ====================

  /**
   * Handle get all accounts request
   */
  private async handleGetAllAccounts(): Promise<MessageResponse> {
    try {
      const accounts = await this.accountManager.getAllAccounts();
      const accountOrder = await this.accountManager.getAccountOrder();
      const activeAddress = await this.accountManager.getActiveAccountAddress();

      return {
        success: true,
        data: {
          accounts,
          accountOrder,
          activeAddress,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle switch account request
   */
  private async handleSwitchAccount(
    payload: SwitchAccountPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.address) {
        throw new Error("Account address is required");
      }

      await this.accountManager.switchAccount(payload.address);

      return {
        success: true,
        data: { address: payload.address },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle update account request
   */
  private async handleUpdateAccount(
    payload: UpdateAccountPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.address) {
        throw new Error("Account address is required");
      }

      await this.accountManager.updateAccount(payload.address, {
        displayName: payload.displayName,
      });

      return {
        success: true,
        data: { address: payload.address },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle delete account request
   */
  private async handleDeleteAccount(
    payload: DeleteAccountPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.address) {
        throw new Error("Account address is required");
      }

      await this.accountManager.deleteAccount(payload.address);

      return {
        success: true,
        data: { address: payload.address },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  // ==================== PER-ACCOUNT DAPP HANDLERS ====================

  /**
   * Handle get account dApps request
   */
  private async handleGetAccountDapps(
    payload: GetAccountDappsPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.address) {
        throw new Error("Account address is required");
      }

      const dapps = await this.storageManager.getAccountDapps(payload.address);

      return {
        success: true,
        data: { dapps },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle connect account to dApp request
   */
  private async handleConnectAccountDapp(
    payload: ConnectAccountDappPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.address || !payload?.origin) {
        throw new Error("Account address and dApp origin are required");
      }

      await this.storageManager.connectAccountToDapp(
        payload.address,
        payload.origin,
        {
          origin: payload.origin,
          connected: true,
          permissions: ["eth_accounts"],
          timestamp: Date.now(),
          accountAddress: payload.address,
          metadata: payload.metadata,
        }
      );

      return {
        success: true,
        data: { address: payload.address, origin: payload.origin },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle disconnect account from dApp request
   */
  private async handleDisconnectAccountDapp(
    payload: DisconnectAccountDappPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.address || !payload?.origin) {
        throw new Error("Account address and dApp origin are required");
      }

      await this.storageManager.disconnectAccountFromDapp(
        payload.address,
        payload.origin
      );

      return {
        success: true,
        data: { address: payload.address, origin: payload.origin },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  // ==================== RPC METHOD HANDLERS ====================

  /**
   * Handle eth_coinbase - returns primary account
   */
  private async handleEthCoinbase(): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();
      return {
        success: true,
        data: account?.address || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle net_version - returns network ID as decimal string
   */
  private async handleNetVersion(): Promise<MessageResponse> {
    try {
      const settings = await this.storageManager.getSettings();
      return {
        success: true,
        data: settings.defaultChain.toString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle eth_getBalance
   */
  private async handleEthGetBalance(params: any[], chainId: number): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1) {
        throw new Error("Missing address parameter");
      }
      const address = params[0];
      const balance = await this.rpcHandler.getBalance(address, chainId);
      return {
        success: true,
        data: balance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_call
   */
  private async handleEthCall(params: any[], chainId: number): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1) {
        throw new Error("Missing call parameters");
      }
      const callParams = params[0];
      const result = await this.rpcHandler.call(callParams, chainId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_estimateGas
   */
  private async handleEthEstimateGas(params: any[], chainId: number): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1) {
        throw new Error("Missing transaction parameters");
      }
      const txParams = params[0];
      const gas = await this.rpcHandler.estimateGas(txParams, chainId);
      return {
        success: true,
        data: gas,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_blockNumber
   */
  private async handleEthBlockNumber(chainId: number): Promise<MessageResponse> {
    try {
      const blockNumber = await this.rpcHandler.getBlockNumber(chainId);
      return {
        success: true,
        data: blockNumber,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_getTransactionCount
   */
  private async handleEthGetTransactionCount(params: any[], chainId: number): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1) {
        throw new Error("Missing address parameter");
      }
      const address = params[0];
      const count = await this.rpcHandler.getTransactionCount(address, chainId);
      return {
        success: true,
        data: count,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_getCode
   */
  private async handleEthGetCode(params: any[], chainId: number): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1) {
        throw new Error("Missing address parameter");
      }
      const address = params[0];
      const code = await this.rpcHandler.getCode(address, chainId);
      return {
        success: true,
        data: code,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_getTransactionReceipt
   */
  private async handleEthGetTransactionReceipt(params: any[], chainId: number): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1) {
        throw new Error("Missing transaction hash parameter");
      }
      const hash = params[0];
      const receipt = await this.rpcHandler.getTransactionReceipt(hash, chainId);
      return {
        success: true,
        data: receipt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_getTransactionByHash
   */
  private async handleEthGetTransactionByHash(params: any[], chainId: number): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1) {
        throw new Error("Missing transaction hash parameter");
      }
      const hash = params[0];
      const tx = await this.rpcHandler.getTransactionByHash(hash, chainId);
      return {
        success: true,
        data: tx,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle eth_gasPrice
   */
  private async handleEthGasPrice(chainId: number): Promise<MessageResponse> {
    try {
      const gasPrice = await this.rpcHandler.getGasPrice(chainId);
      return {
        success: true,
        data: gasPrice,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Handle wallet_switchEthereumChain (global, for popup use)
   */
  private async handleWalletSwitchChain(params: any[]): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1 || !params[0].chainId) {
        throw new Error("Missing chainId parameter");
      }
      const chainIdHex = params[0].chainId;
      const chainId = parseInt(chainIdHex, 16);

      const settings = await this.storageManager.getSettings();
      settings.defaultChain = chainId;
      await this.storageManager.setSettings(settings);

      // Broadcast chainChanged event to all dApps
      await eventBroadcaster.chainChanged(chainId);

      return {
        success: true,
        data: null, // wallet_switchEthereumChain returns null on success
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle wallet_switchEthereumChain for a specific origin (per-origin chain context)
   * Per EIP-3326: only affects the requesting origin
   */
  private async handleWalletSwitchChainForOrigin(
    params: any[],
    origin?: string
  ): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1 || !params[0].chainId) {
        throw new Error("Missing chainId parameter");
      }

      const chainIdHex = params[0].chainId;
      const chainId = parseInt(chainIdHex, 16);

      // Validate chain is supported
      if (!CHAIN_CONFIGS[chainId]) {
        const err: SerializedRpcError = {
          code: RPC_ERROR_CODES.UNRECOGNIZED_CHAIN,
          message: "Unrecognized chain ID",
        };
        return { success: false, error: err };
      }

      const account = await this.accountManager.getAccount();

      // If no origin or account, fall back to global switch
      if (!origin || !account) {
        return await this.handleWalletSwitchChain(params);
      }

      // Check if dApp is connected
      const isConnected = await this.dappManager.isConnected(origin, account.address);
      if (!isConnected) {
        return {
          success: false,
          error: ERROR_MESSAGES.PERMISSION_DENIED,
        };
      }

      // Update chain for this origin only
      await this.dappManager.setChainIdForOrigin(origin, account.address, chainId);

      // Broadcast chainChanged event to this origin only
      await eventBroadcaster.chainChangedForOrigin(chainId, origin);

      console.log(`[MessageHandler] Switched chain for ${origin} to ${chainId}`);

      return {
        success: true,
        data: null, // wallet_switchEthereumChain returns null on success
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle wallet_addEthereumChain (EIP-3085)
   * For built-in chains, just switch to them
   * Custom chains are not yet supported
   */
  private async handleWalletAddChain(
    params: any[],
    origin?: string
  ): Promise<MessageResponse> {
    try {
      if (!params || params.length < 1 || !params[0].chainId) {
        throw new Error("Missing chainId parameter");
      }

      const chainIdHex = params[0].chainId;
      const chainId = parseInt(chainIdHex, 16);

      // Check if it's a built-in chain
      if (CHAIN_CONFIGS[chainId]) {
        // Just switch to it (built-in chains are already added)
        return await this.handleWalletSwitchChainForOrigin(
          [{ chainId: chainIdHex }],
          origin
        );
      }

      // Custom chains not supported yet
      const err: SerializedRpcError = {
        code: RPC_ERROR_CODES.UNRECOGNIZED_CHAIN,
        message: "Custom chains not yet supported. Only built-in chains are available.",
      };
      return { success: false, error: err };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  // ==================== CONNECTION APPROVAL HANDLERS ====================

  /**
   * Handle connection approval from popup
   */
  private async handleApproveConnection(
    payload: ApproveConnectionPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.origin || !payload?.accountAddress) {
        throw new Error("Origin and account address are required");
      }

      await this.dappManager.approveConnection(payload.origin, payload.accountAddress);

      return {
        success: true,
        data: { origin: payload.origin, accountAddress: payload.accountAddress },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle connection rejection from popup
   */
  private async handleRejectConnection(
    payload: RejectConnectionPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.origin || !payload?.accountAddress) {
        throw new Error("Origin and account address are required");
      }

      this.dappManager.rejectConnection(payload.origin, payload.accountAddress);

      return {
        success: true,
        data: { origin: payload.origin, accountAddress: payload.accountAddress },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  // ==================== WALLET PERMISSION HANDLERS ====================

  /**
   * Handle wallet_requestPermissions (EIP-2255)
   * Requests specific permissions from the user
   */
  private async handleWalletRequestPermissions(
    params: any[],
    sender: chrome.runtime.MessageSender,
    origin?: string
  ): Promise<MessageResponse> {
    try {
      // params[0] is the requested permissions object
      const requestedPermissions = params[0] || {};

      // Check if eth_accounts permission is requested
      if (requestedPermissions.eth_accounts) {
        // This is essentially the same as eth_requestAccounts
        const result = await this.handleRequestAccounts(sender, origin);

        if (result.success && result.data) {
          // Return in EIP-2255 format
          return {
            success: true,
            data: [{
              parentCapability: "eth_accounts",
              invoker: origin || "unknown",
              caveats: [{
                type: "restrictReturnedAccounts",
                value: result.data,
              }],
              date: Date.now(),
            }],
          };
        }
        return result;
      }

      // No supported permissions requested
      return {
        success: true,
        data: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle wallet_getCapabilities (EIP-5792)
   * Returns wallet capabilities for smart account features
   * SECURITY: Only returns capabilities to connected dApps
   */
  private async handleWalletGetCapabilities(params?: any[], origin?: string): Promise<MessageResponse> {
    try {
      console.log('[MessageHandler] wallet_getCapabilities called, origin:', origin, 'params:', params);

      const account = await this.accountManager.getAccount();
      console.log('[MessageHandler] wallet_getCapabilities account:', account?.address);

      // If no account or no origin, return empty (don't reveal wallet info)
      if (!account || !origin) {
        console.log('[MessageHandler] wallet_getCapabilities: no account or origin, returning empty');
        return { success: true, data: {} };
      }

      // Check if dApp is connected - SECURITY: only return capabilities to connected dApps
      const isConnected = await this.dappManager.isConnected(origin, account.address);
      console.log('[MessageHandler] wallet_getCapabilities isConnected:', isConnected);
      if (!isConnected) {
        console.log('[MessageHandler] wallet_getCapabilities: dApp not connected, returning empty');
        return { success: true, data: {} };
      }

      // Get current chain ID (use per-origin chain if available)
      const chainId = await this.dappManager.getChainIdForOrigin(origin, account.address);
      const chainIdHex = `0x${chainId.toString(16)}`;
      console.log('[MessageHandler] wallet_getCapabilities chainId:', chainId, 'hex:', chainIdHex);

      // Call Porto Relay directly to get real capabilities
      // Relay expects params as array of chain IDs: [[chainId1, chainId2, ...]]
      const response = await fetch('https://rpc.porto.sh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'wallet_getCapabilities',
          params: [[chainIdHex]],  // Array of chain IDs
        }),
      });

      const data = await response.json();
      console.log('[MessageHandler] wallet_getCapabilities relay response:', JSON.stringify(data));

      if (data.error) {
        console.error('[MessageHandler] Relay error:', data.error);
        return { success: true, data: {} };
      }

      // Pass through relay response directly - relay already returns EIP-5792 format
      return { success: true, data: data.result };
    } catch (error) {
      console.error('[MessageHandler] wallet_getCapabilities error:', error);
      // Return empty on error - don't expose internal errors
      return { success: true, data: {} };
    }
  }

  // ==================== EIP-5792 HANDLERS ====================

  /**
   * Handle wallet_sendCalls (EIP-5792)
   * Sends a bundle of calls and returns bundleId (not txHash)
   */
  private async handleWalletSendCalls(
    params: any[],
    sender: chrome.runtime.MessageSender,
    origin?: string
  ): Promise<MessageResponse> {
    try {
      console.log('[MessageHandler] wallet_sendCalls called, params:', JSON.stringify(params));

      const account = await this.accountManager.getAccount();
      if (!account) {
        return { success: false, error: ERROR_MESSAGES.NO_ACCOUNT };
      }

      const dappOrigin = extractValidOrigin(sender, origin);
      if (!dappOrigin) {
        return { success: false, error: "Could not determine valid dApp origin" };
      }

      // Verify dApp is connected
      const isConnected = await this.dappManager.isConnected(dappOrigin, account.address);
      if (!isConnected) {
        return { success: false, error: ERROR_MESSAGES.PERMISSION_DENIED };
      }

      // Get chain ID (from params or per-origin default)
      const callsParam = params[0] || {};
      const chainId = callsParam.chainId
        ? parseInt(callsParam.chainId, 16)
        : await this.dappManager.getChainIdForOrigin(dappOrigin, account.address);

      // Request signing approval via popup
      // The popup will use Porto SDK's wallet_sendCalls and return bundleId
      console.log("[MessageHandler] wallet_sendCalls: requesting signing approval...");
      const bundleId = await this.dappManager.requestSigning({
        method: "wallet_sendCalls",
        params,
        origin: dappOrigin,
        accountAddress: account.address,
        chainId,
        metadata: {
          favicon: sender.tab?.favIconUrl,
          title: sender.tab?.title,
        },
      });

      console.log("[MessageHandler] wallet_sendCalls completed, bundleId:", bundleId);

      // Return bundleId per EIP-5792 (not txHash!)
      return { success: true, data: { id: bundleId } };
    } catch (error) {
      console.error("[MessageHandler] wallet_sendCalls error:", error);
      return toDappErrorResponse(error);
    }
  }

  /**
   * Handle wallet_getCallsStatus (EIP-5792)
   * Gets status of a call bundle by bundleId
   */
  private async handleWalletGetCallsStatus(
    params: any[],
    origin?: string
  ): Promise<MessageResponse> {
    try {
      const bundleId = params[0];
      if (!bundleId) {
        return { success: false, error: "Bundle ID is required" };
      }

      console.log('[MessageHandler] wallet_getCallsStatus called, bundleId:', bundleId);

      const account = await this.accountManager.getAccount();
      if (!account || !origin) {
        return { success: false, error: ERROR_MESSAGES.NO_ACCOUNT };
      }

      // Verify dApp is connected
      const isConnected = await this.dappManager.isConnected(origin, account.address);
      if (!isConnected) {
        return { success: false, error: ERROR_MESSAGES.PERMISSION_DENIED };
      }

      // Call Porto Relay to get bundle status
      const response = await fetch('https://rpc.porto.sh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'wallet_getCallsStatus',
          params: [bundleId],
        }),
      });

      const data = await response.json();
      console.log('[MessageHandler] wallet_getCallsStatus relay response:', JSON.stringify(data));

      if (data.error) {
        return { success: false, error: data.error.message || 'Failed to get calls status' };
      }

      // Pass through relay response directly
      return { success: true, data: data.result };
    } catch (error) {
      console.error('[MessageHandler] wallet_getCallsStatus error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  // ==================== SIGNING REQUEST HANDLERS (Phase 4) ====================

  /**
   * Handle eth_sendTransaction
   * Verifies dApp is connected, creates signing request, opens popup
   */
  private async handleEthSendTransaction(
    params: any[],
    sender: chrome.runtime.MessageSender,
    origin?: string
  ): Promise<MessageResponse> {
    try {
      // Validate transaction parameters
      const validation = validateTransactionParams(params);
      if (!validation.valid) {
        return { success: false, error: validation.error || ERROR_MESSAGES.INVALID_REQUEST };
      }

      const account = await this.accountManager.getAccount();
      if (!account) {
        return { success: false, error: ERROR_MESSAGES.NO_ACCOUNT };
      }

      // Extract and validate origin (prefer sender.tab.url for security)
      const dappOrigin = extractValidOrigin(sender, origin);
      if (!dappOrigin) {
        return { success: false, error: "Could not determine valid dApp origin" };
      }

      // Verify dApp is connected
      const isConnected = await this.dappManager.isConnected(dappOrigin, account.address);
      if (!isConnected) {
        return { success: false, error: ERROR_MESSAGES.PERMISSION_DENIED };
      }

      // Get per-origin chain ID
      const chainId = await this.dappManager.getChainIdForOrigin(dappOrigin, account.address);

      // Request signing approval (this opens popup and waits)
      console.log("[MessageHandler] Waiting for signing approval...");
      const txHash = await this.dappManager.requestSigning({
        method: "eth_sendTransaction",
        params,
        origin: dappOrigin,
        accountAddress: account.address,
        chainId,
        metadata: {
          favicon: sender.tab?.favIconUrl,
          title: sender.tab?.title,
        },
      });

      console.log("[MessageHandler] eth_sendTransaction completed, txHash:", txHash);
      return { success: true, data: txHash };
    } catch (error) {
      console.error("[MessageHandler] eth_sendTransaction error:", error);
      return toDappErrorResponse(error);
    }
  }

  /**
   * Handle personal_sign
   * Verifies dApp is connected, creates signing request, opens popup
   */
  private async handlePersonalSign(
    params: any[],
    sender: chrome.runtime.MessageSender,
    origin?: string
  ): Promise<MessageResponse> {
    try {
      // Validate personal_sign parameters
      const validation = validatePersonalSignParams(params);
      if (!validation.valid) {
        return { success: false, error: validation.error || ERROR_MESSAGES.INVALID_REQUEST };
      }

      const account = await this.accountManager.getAccount();
      if (!account) {
        return { success: false, error: ERROR_MESSAGES.NO_ACCOUNT };
      }

      // Extract and validate origin (prefer sender.tab.url for security)
      const dappOrigin = extractValidOrigin(sender, origin);
      if (!dappOrigin) {
        return { success: false, error: "Could not determine valid dApp origin" };
      }

      // Verify dApp is connected
      const isConnected = await this.dappManager.isConnected(dappOrigin, account.address);
      if (!isConnected) {
        return { success: false, error: ERROR_MESSAGES.PERMISSION_DENIED };
      }

      // Get per-origin chain ID
      const chainId = await this.dappManager.getChainIdForOrigin(dappOrigin, account.address);

      // Request signing approval (this opens popup and waits)
      const signature = await this.dappManager.requestSigning({
        method: "personal_sign",
        params,
        origin: dappOrigin,
        accountAddress: account.address,
        chainId,
        metadata: {
          favicon: sender.tab?.favIconUrl,
          title: sender.tab?.title,
        },
      });

      return { success: true, data: signature };
    } catch (error) {
      console.error("[MessageHandler] personal_sign error:", error);
      return toDappErrorResponse(error);
    }
  }

  /**
   * Handle eth_signTypedData_v4 (and v3)
   * Verifies dApp is connected, creates signing request, opens popup
   */
  private async handleSignTypedData(
    params: any[],
    sender: chrome.runtime.MessageSender,
    origin?: string
  ): Promise<MessageResponse> {
    try {
      // Validate typed data parameters
      const validation = validateTypedDataParams(params);
      if (!validation.valid) {
        return { success: false, error: validation.error || ERROR_MESSAGES.INVALID_REQUEST };
      }

      const account = await this.accountManager.getAccount();
      if (!account) {
        return { success: false, error: ERROR_MESSAGES.NO_ACCOUNT };
      }

      // Extract and validate origin (prefer sender.tab.url for security)
      const dappOrigin = extractValidOrigin(sender, origin);
      if (!dappOrigin) {
        return { success: false, error: "Could not determine valid dApp origin" };
      }

      // Verify dApp is connected
      const isConnected = await this.dappManager.isConnected(dappOrigin, account.address);
      if (!isConnected) {
        return { success: false, error: ERROR_MESSAGES.PERMISSION_DENIED };
      }

      // Get per-origin chain ID
      const chainId = await this.dappManager.getChainIdForOrigin(dappOrigin, account.address);

      // Request signing approval (this opens popup and waits)
      const signature = await this.dappManager.requestSigning({
        method: "eth_signTypedData_v4",
        params,
        origin: dappOrigin,
        accountAddress: account.address,
        chainId,
        metadata: {
          favicon: sender.tab?.favIconUrl,
          title: sender.tab?.title,
        },
      });

      return { success: true, data: signature };
    } catch (error) {
      console.error("[MessageHandler] eth_signTypedData error:", error);
      return toDappErrorResponse(error);
    }
  }

  /**
   * Handle GET_PENDING_SIGNING - returns pending signing request to popup
   */
  private async handleGetPendingSigning(
    payload: GetPendingSigningPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.requestId) {
        return { success: false, error: "Request ID is required" };
      }

      const request = await this.dappManager.getPendingSigningRequest(payload.requestId);
      if (!request) {
        return { success: false, error: "Signing request not found or expired" };
      }

      return { success: true, data: request };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle APPROVE_SIGNING - popup approved signing, resolve promise
   * Also saves transaction to history and starts monitoring
   */
  private async handleApproveSigning(
    payload: ApproveSigningPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.requestId || !payload?.result) {
        return { success: false, error: "Request ID and result are required" };
      }

      // Get the request before approving (it will be deleted)
      const request = await this.dappManager.getPendingSigningRequest(payload.requestId);

      // Resolve the pending promise
      await this.dappManager.approveSigning(payload.requestId, payload.result);

      // Save transaction to history if this was a transaction (not just a message signature)
      if (request && request.method === "eth_sendTransaction") {
        const tx = request.params?.[0] || {};
        const transaction: Transaction = {
          id: payload.requestId,
          from: request.accountAddress,
          to: tx.to || "",
          value: tx.value || "0x0",
          data: tx.data || "0x",
          chainId: request.chainId,
          status: TransactionStatus.SENT,
          origin: request.origin,
          timestamp: Date.now(),
          hash: payload.result,
        };

        await this.storageManager.addTransaction(transaction);
        console.log("[MessageHandler] Transaction saved to history:", payload.result);
        // Note: Transaction monitoring removed - Porto handles this via wallet_getCallsStatus
      }

      return { success: true, data: { requestId: payload.requestId } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle REJECT_SIGNING - popup rejected signing, reject promise
   */
  private async handleRejectSigning(
    payload: RejectSigningPayload
  ): Promise<MessageResponse> {
    try {
      if (!payload?.requestId) {
        return { success: false, error: "Request ID is required" };
      }

      await this.dappManager.rejectSigning(payload.requestId);

      return { success: true, data: { requestId: payload.requestId } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Handle POLL_SIGNING_REQUEST - content-script recovery poll after SW restart.
   */
  private async handlePollSigningRequest(
    payload: PollSigningRequestPayload
  ): Promise<MessageResponse<PollSigningRequestResponse>> {
    if (!payload?.requestId) {
      return { success: false, error: "Request ID is required" };
    }
    const state = await this.dappManager.pollSigningRequest(payload.requestId);
    return { success: true, data: state };
  }

  /**
   * Handle LIST_PENDING_APPROVALS - toolbar popup reads pending queue.
   */
  private async handleListPendingApprovals(): Promise<MessageResponse<PendingApprovalSummary[]>> {
    const entries = await this.dappManager.getPersistedPendingRequests();
    const summaries: PendingApprovalSummary[] = entries.map((e) => ({
      requestId: e.request.requestId,
      method: e.request.method,
      origin: e.request.origin,
      createdAt: e.createdAt,
      metadata: e.request.metadata,
    }));
    return { success: true, data: summaries };
  }

  /**
   * Handle RESUME_PENDING_APPROVAL - reopen the approval popup for a
   * dismissed request.
   */
  private async handleResumePendingApproval(
    payload: ResumePendingApprovalPayload
  ): Promise<MessageResponse<{ resumed: boolean }>> {
    if (!payload?.requestId) {
      return { success: false, error: "Request ID is required" };
    }
    const resumed = await this.dappManager.resumePendingRequest(payload.requestId);
    if (!resumed) {
      return { success: false, error: "Pending request not found (it may have been settled or swept)" };
    }
    return { success: true, data: { resumed: true } };
  }
}
