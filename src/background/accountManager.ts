/**
 * Account Manager
 * Manages multi-account lifecycle, authentication state, and persistence
 */

import { StorageManager } from "../utils/storage";
import type { PortoService } from "./portoService";
import { eventBroadcaster } from "./eventBroadcaster";
import type { Account } from "../types/account";

/**
 * Validate Ethereum address format
 * @param address - Address to validate
 * @returns true if valid, false otherwise
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Account Manager class
 * Handles multi-account creation, connection, switching, and state management
 */
export class AccountManager {
  private portoService: PortoService;

  constructor(
    private storageManager: StorageManager,
    portoService: PortoService
  ) {
    // Store for Phase 4 transaction signing
    this.portoService = portoService;
  }

  /**
   * Get Porto service instance (for Phase 4 transaction signing)
   * @internal
   */
  getPortoService(): PortoService {
    return this.portoService;
  }

  // ==================== ACCOUNT CREATION ====================

  /**
   * Save a new account (created by popup's Porto SDK)
   * @param address - Account address from popup
   * @param displayName - Optional display name for the account
   * @returns Promise resolving to created Account
   */
  async createAccount(address: string, displayName?: string): Promise<Account> {
    try {
      console.log("[AccountManager] Creating new account...");
      console.log("[AccountManager] Address:", address);

      // Validate address format
      if (!isValidAddress(address)) {
        throw new Error("Invalid Ethereum address format");
      }

      // Check if account already exists
      const existingAccount = await this.storageManager.getAccountByAddress(address);
      if (existingAccount) {
        console.log("[AccountManager] Account already exists, updating lastAuthAt");
        existingAccount.lastAuthAt = Date.now();
        await this.storageManager.saveAccount(existingAccount);
        await this.storageManager.setActiveAccountAddress(address);
        return existingAccount;
      }

      // Get next account index for keychain labeling
      const accountCount = await this.storageManager.getAccountCount();
      const accountIndex = accountCount + 1;

      // Create account object
      const account: Account = {
        address,
        credentialId: "", // Managed by Porto SDK in IndexedDB
        publicKey: "",
        displayName: displayName || `Account ${accountIndex}`,
        createdAt: Date.now(),
        lastAuthAt: Date.now(),
        accountIndex,
      };

      // Save to multi-account storage
      await this.storageManager.saveAccount(account);

      // Increment account count for next keychain numbering
      await this.storageManager.incrementAccountCount();

      // Set as active account
      await this.storageManager.setActiveAccountAddress(address);

      console.log("[AccountManager] Account created:", account.address);
      return account;
    } catch (error) {
      console.error("[AccountManager] Failed to create account:", error);
      throw error;
    }
  }

  /**
   * Connect to existing account using WebAuthn
   * @param address - Account address from Porto SDK
   * @param displayName - Optional display name
   * @returns Promise resolving to Account
   */
  async connectExistingAccount(address: string, displayName?: string): Promise<Account> {
    try {
      console.log("[AccountManager] Connecting existing account...");
      console.log("[AccountManager] Address:", address);

      // Validate address format
      if (!isValidAddress(address)) {
        throw new Error("Invalid Ethereum address format");
      }

      // Check if it exists in storage
      const existingAccount = await this.storageManager.getAccountByAddress(address);

      if (existingAccount) {
        // Update last auth time
        existingAccount.lastAuthAt = Date.now();
        await this.storageManager.saveAccount(existingAccount);
        await this.storageManager.setActiveAccountAddress(address);
        console.log("[AccountManager] Existing account reconnected:", address);
        return existingAccount;
      }

      // Get next account index
      const accountCount = await this.storageManager.getAccountCount();
      const accountIndex = accountCount + 1;

      // Create new account entry
      const account: Account = {
        address,
        credentialId: "", // Managed by Porto SDK in IndexedDB
        publicKey: "",
        displayName: displayName || `Account ${accountIndex}`,
        createdAt: Date.now(),
        lastAuthAt: Date.now(),
        accountIndex,
      };

      await this.storageManager.saveAccount(account);
      await this.storageManager.incrementAccountCount();
      await this.storageManager.setActiveAccountAddress(address);

      console.log("[AccountManager] New account connected and saved:", address);
      return account;
    } catch (error) {
      console.error("[AccountManager] Failed to connect account:", error);
      throw error;
    }
  }

  // ==================== ACCOUNT RETRIEVAL ====================

  /**
   * Get all accounts
   * @returns Promise resolving to array of Accounts
   */
  async getAllAccounts(): Promise<Account[]> {
    try {
      const accountsRecord = await this.storageManager.getAllAccounts();
      const accountOrder = await this.storageManager.getAccountOrder();

      // Return accounts in order
      const orderedAccounts: Account[] = [];
      for (const address of accountOrder) {
        if (accountsRecord[address]) {
          orderedAccounts.push(accountsRecord[address]);
        }
      }

      // Add any accounts not in order (shouldn't happen, but just in case)
      for (const account of Object.values(accountsRecord)) {
        if (!accountOrder.includes(account.address)) {
          orderedAccounts.push(account);
        }
      }

      return orderedAccounts;
    } catch (error) {
      console.error("[AccountManager] Failed to get all accounts:", error);
      return [];
    }
  }

  /**
   * Get account by address
   * @param address - Account address
   * @returns Promise resolving to Account or null
   */
  async getAccountByAddress(address: string): Promise<Account | null> {
    try {
      return await this.storageManager.getAccountByAddress(address);
    } catch (error) {
      console.error("[AccountManager] Failed to get account:", error);
      return null;
    }
  }

  /**
   * Get currently active account
   * @returns Promise resolving to Account or null
   */
  async getActiveAccount(): Promise<Account | null> {
    try {
      return await this.storageManager.getActiveAccount();
    } catch (error) {
      console.error("[AccountManager] Failed to get active account:", error);
      return null;
    }
  }

  /**
   * Get active account address
   * @returns Promise resolving to address string or null
   */
  async getActiveAccountAddress(): Promise<string | null> {
    return await this.storageManager.getActiveAccountAddress();
  }

  /**
   * @deprecated Use getActiveAccount() instead
   * Get current account (legacy compatibility)
   */
  async getAccount(): Promise<Account | null> {
    return await this.getActiveAccount();
  }

  /**
   * @deprecated Use getActiveAccountAddress() instead
   * Get current account address (legacy compatibility)
   */
  async getAccountAddress(): Promise<string | null> {
    return await this.getActiveAccountAddress();
  }

  // ==================== ACCOUNT STATE ====================

  /**
   * Check if any accounts exist
   * @returns Promise resolving to boolean
   */
  async hasAccounts(): Promise<boolean> {
    return await this.storageManager.hasAccounts();
  }

  /**
   * @deprecated Use hasAccounts() instead
   * Check if user has an account (legacy compatibility)
   */
  async hasAccount(): Promise<boolean> {
    return await this.hasAccounts();
  }

  /**
   * Check if user is authenticated (has active account)
   * @returns Promise resolving to boolean
   */
  async isAuthenticated(): Promise<boolean> {
    const account = await this.getActiveAccount();
    return account !== null;
  }

  // ==================== ACCOUNT SWITCHING ====================

  /**
   * Switch to a different account
   * @param address - Address of account to switch to
   */
  async switchAccount(address: string): Promise<void> {
    try {
      console.log("[AccountManager] Switching to account:", address);

      const account = await this.storageManager.getAccountByAddress(address);
      if (!account) {
        throw new Error(`Account ${address} not found`);
      }

      // Update last auth time
      account.lastAuthAt = Date.now();
      await this.storageManager.saveAccount(account);

      // Set as active
      await this.storageManager.setActiveAccountAddress(address);

      // Broadcast accountsChanged event to all dApps
      await eventBroadcaster.accountsChanged([address]);

      console.log("[AccountManager] Switched to account:", address);
    } catch (error) {
      console.error("[AccountManager] Failed to switch account:", error);
      throw error;
    }
  }

  // ==================== ACCOUNT UPDATES ====================

  /**
   * Update account information by address
   * @param address - Account address
   * @param updates - Partial account updates
   */
  async updateAccount(address: string, updates: Partial<Omit<Account, "address">>): Promise<void> {
    try {
      const account = await this.storageManager.getAccountByAddress(address);

      if (!account) {
        throw new Error(`Account ${address} not found`);
      }

      // Merge updates (don't allow changing address)
      const updatedAccount: Account = {
        ...account,
        ...updates,
        address: account.address, // Ensure address can't be changed
      };

      await this.storageManager.saveAccount(updatedAccount);
      console.log("[AccountManager] Account updated:", address);
    } catch (error) {
      console.error("[AccountManager] Failed to update account:", error);
      throw error;
    }
  }

  /**
   * Update last authentication timestamp for active account
   */
  async updateLastAuth(): Promise<void> {
    try {
      const address = await this.getActiveAccountAddress();
      if (address) {
        await this.updateAccount(address, { lastAuthAt: Date.now() });
      }
    } catch (error) {
      console.error("[AccountManager] Failed to update last auth:", error);
    }
  }

  // ==================== ACCOUNT DELETION ====================

  /**
   * Delete an account
   * @param address - Address of account to delete
   */
  async deleteAccount(address: string): Promise<void> {
    try {
      console.log("[AccountManager] Deleting account:", address);

      await this.storageManager.removeAccountByAddress(address);

      console.log("[AccountManager] Account deleted:", address);
    } catch (error) {
      console.error("[AccountManager] Failed to delete account:", error);
      throw error;
    }
  }

  /**
   * Disconnect current account (logout from active account only)
   * @deprecated Use deleteAccount() for removing accounts
   */
  async disconnect(): Promise<void> {
    try {
      console.log("[AccountManager] Disconnecting active account...");

      const address = await this.getActiveAccountAddress();
      if (address) {
        await this.deleteAccount(address);
      }

      // Check if any accounts remain
      const newActiveAddress = await this.getActiveAccountAddress();

      // Broadcast accountsChanged event
      if (newActiveAddress) {
        await eventBroadcaster.accountsChanged([newActiveAddress]);
      } else {
        await eventBroadcaster.accountsChanged([]);
      }

      console.log("[AccountManager] Account disconnected");
    } catch (error) {
      console.error("[AccountManager] Failed to disconnect:", error);
      throw error;
    }
  }

  // ==================== ACCOUNT ORDER ====================

  /**
   * Get account display order
   * @returns Promise resolving to array of addresses
   */
  async getAccountOrder(): Promise<string[]> {
    return await this.storageManager.getAccountOrder();
  }

  /**
   * Set account display order (for drag-drop reordering)
   * @param order - Array of addresses in desired order
   */
  async setAccountOrder(order: string[]): Promise<void> {
    await this.storageManager.setAccountOrder(order);
  }
}
