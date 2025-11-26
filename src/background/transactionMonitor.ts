/**
 * Transaction Monitor
 * Uses chrome.alarms API for persistent transaction monitoring that survives service worker restarts
 * Stores state in chrome.storage.local for persistence across browser sessions
 */

import { TransactionStatus } from "../types/account";
import { StorageManager } from "../utils/storage";
import { TRANSACTION_CONFIG } from "../utils/constants";

/**
 * Pending transaction being monitored
 */
interface PendingTxMonitor {
  hash: string;
  chainId: number;
  txId: string;
  startTime: number;
  attempts: number;
}

/**
 * Storage key for pending monitors (uses local storage for persistence)
 */
const MONITORS_STORAGE_KEY = "pendingTxMonitors";

/**
 * Alarm name prefix for tx monitoring
 */
const ALARM_PREFIX = "tx_monitor_";

/**
 * RPC URLs by chain ID
 */
const RPC_URLS: Record<number, string> = {
  1: "https://cloudflare-eth.com",
  8453: "https://mainnet.base.org",
  84532: "https://sepolia.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  137: "https://polygon-rpc.com",
  11155111: "https://rpc.sepolia.org",
};

/**
 * Global instance reference for module-level alarm listener
 * MV3 Best Practice: Register listeners synchronously at module load
 */
let transactionMonitorInstance: TransactionMonitor | null = null;

/**
 * Module-level alarm listener - registered synchronously when module loads
 * This ensures alarms are never missed, even if SW restarts during async initialization
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith(ALARM_PREFIX) && transactionMonitorInstance) {
    transactionMonitorInstance.handleAlarm(alarm.name);
  }
});

/**
 * TransactionMonitor class
 * Manages persistent transaction monitoring using chrome.alarms
 */
export class TransactionMonitor {
  private storageManager: StorageManager;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
    // Register this instance for the module-level alarm listener
    transactionMonitorInstance = this;
  }

  /**
   * Initialize the monitor
   * Resumes any pending monitors from previous SW lifecycle
   */
  async initialize(): Promise<void> {
    console.log("[TransactionMonitor] Initializing...");
    // Resume any pending monitors from previous SW lifecycle
    await this.resumeMonitoring();
  }

  /**
   * Start monitoring a transaction
   * @param hash - Transaction hash
   * @param chainId - Chain ID
   * @param txId - Internal transaction ID (for storage update)
   */
  async startMonitoring(hash: string, chainId: number, txId: string): Promise<void> {
    const monitor: PendingTxMonitor = {
      hash,
      chainId,
      txId,
      startTime: Date.now(),
      attempts: 0,
    };

    // Save to session storage
    await this.savePendingMonitor(hash, monitor);

    // Create alarm for first check (after poll interval)
    const alarmName = `${ALARM_PREFIX}${hash}`;
    await chrome.alarms.create(alarmName, {
      delayInMinutes: TRANSACTION_CONFIG.STATUS_POLL_INTERVAL / 60000,
    });

    console.log("[TransactionMonitor] Started monitoring:", hash);
  }

  /**
   * Stop monitoring a transaction
   * @param hash - Transaction hash
   */
  async stopMonitoring(hash: string): Promise<void> {
    const alarmName = `${ALARM_PREFIX}${hash}`;
    await chrome.alarms.clear(alarmName);
    await this.removePendingMonitor(hash);
    console.log("[TransactionMonitor] Stopped monitoring:", hash);
  }

  /**
   * Resume monitoring for any pending transactions
   * Called on service worker startup
   */
  async resumeMonitoring(): Promise<void> {
    const monitors = await this.getAllPendingMonitors();
    const monitorCount = Object.keys(monitors).length;

    if (monitorCount === 0) {
      console.log("[TransactionMonitor] No pending monitors to resume");
      return;
    }

    console.log("[TransactionMonitor] Resuming", monitorCount, "pending monitor(s)");

    for (const [hash, monitor] of Object.entries(monitors)) {
      // Check if alarm already exists
      const alarmName = `${ALARM_PREFIX}${hash}`;
      const existingAlarm = await chrome.alarms.get(alarmName);

      if (!existingAlarm) {
        // Check if we've exceeded max attempts
        if (monitor.attempts >= TRANSACTION_CONFIG.MAX_POLL_ATTEMPTS) {
          console.log("[TransactionMonitor] Max attempts reached, stopping:", hash);
          await this.removePendingMonitor(hash);
          continue;
        }

        // Recreate alarm
        await chrome.alarms.create(alarmName, {
          delayInMinutes: TRANSACTION_CONFIG.STATUS_POLL_INTERVAL / 60000,
        });
        console.log("[TransactionMonitor] Resumed monitoring:", hash);
      }
    }
  }

  /**
   * Handle alarm trigger (public for module-level listener)
   * @param alarmName - Name of the triggered alarm
   */
  public async handleAlarm(alarmName: string): Promise<void> {
    const hash = alarmName.replace(ALARM_PREFIX, "");
    const monitor = await this.getPendingMonitor(hash);

    if (!monitor) {
      console.log("[TransactionMonitor] No monitor found for alarm:", hash);
      await chrome.alarms.clear(alarmName);
      return;
    }

    // Increment attempts
    monitor.attempts++;
    await this.savePendingMonitor(hash, monitor);

    try {
      const receipt = await this.getTransactionReceipt(hash, monitor.chainId);

      if (receipt) {
        // Transaction confirmed - determine status
        const isSuccess = this.isReceiptSuccess(receipt);
        const status = isSuccess ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED;

        // Update transaction in storage
        await this.storageManager.updateTransaction(monitor.txId, {
          status,
          confirmedAt: Date.now(),
        });

        console.log(`[TransactionMonitor] Transaction ${status}:`, hash);

        // Stop monitoring
        await this.stopMonitoring(hash);
        return;
      }

      // Not confirmed yet - check if we should continue
      if (monitor.attempts >= TRANSACTION_CONFIG.MAX_POLL_ATTEMPTS) {
        console.log("[TransactionMonitor] Max attempts reached:", hash);
        await this.stopMonitoring(hash);
        return;
      }

      // Schedule next check
      await chrome.alarms.create(alarmName, {
        delayInMinutes: TRANSACTION_CONFIG.STATUS_POLL_INTERVAL / 60000,
      });

    } catch (error) {
      console.error("[TransactionMonitor] Error checking receipt:", error);

      // Continue polling despite errors
      if (monitor.attempts < TRANSACTION_CONFIG.MAX_POLL_ATTEMPTS) {
        await chrome.alarms.create(alarmName, {
          delayInMinutes: TRANSACTION_CONFIG.STATUS_POLL_INTERVAL / 60000,
        });
      } else {
        await this.stopMonitoring(hash);
      }
    }
  }

  /**
   * Check if receipt indicates success
   * Handles different status formats (string, number, boolean, bigint)
   */
  private isReceiptSuccess(receipt: any): boolean {
    const { status } = receipt;

    // Handle various formats
    if (status === "0x1" || status === "1") return true;
    if (status === "0x0" || status === "0") return false;
    if (status === 1 || status === true || status === 1n) return true;
    if (status === 0 || status === false || status === 0n) return false;

    // Default to checking truthy (some older receipts might not have status)
    return Boolean(status);
  }

  /**
   * Get transaction receipt from RPC
   */
  private async getTransactionReceipt(hash: string, chainId: number): Promise<any> {
    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC URL for chain ${chainId}`);
    }

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [hash],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || "RPC error");
    }

    return data.result; // null if not yet mined
  }

  /**
   * Save pending monitor to local storage
   */
  private async savePendingMonitor(hash: string, monitor: PendingTxMonitor): Promise<void> {
    const monitors = await this.getAllPendingMonitors();
    monitors[hash] = monitor;
    await chrome.storage.local.set({ [MONITORS_STORAGE_KEY]: monitors });
  }

  /**
   * Get pending monitor from local storage
   */
  private async getPendingMonitor(hash: string): Promise<PendingTxMonitor | null> {
    const monitors = await this.getAllPendingMonitors();
    return monitors[hash] || null;
  }

  /**
   * Remove pending monitor from local storage
   */
  private async removePendingMonitor(hash: string): Promise<void> {
    const monitors = await this.getAllPendingMonitors();
    delete monitors[hash];
    await chrome.storage.local.set({ [MONITORS_STORAGE_KEY]: monitors });
  }

  /**
   * Get all pending monitors from local storage
   */
  private async getAllPendingMonitors(): Promise<Record<string, PendingTxMonitor>> {
    const result = await chrome.storage.local.get(MONITORS_STORAGE_KEY);
    return result[MONITORS_STORAGE_KEY] || {};
  }

  /**
   * Get count of pending monitors (for debugging)
   */
  async getPendingCount(): Promise<number> {
    const monitors = await this.getAllPendingMonitors();
    return Object.keys(monitors).length;
  }
}

/**
 * Create TransactionMonitor instance
 */
export function createTransactionMonitor(storageManager: StorageManager): TransactionMonitor {
  return new TransactionMonitor(storageManager);
}
