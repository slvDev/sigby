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

    console.log(`[EventBroadcaster] Broadcasting ${event} to ${tabs.length} tabs`);

    // Send to each tab that might have our content script
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: MessageType.EMIT_EVENT,
            event,
            data,
          });
        } catch (error) {
          // Tab might not have content script loaded - this is expected
          // Only log for debugging, don't treat as error
        }
      }
    }
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
   * Broadcast accountsChanged event
   */
  async accountsChanged(accounts: string[]): Promise<void> {
    await broadcastAccountsChanged(accounts);
  }

  /**
   * Broadcast chainChanged event
   */
  async chainChanged(chainId: number): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;
    await broadcastChainChanged(chainIdHex);
  }

  /**
   * Broadcast connect event
   */
  async connect(chainId: number): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;
    await broadcastConnect(chainIdHex);
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
