/**
 * Message Handler
 * Routes messages between extension components and handles requests
 */

import type {
  Message,
  MessageResponse,
  MessageType,
  DappRequestPayload,
  AccountPayload,
  TransactionPayload,
  ChainSwitchPayload,
  EventPayload,
} from "../types/messages";
import { PortoService } from "./portoService";
import { AccountManager } from "./accountManager";
import { StorageManager } from "../utils/storage";
import { ERROR_MESSAGES } from "../utils/constants";
import { MessageType as MT } from "../types/messages";

/**
 * Message Handler class
 * Central router for all extension messages
 */
export class MessageHandler {
  constructor(
    private portoService: PortoService,
    private accountManager: AccountManager,
    private storageManager: StorageManager
  ) {}

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
    try {
      console.log("[MessageHandler] Handling message:", message.type);

      switch (message.type) {
        // Account management
        case MT.CREATE_ACCOUNT:
          return await this.handleCreateAccount(message.payload as AccountPayload);

        case MT.CONNECT_ACCOUNT:
          return await this.handleConnectAccount();

        case MT.DISCONNECT_ACCOUNT:
          return await this.handleDisconnectAccount();

        case MT.GET_ACCOUNT:
          return await this.handleGetAccount();

        // dApp requests
        case MT.DAPP_REQUEST:
          return await this.handleDappRequest(message.payload as DappRequestPayload, sender);

        case MT.ETH_REQUEST_ACCOUNTS:
          return await this.handleRequestAccounts(sender);

        case MT.ETH_ACCOUNTS:
          return await this.handleGetAccounts();

        case MT.ETH_CHAIN_ID:
          return await this.handleGetChainId();

        // Transaction management
        case MT.APPROVE_TRANSACTION:
          return await this.handleApproveTransaction(message.payload as TransactionPayload);

        case MT.REJECT_TRANSACTION:
          return await this.handleRejectTransaction(message.payload as TransactionPayload);

        case MT.GET_TRANSACTION:
          return await this.handleGetTransaction(message.payload as TransactionPayload);

        // State management
        case MT.GET_STATE:
          return await this.handleGetState();

        case MT.GET_PORTFOLIO:
          return await this.handleGetPortfolio(message.payload);

        // Network management
        case MT.SWITCH_CHAIN:
          return await this.handleSwitchChain(message.payload as ChainSwitchPayload);

        // WebAuthn (from offscreen document)
        case MT.WEBAUTHN_CREATE:
        case MT.WEBAUTHN_GET:
          // These are handled by offscreen document, just pass through
          return { success: false, error: "WebAuthn messages not implemented" };

        default:
          console.warn("[MessageHandler] Unknown message type:", message.type);
          return {
            success: false,
            error: `Unknown message type: ${message.type}`,
            requestId: message.requestId,
          };
      }
    } catch (error) {
      console.error("[MessageHandler] Error handling message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
        requestId: message.requestId,
      };
    }
  }

  /**
   * Handle account creation request
   */
  private async handleCreateAccount(payload: AccountPayload): Promise<MessageResponse> {
    try {
      const address = await this.accountManager.createNewAccount(
        payload?.displayName
      );

      return {
        success: true,
        data: { address },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.AUTH_FAILED,
      };
    }
  }

  /**
   * Handle account connection request
   */
  private async handleConnectAccount(): Promise<MessageResponse> {
    try {
      const address = await this.accountManager.connectExistingAccount();

      return {
        success: true,
        data: { address },
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

      // Route based on method
      switch (method) {
        case "eth_requestAccounts":
          return await this.handleRequestAccounts(sender);

        case "eth_accounts":
          return await this.handleGetAccounts();

        case "eth_chainId":
          return await this.handleGetChainId();

        case "eth_sendTransaction":
          // TODO: Implement transaction sending
          return { success: false, error: "Not implemented yet" };

        case "personal_sign":
          // TODO: Implement signing
          return { success: false, error: "Not implemented yet" };

        default:
          return {
            success: false,
            error: `Unsupported method: ${method}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.INVALID_REQUEST,
      };
    }
  }

  /**
   * Handle eth_requestAccounts
   */
  private async handleRequestAccounts(
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      if (!account) {
        return {
          success: false,
          error: ERROR_MESSAGES.NO_ACCOUNT,
        };
      }

      // TODO: Check if dApp is connected
      // TODO: Request user approval if not connected

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
   * Handle eth_accounts
   */
  private async handleGetAccounts(): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();

      if (!account) {
        return {
          success: true,
          data: [],
        };
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
    payload: TransactionPayload
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
    payload: TransactionPayload
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
    payload: TransactionPayload
  ): Promise<MessageResponse> {
    // TODO: Implement in Phase 4
    return {
      success: false,
      error: "Not implemented yet",
    };
  }

  /**
   * Handle get state request
   */
  private async handleGetState(): Promise<MessageResponse> {
    try {
      const account = await this.accountManager.getAccount();
      const isAuthenticated = await this.accountManager.isAuthenticated();
      const settings = await this.storageManager.getSettings();

      return {
        success: true,
        data: {
          account,
          isAuthenticated,
          chainId: settings.defaultChain,
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
  private async handleGetPortfolio(payload: any): Promise<MessageResponse> {
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
}
