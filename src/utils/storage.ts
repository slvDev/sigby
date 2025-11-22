/**
 * Type-safe wrapper around chrome.storage API
 * Provides structured access to extension storage with TypeScript type safety
 */

import type { Account, ConnectedDapp, Settings, Transaction } from "../types/account";
import { STORAGE_KEYS } from "./constants";

/**
 * Storage schema definition
 * All data stored in chrome.storage.local must conform to this interface
 */
export interface StorageData {
  /** User account information */
  [STORAGE_KEYS.ACCOUNT]?: Account;
  /** Connected dApps mapping (origin -> ConnectedDapp) */
  [STORAGE_KEYS.CONNECTED_DAPPS]?: Record<string, ConnectedDapp>;
  /** User settings */
  [STORAGE_KEYS.SETTINGS]?: Settings;
  /** Transaction history */
  [STORAGE_KEYS.TRANSACTION_HISTORY]?: Transaction[];
}

/**
 * Storage manager class
 * Provides type-safe methods for interacting with chrome.storage.local
 */
export class StorageManager {
  /**
   * Get a value from storage by key
   * @param key - Storage key to retrieve
   * @returns Promise resolving to the value or null if not found
   */
  async get<K extends keyof StorageData>(
    key: K
  ): Promise<StorageData[K] | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] ?? null;
    } catch (error) {
      console.error(`Failed to get storage key "${key}":`, error);
      return null;
    }
  }

  /**
   * Set a value in storage
   * @param key - Storage key to set
   * @param value - Value to store
   */
  async set<K extends keyof StorageData>(
    key: K,
    value: StorageData[K]
  ): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      // Check for quota exceeded error
      if (error instanceof Error && error.message.includes("QUOTA_BYTES")) {
        console.error("Storage quota exceeded");
        throw new Error("Storage quota exceeded. Please clear some data.");
      }
      console.error(`Failed to set storage key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Remove a key from storage
   * @param key - Storage key to remove
   */
  async remove(key: keyof StorageData): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error(`Failed to remove storage key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   * WARNING: This will remove ALL stored data
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch (error) {
      console.error("Failed to clear storage:", error);
      throw error;
    }
  }

  /**
   * Check if an account exists in storage
   * @returns Promise resolving to true if account exists
   */
  async hasAccount(): Promise<boolean> {
    const account = await this.get(STORAGE_KEYS.ACCOUNT);
    return account !== null && account !== undefined;
  }

  /**
   * Get current account or null
   * @returns Promise resolving to Account or null
   */
  async getAccount(): Promise<Account | null> {
    return await this.get(STORAGE_KEYS.ACCOUNT);
  }

  /**
   * Save account to storage
   * @param account - Account data to save
   */
  async setAccount(account: Account): Promise<void> {
    await this.set(STORAGE_KEYS.ACCOUNT, account);
  }

  /**
   * Remove account from storage
   */
  async removeAccount(): Promise<void> {
    await this.remove(STORAGE_KEYS.ACCOUNT);
  }

  /**
   * Get connected dApps
   * @returns Promise resolving to connected dApps record or empty object
   */
  async getConnectedDapps(): Promise<Record<string, ConnectedDapp>> {
    const dapps = await this.get(STORAGE_KEYS.CONNECTED_DAPPS);
    return dapps || {};
  }

  /**
   * Save connected dApps
   * @param dapps - Connected dApps record
   */
  async setConnectedDapps(
    dapps: Record<string, ConnectedDapp>
  ): Promise<void> {
    await this.set(STORAGE_KEYS.CONNECTED_DAPPS, dapps);
  }

  /**
   * Check if a dApp is connected
   * @param origin - dApp origin
   * @returns Promise resolving to true if connected
   */
  async isDappConnected(origin: string): Promise<boolean> {
    const dapps = await this.getConnectedDapps();
    return dapps[origin]?.connected ?? false;
  }

  /**
   * Add or update a connected dApp
   * @param origin - dApp origin
   * @param dapp - Connected dApp data
   */
  async addConnectedDapp(
    origin: string,
    dapp: ConnectedDapp
  ): Promise<void> {
    const dapps = await this.getConnectedDapps();
    dapps[origin] = dapp;
    await this.setConnectedDapps(dapps);
  }

  /**
   * Remove a connected dApp
   * @param origin - dApp origin to disconnect
   */
  async removeConnectedDapp(origin: string): Promise<void> {
    const dapps = await this.getConnectedDapps();
    delete dapps[origin];
    await this.setConnectedDapps(dapps);
  }

  /**
   * Get user settings
   * @returns Promise resolving to Settings or default settings
   */
  async getSettings(): Promise<Settings> {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    return (
      settings || {
        defaultChain: 1, // Ethereum mainnet
        autoLockTimeout: 0, // Disabled
        showTestNetworks: false,
        currency: "USD",
        language: "en",
      }
    );
  }

  /**
   * Save user settings
   * @param settings - Settings to save
   */
  async setSettings(settings: Settings): Promise<void> {
    await this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Get transaction history
   * @returns Promise resolving to transaction array or empty array
   */
  async getTransactionHistory(): Promise<Transaction[]> {
    const history = await this.get(STORAGE_KEYS.TRANSACTION_HISTORY);
    return history || [];
  }

  /**
   * Add a transaction to history
   * @param transaction - Transaction to add
   * @param maxSize - Maximum history size (default: 100)
   */
  async addTransaction(
    transaction: Transaction,
    maxSize: number = 100
  ): Promise<void> {
    const history = await this.getTransactionHistory();
    // Add to beginning of array
    history.unshift(transaction);
    // Trim to max size
    if (history.length > maxSize) {
      history.splice(maxSize);
    }
    await this.set(STORAGE_KEYS.TRANSACTION_HISTORY, history);
  }

  /**
   * Update a transaction in history
   * @param txId - Transaction ID
   * @param updates - Partial transaction updates
   */
  async updateTransaction(
    txId: string,
    updates: Partial<Transaction>
  ): Promise<void> {
    const history = await this.getTransactionHistory();
    const index = history.findIndex((tx) => tx.id === txId);
    if (index !== -1) {
      history[index] = { ...history[index], ...updates };
      await this.set(STORAGE_KEYS.TRANSACTION_HISTORY, history);
    }
  }

  /**
   * Get storage usage information
   * @returns Promise resolving to bytes in use and quota
   */
  async getStorageInfo(): Promise<{
    bytesInUse: number;
    quota: number;
    percentUsed: number;
  }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
      const percentUsed = (bytesInUse / quota) * 100;

      return {
        bytesInUse,
        quota,
        percentUsed: Math.round(percentUsed * 100) / 100,
      };
    } catch (error) {
      console.error("Failed to get storage info:", error);
      return { bytesInUse: 0, quota: 0, percentUsed: 0 };
    }
  }
}

/**
 * Singleton instance of StorageManager
 * Use this throughout the extension for consistent storage access
 */
export const storageManager = new StorageManager();
