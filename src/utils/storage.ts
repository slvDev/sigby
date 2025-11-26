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
  // Multi-account storage
  /** All accounts keyed by address */
  [STORAGE_KEYS.ACCOUNTS]?: Record<string, Account>;
  /** Currently active account address */
  [STORAGE_KEYS.ACTIVE_ACCOUNT]?: string;
  /** Ordered list of account addresses for UI display */
  [STORAGE_KEYS.ACCOUNT_ORDER]?: string[];
  /** Total accounts created (for keychain numbering) */
  [STORAGE_KEYS.ACCOUNT_COUNT]?: number;
  /** Per-account dApp connections: address -> origin -> ConnectedDapp */
  [STORAGE_KEYS.ACCOUNT_DAPPS]?: Record<string, Record<string, ConnectedDapp>>;

  // Global settings
  /** User settings */
  [STORAGE_KEYS.SETTINGS]?: Settings;
  /** Transaction history */
  [STORAGE_KEYS.TRANSACTION_HISTORY]?: Transaction[];

  // Legacy keys (for migration)
  /** Legacy: Single user account */
  [STORAGE_KEYS.ACCOUNT]?: Account;
  /** Legacy: Global connected dApps */
  [STORAGE_KEYS.CONNECTED_DAPPS]?: Record<string, ConnectedDapp>;
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

  // ==================== MULTI-ACCOUNT METHODS ====================

  /**
   * Get all accounts as a record
   * @returns Promise resolving to Record<address, Account>
   */
  async getAllAccounts(): Promise<Record<string, Account>> {
    const accounts = await this.get(STORAGE_KEYS.ACCOUNTS);
    return accounts || {};
  }

  /**
   * Get account by address
   * @param address - Ethereum address
   * @returns Promise resolving to Account or null
   */
  async getAccountByAddress(address: string): Promise<Account | null> {
    const accounts = await this.getAllAccounts();
    return accounts[address] || null;
  }

  /**
   * Save or update an account
   * @param account - Account to save
   */
  async saveAccount(account: Account): Promise<void> {
    const accounts = await this.getAllAccounts();
    accounts[account.address] = account;
    await this.set(STORAGE_KEYS.ACCOUNTS, accounts);

    // Update account order if new account
    const order = await this.getAccountOrder();
    if (!order.includes(account.address)) {
      order.push(account.address);
      await this.setAccountOrder(order);
    }
  }

  /**
   * Remove an account by address
   * @param address - Address of account to remove
   */
  async removeAccountByAddress(address: string): Promise<void> {
    const accounts = await this.getAllAccounts();
    delete accounts[address];
    await this.set(STORAGE_KEYS.ACCOUNTS, accounts);

    // Update account order
    const order = await this.getAccountOrder();
    const newOrder = order.filter((a) => a !== address);
    await this.setAccountOrder(newOrder);

    // Update active account if needed
    const activeAddress = await this.getActiveAccountAddress();
    if (activeAddress === address) {
      // Set to first remaining account or null
      await this.setActiveAccountAddress(newOrder[0] || null);
    }

    // Remove per-account dApp connections
    const accountDapps = await this.get(STORAGE_KEYS.ACCOUNT_DAPPS);
    if (accountDapps) {
      delete accountDapps[address];
      await this.set(STORAGE_KEYS.ACCOUNT_DAPPS, accountDapps);
    }
  }

  /**
   * Check if any accounts exist
   * @returns Promise resolving to true if at least one account exists
   */
  async hasAccounts(): Promise<boolean> {
    const accounts = await this.getAllAccounts();
    return Object.keys(accounts).length > 0;
  }

  /**
   * Get active account address
   * @returns Promise resolving to address string or null
   */
  async getActiveAccountAddress(): Promise<string | null> {
    return await this.get(STORAGE_KEYS.ACTIVE_ACCOUNT) || null;
  }

  /**
   * Set active account address
   * @param address - Address to set as active (or null)
   */
  async setActiveAccountAddress(address: string | null): Promise<void> {
    if (address) {
      await this.set(STORAGE_KEYS.ACTIVE_ACCOUNT, address);
    } else {
      await this.remove(STORAGE_KEYS.ACTIVE_ACCOUNT);
    }
  }

  /**
   * Get the currently active account
   * @returns Promise resolving to Account or null
   */
  async getActiveAccount(): Promise<Account | null> {
    const address = await this.getActiveAccountAddress();
    if (!address) return null;
    return await this.getAccountByAddress(address);
  }

  /**
   * Get account order (for UI display)
   * @returns Promise resolving to array of addresses
   */
  async getAccountOrder(): Promise<string[]> {
    return (await this.get(STORAGE_KEYS.ACCOUNT_ORDER)) || [];
  }

  /**
   * Set account order
   * @param order - Array of addresses in display order
   */
  async setAccountOrder(order: string[]): Promise<void> {
    await this.set(STORAGE_KEYS.ACCOUNT_ORDER, order);
  }

  /**
   * Get account count (total accounts created, for keychain numbering)
   * @returns Promise resolving to account count
   */
  async getAccountCount(): Promise<number> {
    const count = await this.get(STORAGE_KEYS.ACCOUNT_COUNT);
    return count || 0;
  }

  /**
   * Increment account count (when creating new account)
   * @returns Promise resolving to new count
   */
  async incrementAccountCount(): Promise<number> {
    const currentCount = await this.getAccountCount();
    const newCount = currentCount + 1;
    await this.set(STORAGE_KEYS.ACCOUNT_COUNT, newCount);
    return newCount;
  }

  // ==================== LEGACY SINGLE-ACCOUNT METHODS (for migration) ====================

  /**
   * @deprecated Use getAllAccounts() instead
   * Check if an account exists in storage (legacy)
   */
  async hasAccount(): Promise<boolean> {
    // Check new multi-account storage first
    if (await this.hasAccounts()) {
      return true;
    }
    // Fall back to legacy single-account
    const account = await this.get(STORAGE_KEYS.ACCOUNT);
    return account !== null && account !== undefined;
  }

  /**
   * @deprecated Use getActiveAccount() instead
   * Get current account or null (legacy)
   */
  async getAccount(): Promise<Account | null> {
    // Try new multi-account storage first
    const activeAccount = await this.getActiveAccount();
    if (activeAccount) return activeAccount;
    // Fall back to legacy
    const legacyAccount = await this.get(STORAGE_KEYS.ACCOUNT);
    return legacyAccount ?? null;
  }

  /**
   * @deprecated Use saveAccount() instead
   * Save account to storage (legacy)
   */
  async setAccount(account: Account): Promise<void> {
    await this.set(STORAGE_KEYS.ACCOUNT, account);
  }

  /**
   * @deprecated Use removeAccountByAddress() instead
   * Remove account from storage (legacy)
   */
  async removeAccount(): Promise<void> {
    await this.remove(STORAGE_KEYS.ACCOUNT);
  }

  // ==================== PER-ACCOUNT DAPP METHODS ====================

  /**
   * Get all dApp connections for a specific account
   * @param address - Account address
   * @returns Promise resolving to Record<origin, ConnectedDapp>
   */
  async getAccountDapps(address: string): Promise<Record<string, ConnectedDapp>> {
    const allAccountDapps = await this.get(STORAGE_KEYS.ACCOUNT_DAPPS);
    return allAccountDapps?.[address] || {};
  }

  /**
   * Connect an account to a dApp
   * @param address - Account address
   * @param origin - dApp origin
   * @param dapp - ConnectedDapp data
   */
  async connectAccountToDapp(
    address: string,
    origin: string,
    dapp: ConnectedDapp
  ): Promise<void> {
    const allAccountDapps = (await this.get(STORAGE_KEYS.ACCOUNT_DAPPS)) || {};
    if (!allAccountDapps[address]) {
      allAccountDapps[address] = {};
    }
    allAccountDapps[address][origin] = { ...dapp, accountAddress: address };
    await this.set(STORAGE_KEYS.ACCOUNT_DAPPS, allAccountDapps);
  }

  /**
   * Disconnect an account from a dApp
   * @param address - Account address
   * @param origin - dApp origin
   */
  async disconnectAccountFromDapp(address: string, origin: string): Promise<void> {
    const allAccountDapps = (await this.get(STORAGE_KEYS.ACCOUNT_DAPPS)) || {};
    if (allAccountDapps[address]) {
      delete allAccountDapps[address][origin];
      await this.set(STORAGE_KEYS.ACCOUNT_DAPPS, allAccountDapps);
    }
  }

  /**
   * Check if an account is connected to a dApp
   * @param address - Account address
   * @param origin - dApp origin
   * @returns Promise resolving to true if connected
   */
  async isAccountConnectedToDapp(address: string, origin: string): Promise<boolean> {
    const accountDapps = await this.getAccountDapps(address);
    return accountDapps[origin]?.connected ?? false;
  }

  /**
   * Get all accounts connected to a specific dApp
   * @param origin - dApp origin
   * @returns Promise resolving to array of addresses
   */
  async getAccountsConnectedToDapp(origin: string): Promise<string[]> {
    const allAccountDapps = (await this.get(STORAGE_KEYS.ACCOUNT_DAPPS)) || {};
    const connectedAddresses: string[] = [];
    for (const [address, dapps] of Object.entries(allAccountDapps)) {
      if (dapps[origin]?.connected) {
        connectedAddresses.push(address);
      }
    }
    return connectedAddresses;
  }

  // ==================== LEGACY DAPP METHODS (for migration) ====================

  /**
   * @deprecated Use getAccountDapps() instead
   * Get connected dApps (legacy global)
   */
  async getConnectedDapps(): Promise<Record<string, ConnectedDapp>> {
    const dapps = await this.get(STORAGE_KEYS.CONNECTED_DAPPS);
    return dapps || {};
  }

  /**
   * @deprecated Use connectAccountToDapp() instead
   * Save connected dApps (legacy global)
   */
  async setConnectedDapps(
    dapps: Record<string, ConnectedDapp>
  ): Promise<void> {
    await this.set(STORAGE_KEYS.CONNECTED_DAPPS, dapps);
  }

  /**
   * @deprecated Use isAccountConnectedToDapp() instead
   * Check if a dApp is connected (legacy)
   */
  async isDappConnected(origin: string): Promise<boolean> {
    // Check active account's connections first
    const activeAddress = await this.getActiveAccountAddress();
    if (activeAddress) {
      return await this.isAccountConnectedToDapp(activeAddress, origin);
    }
    // Fall back to legacy
    const dapps = await this.getConnectedDapps();
    return dapps[origin]?.connected ?? false;
  }

  /**
   * @deprecated Use connectAccountToDapp() instead
   * Add or update a connected dApp (legacy)
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
   * @deprecated Use disconnectAccountFromDapp() instead
   * Remove a connected dApp (legacy)
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

  // ==================== MIGRATION ====================

  /**
   * Migrate from single-account to multi-account storage
   * Called on extension startup
   */
  async migrateToMultiAccount(): Promise<void> {
    // Check if already migrated
    const existingAccounts = await this.get(STORAGE_KEYS.ACCOUNTS);
    if (existingAccounts && Object.keys(existingAccounts).length > 0) {
      console.log("[Migration] Already migrated to multi-account storage");
      return;
    }

    // Check for legacy single account
    const legacyAccount = await this.get(STORAGE_KEYS.ACCOUNT);
    if (!legacyAccount) {
      // No legacy account, initialize empty multi-account storage
      console.log("[Migration] No legacy account, initializing empty storage");
      await this.set(STORAGE_KEYS.ACCOUNTS, {});
      await this.set(STORAGE_KEYS.ACCOUNT_ORDER, []);
      await this.set(STORAGE_KEYS.ACCOUNT_DAPPS, {});
      return;
    }

    console.log("[Migration] Migrating legacy account to multi-account storage...");

    // Migrate account
    const address = legacyAccount.address;
    const migratedAccount = {
      ...legacyAccount,
      displayName: legacyAccount.displayName || "Porto Wallet 1",
      accountIndex: 1,
    };

    // Save to new multi-account storage
    await this.set(STORAGE_KEYS.ACCOUNTS, { [address]: migratedAccount });
    await this.set(STORAGE_KEYS.ACTIVE_ACCOUNT, address);
    await this.set(STORAGE_KEYS.ACCOUNT_ORDER, [address]);

    // Ensure account count is at least 1 (handle undefined case)
    const currentCount = await this.getAccountCount();
    await this.set(STORAGE_KEYS.ACCOUNT_COUNT, Math.max(currentCount || 0, 1));

    // Migrate dApps (associate with migrated account)
    const legacyDapps = await this.get(STORAGE_KEYS.CONNECTED_DAPPS);
    if (legacyDapps && Object.keys(legacyDapps).length > 0) {
      const accountDapps: Record<string, Record<string, ConnectedDapp>> = {
        [address]: {},
      };

      for (const [origin, dapp] of Object.entries(legacyDapps)) {
        accountDapps[address][origin] = {
          ...dapp,
          accountAddress: address,
        };
      }

      await this.set(STORAGE_KEYS.ACCOUNT_DAPPS, accountDapps);
      console.log(`[Migration] Migrated ${Object.keys(legacyDapps).length} dApp connections`);
    } else {
      await this.set(STORAGE_KEYS.ACCOUNT_DAPPS, {});
    }

    console.log("[Migration] Successfully migrated to multi-account storage");
    // Keep legacy keys for potential rollback (don't delete them)
  }
}

/**
 * Singleton instance of StorageManager
 * Use this throughout the extension for consistent storage access
 */
export const storageManager = new StorageManager();
