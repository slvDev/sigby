/**
 * Background Service Worker
 * Main entry point for the extension's background script
 * Orchestrates all background services and handles extension lifecycle
 */

import { PortoService } from "./portoService";
import { AccountManager } from "./accountManager";
import { MessageHandler } from "./messageHandler";
import { StorageManager } from "../utils/storage";
import type { Message, MessageResponse } from "../types/messages";

/**
 * Background Service class
 * Coordinates all background services and manages extension lifecycle
 */
class BackgroundService {
  private portoService: PortoService;
  private storageManager: StorageManager;
  private accountManager: AccountManager;
  private messageHandler: MessageHandler;
  private isInitialized: boolean = false;

  constructor() {
    console.log("[Background] Initializing background service...");

    // Initialize services in dependency order
    this.storageManager = new StorageManager();
    this.portoService = new PortoService();
    this.accountManager = new AccountManager(
      this.storageManager,
      this.portoService
    );
    this.messageHandler = new MessageHandler(
      this.portoService,
      this.accountManager,
      this.storageManager
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

      // Set up message listeners
      this.setupMessageListeners();

      // Load persisted state
      await this.loadState();

      // Initialize Porto if user has account
      const hasAccount = await this.storageManager.hasAccount();
      if (hasAccount) {
        console.log("[Background] Existing account found, initializing Porto...");
        await this.portoService.initialize();
      } else {
        console.log("[Background] No account found, skipping Porto initialization");
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
    });

    // Extension started (service worker woke up)
    chrome.runtime.onStartup.addListener(() => {
      console.log("[Background] Extension started");
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
        message: any,
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

      const account = await this.storageManager.getAccount();
      const settings = await this.storageManager.getSettings();
      const connectedDapps = await this.storageManager.getConnectedDapps();

      console.log("[Background] State loaded:", {
        hasAccount: !!account,
        chainId: settings.defaultChain,
        connectedDappsCount: Object.keys(connectedDapps).length,
      });
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
        defaultChain: 8453, // Base
        autoLockTimeout: 0,
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
   * Handle extension update
   */
  private async handleUpdate(previousVersion?: string): Promise<void> {
    console.log("[Background] Extension updated from:", previousVersion);

    try {
      // Run migration logic if needed
      // For Phase 1, no migrations needed

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
      // Close offscreen document if open
      await this.portoService.closeOffscreenDocument();

      // Save any pending state
      // For Phase 1, nothing to save

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
