/**
 * Event Broadcaster
 * Broadcasts EIP-1193 events to all content scripts
 * Events are forwarded to injected providers via postMessage
 */

import { MessageType } from "../types/messages";
import { PROVIDER_EVENTS } from "../utils/constants";

/**
 * Broadcast an event to all active tabs with content scripts
 * @param event - Event name (accountsChanged, chainChanged, etc.)
 * @param data - Event data to send
 */
export async function broadcastEvent(event: string, data: any): Promise<void> {
  try {
    // Query all tabs
    const tabs = await chrome.tabs.query({});

    console.log(`[EventBroadcaster] Broadcasting ${event} to ${tabs.length} tabs, data:`, data);

    let successCount = 0;
    let failCount = 0;

    // Send to each tab that might have our content script
    for (const tab of tabs) {
      // Skip tabs without ID
      if (!tab.id) continue;

      // Skip chrome:// and other internal pages (check if url exists first)
      const url = tab.url || "";
      if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
        continue;
      }

      // Try to send message - content script may or may not be loaded
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: MessageType.EMIT_EVENT,
          event,
          data,
        });
        if (response?.success) {
          successCount++;
          console.log(`[EventBroadcaster] Successfully sent ${event} to tab ${tab.id} (${url.substring(0, 50) || "unknown"})`);
        }
      } catch (error) {
        // Tab might not have content script loaded - this is expected for most tabs
        // But log the URL for debugging chain change issues
        failCount++;
        // Only log errors for http/https pages (not extension pages, etc.)
        if (url.startsWith("http")) {
          console.debug(`[EventBroadcaster] Could not send ${event} to tab ${tab.id} (${url.substring(0, 50)}):`, (error as Error).message);
        }
      }
    }

    console.log(`[EventBroadcaster] Broadcast complete: ${successCount} success, ${failCount} failed/no-listener`);
  } catch (error) {
    console.error("[EventBroadcaster] Failed to broadcast event:", error);
  }
}

/**
 * Broadcast accountsChanged event
 * @param accounts - Array of account addresses (or empty array if disconnected)
 */
export async function broadcastAccountsChanged(accounts: string[]): Promise<void> {
  await broadcastEvent(PROVIDER_EVENTS.ACCOUNTS_CHANGED, accounts);
}

/**
 * Broadcast chainChanged event
 * @param chainId - New chain ID as hex string (e.g., "0x1")
 */
export async function broadcastChainChanged(chainId: string): Promise<void> {
  await broadcastEvent(PROVIDER_EVENTS.CHAIN_CHANGED, chainId);
}

/**
 * Broadcast connect event
 * @param chainId - Chain ID as hex string
 */
export async function broadcastConnect(chainId: string): Promise<void> {
  await broadcastEvent(PROVIDER_EVENTS.CONNECT, { chainId });
}

/**
 * Broadcast disconnect event
 * @param error - Error object with code and message
 */
export async function broadcastDisconnect(error?: { code: number; message: string }): Promise<void> {
  await broadcastEvent(PROVIDER_EVENTS.DISCONNECT, error || { code: 4900, message: "Disconnected" });
}

/**
 * EventBroadcaster class for more structured usage
 */
export class EventBroadcaster {
  /**
   * Broadcast accountsChanged event to all tabs
   */
  async accountsChanged(accounts: string[]): Promise<void> {
    await broadcastAccountsChanged(accounts);
  }

  /**
   * Broadcast chainChanged event to all tabs (global chain change)
   */
  async chainChanged(chainId: number): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;
    await broadcastChainChanged(chainIdHex);
  }

  /**
   * Broadcast chainChanged event to a specific origin only
   * Per EIP-1193: only the requesting dApp receives the event
   * @param chainId - Chain ID to broadcast
   * @param origin - Origin to send the event to
   */
  async chainChangedForOrigin(chainId: number, origin: string): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;

    try {
      const tabs = await chrome.tabs.query({});

      console.log(`[EventBroadcaster] Broadcasting chainChanged (${chainIdHex}) to origin: ${origin}`);

      let sentCount = 0;
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;

        try {
          const tabOrigin = new URL(tab.url).origin;
          if (tabOrigin === origin) {
            await chrome.tabs.sendMessage(tab.id, {
              type: MessageType.EMIT_EVENT,
              event: PROVIDER_EVENTS.CHAIN_CHANGED,
              data: chainIdHex,
            });
            sentCount++;
          }
        } catch {
          // Tab may not have content script - expected
        }
      }

      console.log(`[EventBroadcaster] Sent chainChanged to ${sentCount} tabs for origin: ${origin}`);
    } catch (error) {
      console.error("[EventBroadcaster] Failed to broadcast chainChanged to origin:", error);
    }
  }

  /**
   * Broadcast accountsChanged event to a specific origin only
   * @param accounts - Array of account addresses
   * @param origin - Origin to send the event to
   */
  async accountsChangedForOrigin(accounts: string[], origin: string): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});

      console.log(`[EventBroadcaster] Broadcasting accountsChanged to origin: ${origin}`);

      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;

        try {
          const tabOrigin = new URL(tab.url).origin;
          if (tabOrigin === origin) {
            await chrome.tabs.sendMessage(tab.id, {
              type: MessageType.EMIT_EVENT,
              event: PROVIDER_EVENTS.ACCOUNTS_CHANGED,
              data: accounts,
            });
          }
        } catch {
          // Tab may not have content script - expected
        }
      }
    } catch (error) {
      console.error("[EventBroadcaster] Failed to broadcast accountsChanged to origin:", error);
    }
  }

  /**
   * Broadcast connect event
   */
  async connect(chainId: number): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;
    await broadcastConnect(chainIdHex);
  }

  /**
   * Broadcast connect event to a specific origin only
   * @param chainId - Chain ID
   * @param origin - Origin to send the event to
   */
  async connectForOrigin(chainId: number, origin: string): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;

    try {
      const tabs = await chrome.tabs.query({});

      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;

        try {
          const tabOrigin = new URL(tab.url).origin;
          if (tabOrigin === origin) {
            await chrome.tabs.sendMessage(tab.id, {
              type: MessageType.EMIT_EVENT,
              event: PROVIDER_EVENTS.CONNECT,
              data: { chainId: chainIdHex },
            });
          }
        } catch {
          // Tab may not have content script - expected
        }
      }
    } catch (error) {
      console.error("[EventBroadcaster] Failed to broadcast connect to origin:", error);
    }
  }

  /**
   * Broadcast disconnect event
   */
  async disconnect(error?: { code: number; message: string }): Promise<void> {
    await broadcastDisconnect(error);
  }
}

/**
 * Singleton instance
 */
export const eventBroadcaster = new EventBroadcaster();
