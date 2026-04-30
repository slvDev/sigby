/**
 * Background Service Worker
 * Main entry point for the extension's background script
 * Orchestrates all background services and handles extension lifecycle
 */

import { AccountManager } from "./accountManager";
import { MessageHandler } from "./messageHandler";
import { DappManager } from "./dappManager";
import { LockStatus } from "./lockStatus";
import { StorageManager } from "../utils/storage";
import { DEFAULT_CHAIN_ID } from "../utils/constants";
import type { Message, MessageResponse } from "../types/messages";

/**
 * Background Service class
 * Coordinates all background services and manages extension lifecycle
 */
class BackgroundService {
  private storageManager: StorageManager;
  private accountManager: AccountManager;
  private dappManager: DappManager;
  private lockStatus: LockStatus;
  private messageHandler: MessageHandler;
  private isInitialized: boolean = false;

  constructor() {
    console.log("[Background] Initializing background service...");

    // Initialize services in dependency order. The real Porto SDK lives
    // in the popup context — WebAuthn needs a visible window — so the
    // background never instantiates it.
    this.storageManager = new StorageManager();
    this.accountManager = new AccountManager(this.storageManager);
    this.dappManager = new DappManager(this.storageManager);
    this.lockStatus = new LockStatus(this.storageManager);
    this.messageHandler = new MessageHandler(
      this.accountManager,
      this.storageManager,
      this.dappManager,
      this.lockStatus
    );
  }

  /**
   * Initialize the background service
   */
  async initialize(): Promise<void> {
    try {
      console.log("[Background] Starting initialization...");

      // Set up extension lifecycle listeners
      this.setupLifecycleListeners();

      // Hydrate the lock-status cache BEFORE installing the message
      // listener so the first dApp request can't land during the
      // fail-closed `!hydrated` window and get a spurious locked=[].
      // Transition handler is registered BEFORE `listen()` starts the
      // storage observer so the first cross-context lock edge after
      // SW wake isn't dropped on the floor.
      await this.lockStatus.hydrate();
      this.lockStatus.onTransition((state) => {
        this.broadcastLockTransition(state).catch((err) => {
          console.error("[Background] Lock transition broadcast failed:", err);
        });
      });
      this.lockStatus.listen();

      // Set up message listeners
      this.setupMessageListeners();

      // Load persisted state
      await this.loadState();

      // Check if user has existing accounts
      const accounts = await this.storageManager.getAllAccounts();
      const accountCount = Object.keys(accounts).length;
      if (accountCount > 0) {
        console.log("[Background] Found", accountCount, "account(s)");
      } else {
        console.log("[Background] No accounts found - ready for account creation");
      }

      this.isInitialized = true;
      console.log("[Background] Background service initialized successfully");
    } catch (error) {
      console.error("[Background] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Set up extension lifecycle event listeners
   */
  private setupLifecycleListeners(): void {
    // Extension installed or updated
    chrome.runtime.onInstalled.addListener((details) => {
      console.log("[Background] Extension installed/updated:", details.reason);

      if (details.reason === "install") {
        this.handleFirstInstall();
      } else if (details.reason === "update") {
        this.handleUpdate(details.previousVersion);
      }

      // Any persisted signing requests from before the install/update are
      // orphans — their original dApp connections are gone. Mark rejected so
      // pollers see a terminal state instead of hanging.
      this.dappManager.sweepOrphanSigningRequests().catch((err) => {
        console.error("[Background] sweepOrphanSigningRequests failed:", err);
      });
    });

    // Extension started (service worker woke up)
    chrome.runtime.onStartup.addListener(() => {
      console.log("[Background] Extension started");
      this.dappManager.sweepOrphanSigningRequests().catch((err) => {
        console.error("[Background] sweepOrphanSigningRequests failed:", err);
      });
    });

    // Window closed - cleanup pending requests
    chrome.windows.onRemoved.addListener((windowId) => {
      this.dappManager.handleWindowClosed(windowId);
    });

    // Service worker suspending (Chrome may terminate inactive service workers)
    if (chrome.runtime.onSuspend) {
      chrome.runtime.onSuspend.addListener(() => {
        console.log("[Background] Service worker suspending");
        this.handleSuspend();
      });
    }
  }

  /**
   * Set up message passing listeners
   */
  private setupMessageListeners(): void {
    // Listen to messages from content scripts, popup, and offscreen document
    chrome.runtime.onMessage.addListener(
      (
        message: Message,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: MessageResponse) => void
      ) => {
        console.log("[Background] Received message:", message.type, "from:", sender.id);

        // Handle message asynchronously
        this.messageHandler
          .handle(message, sender)
          .then((response) => {
            console.log("[Background] Sending response:", response.success);
            sendResponse(response);
          })
          .catch((error) => {
            console.error("[Background] Message handler error:", error);
            sendResponse({
              success: false,
              error: error.message || "Internal error",
              requestId: message.requestId,
            });
          });

        // Return true to indicate async response
        return true;
      }
    );

    // Listen to external messages (from web pages - rare, but possible)
    chrome.runtime.onMessageExternal.addListener(
      (
        _message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: any) => void
      ) => {
        console.log("[Background] External message received from:", sender.origin);

        // For security, we generally don't handle external messages
        // But log them for debugging
        sendResponse({ success: false, error: "External messages not supported" });
        return false;
      }
    );
  }

  /**
   * Load persisted state from storage
   */
  private async loadState(): Promise<void> {
    try {
      console.log("[Background] Loading persisted state...");

      // Run migration from single-account to multi-account format (idempotent)
      await this.storageManager.migrateToMultiAccount();

      // Load multi-account state
      const accounts = await this.storageManager.getAllAccounts();
      const activeAddress = await this.storageManager.getActiveAccountAddress();
      const settings = await this.storageManager.getSettings();

      console.log("[Background] State loaded:", {
        accountCount: accounts.length,
        activeAddress: activeAddress ? `${activeAddress.slice(0, 6)}...` : null,
        chainId: settings.defaultChain,
      });

      // Every SW wake-up runs this file, so this catches crash-restarts that
      // don't fire onStartup. sweepOrphanSigningRequests is idempotent.
      await this.dappManager.sweepOrphanSigningRequests();
    } catch (error) {
      console.error("[Background] Failed to load state:", error);
    }
  }

  /**
   * Handle first install
   */
  private async handleFirstInstall(): Promise<void> {
    console.log("[Background] First install - setting up defaults...");

    try {
      // Initialize default settings
      const defaultSettings = {
        defaultChain: DEFAULT_CHAIN_ID,
        autoLockTimeout: 15, // Minutes. 0 means "never" on the popup side.
        showTestNetworks: false,
        currency: "USD",
        language: "en",
      };

      await this.storageManager.setSettings(defaultSettings);

      // Open onboarding page (optional)
      // chrome.tabs.create({ url: 'popup.html' });

      console.log("[Background] First install setup complete");
    } catch (error) {
      console.error("[Background] First install setup failed:", error);
    }
  }

  /**
   * Lock/unlock fan-out — INTENTIONALLY a no-op.
   *
   * `eth_accounts` returns the cached address regardless of lock
   * state (see `messageHandler.ts` lock-gate comment for why).
   * Broadcasting `accountsChanged([])` on lock would contradict the
   * read path: the event would tell connected dApps "you're
   * disconnected" while the next `eth_accounts` query returns
   * `[activeAddress]`. dApp connector state machines don't handle
   * that inconsistency well — they end up in a half-initialised
   * state and component renders that assume `account.address` exists
   * crash.
   *
   * Two consistent models are possible:
   *   (a) RPC returns cached address + no event on lock (this
   *       implementation). dApps treat the wallet as still connected;
   *       lock is purely UI on the popup side.
   *   (b) RPC returns `[]` + event broadcasts `[]` on lock + a
   *       recovery path (auto-opening unlock UI on user-initiated
   *       methods). dApps observe a disconnect and recover when the
   *       user next interacts.
   *
   * We picked (a). Mixing the two — broadcasting `[]` while reads
   * still returned the address — is what produced the
   * connector-half-state crashes during development.
   *
   * The popup's own lock state still updates via the session-storage
   * onChanged listener; this method only governs DAPP-FACING events.
   */
  private async broadcastLockTransition(
    _state: "locked" | "unlocked"
  ): Promise<void> {
    // Deliberately empty. See jsdoc above.
  }

  /**
   * Handle extension update
   */
  private async handleUpdate(previousVersion?: string): Promise<void> {
    console.log("[Background] Extension updated from:", previousVersion);

    try {
      // Migration runs automatically in loadState() on every startup
      // This ensures existing users get migrated to multi-account format
      console.log("[Background] Update handled successfully");
    } catch (error) {
      console.error("[Background] Update handling failed:", error);
    }
  }

  /**
   * Handle service worker suspend
   * Save any volatile state before service worker terminates
   */
  private async handleSuspend(): Promise<void> {
    try {
      // Nothing to save — all state is persisted to chrome.storage on write.
      console.log("[Background] Suspend handled successfully");
    } catch (error) {
      console.error("[Background] Suspend handling failed:", error);
    }
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Start initialization
backgroundService
  .initialize()
  .then(() => {
    console.log("[Background] ✓ Background service ready");
  })
  .catch((error) => {
    console.error("[Background] ✗ Failed to initialize background service:", error);
  });

// Export for debugging
(globalThis as any).__portoWalletBackground = backgroundService;
