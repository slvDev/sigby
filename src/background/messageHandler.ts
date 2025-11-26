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
} from "../types/messages";
import { PortoService } from "./portoService";
import { AccountManager } from "./accountManager";
import { StorageManager } from "../utils/storage";
import { RpcHandler } from "./rpcHandler";
import { DappManager } from "./dappManager";
import { eventBroadcaster } from "./eventBroadcaster";
import { ERROR_MESSAGES } from "../utils/constants";
import { MessageType as MT } from "../types/messages";

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
          response = await this.handleGetPortfolio(message.payload);
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

      // Get current chain ID for RPC calls
      const settings = await this.storageManager.getSettings();
      const chainId = settings.defaultChain;

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
          return await this.handleGetChainId();

        case "net_version":
          return await this.handleNetVersion();

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
          // TODO: Implement in Phase 4
          return { success: false, error: "Transaction signing not yet implemented" };

        case "eth_sendRawTransaction":
          // TODO: Implement in Phase 4
          return { success: false, error: "Raw transaction sending not yet implemented" };

        // Signing methods (Phase 4)
        case "personal_sign":
          // TODO: Implement in Phase 4
          return { success: false, error: "Message signing not yet implemented" };

        case "eth_sign":
          // TODO: Implement in Phase 4
          return { success: false, error: "Message signing not yet implemented" };

        case "eth_signTypedData":
        case "eth_signTypedData_v3":
        case "eth_signTypedData_v4":
          // TODO: Implement in Phase 4
          return { success: false, error: "Typed data signing not yet implemented" };

        // Wallet methods
        case "wallet_switchEthereumChain":
          return await this.handleWalletSwitchChain(params || []);

        case "wallet_addEthereumChain":
          // TODO: Implement chain addition
          return { success: false, error: "Adding new chains not yet supported" };

        case "wallet_requestPermissions":
          return await this.handleWalletRequestPermissions(params || [], sender, origin);

        case "wallet_getPermissions":
          return await this.handleWalletGetPermissions(origin);

        default:
          console.warn("[MessageHandler] Unsupported method:", method);
          return {
            success: false,
            error: `Unsupported method: ${method}`,
          };
      }
    } catch (error) {
      console.error("[MessageHandler] dApp request error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.INVALID_REQUEST,
      };
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

      // Get origin from sender tab or provided origin
      const dappOrigin = origin || sender.tab?.url ? new URL(sender.tab!.url!).origin : null;

      if (!dappOrigin) {
        console.warn("[MessageHandler] Could not determine dApp origin");
        // Still return account if we can't determine origin (popup access)
        return {
          success: true,
          data: [account.address],
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
   * Handle eth_chainId
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
  private async handleGetPortfolio(_payload: any): Promise<MessageResponse> {
    // TODO: Implement in Phase 5/6
    return {
      success: false,
      error: "Not implemented yet",
    };
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
   * Handle wallet_switchEthereumChain
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
   * Handle wallet_getPermissions (EIP-2255)
   * Returns current permissions for the dApp
   */
  private async handleWalletGetPermissions(origin?: string): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      if (!account || !origin) {
        return {
          success: true,
          data: [],
        };
      }

      const isConnected = await this.dappManager.isConnected(origin, account.address);

      if (isConnected) {
        return {
          success: true,
          data: [{
            parentCapability: "eth_accounts",
            invoker: origin,
            caveats: [{
              type: "restrictReturnedAccounts",
              value: [account.address],
            }],
            date: Date.now(),
          }],
        };
      }

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
}
