/**
 * Event Broadcaster
 *
 * Forwards EIP-1193 events to the page via content scripts. Per the spec,
 * events (`accountsChanged`, `chainChanged`, `connect`, `disconnect`) must
 * be scoped to the origins that actually have the associated permission —
 * broadcasting to every tab leaks wallet state to unconnected origins and
 * tricks disconnected dApps into thinking their access has changed. All
 * methods here operate per-origin; global `chrome.tabs.query({})` fan-out
 * was removed.
 */

import { MessageType } from "../types/messages";
import { PROVIDER_EVENTS } from "../utils/constants";

async function sendToOrigin(
  origin: string,
  event: string,
  data: unknown
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      let tabOrigin: string;
      try {
        tabOrigin = new URL(tab.url).origin;
      } catch {
        continue;
      }
      if (tabOrigin !== origin) continue;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: MessageType.EMIT_EVENT,
          event,
          data,
        });
      } catch {
        // Tab may not have the content script loaded yet — expected.
      }
    }
  } catch (error) {
    console.error(
      `[EventBroadcaster] Failed to send ${event} to origin ${origin}:`,
      error
    );
  }
}

/**
 * EventBroadcaster — origin-scoped EIP-1193 event dispatch.
 */
export class EventBroadcaster {
  async chainChangedForOrigin(chainId: number, origin: string): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;
    await sendToOrigin(origin, PROVIDER_EVENTS.CHAIN_CHANGED, chainIdHex);
  }

  async accountsChangedForOrigin(
    accounts: string[],
    origin: string
  ): Promise<void> {
    await sendToOrigin(origin, PROVIDER_EVENTS.ACCOUNTS_CHANGED, accounts);
  }

  async connectForOrigin(chainId: number, origin: string): Promise<void> {
    const chainIdHex = `0x${chainId.toString(16)}`;
    await sendToOrigin(origin, PROVIDER_EVENTS.CONNECT, {
      chainId: chainIdHex,
    });
  }

  async disconnectForOrigin(
    origin: string,
    error?: { code: number; message: string }
  ): Promise<void> {
    await sendToOrigin(
      origin,
      PROVIDER_EVENTS.DISCONNECT,
      error || { code: 4900, message: "Disconnected" }
    );
  }
}

export const eventBroadcaster = new EventBroadcaster();
