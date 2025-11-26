/**
 * Porto Service for Popup
 * Runs Porto SDK in visible popup context where WebAuthn prompts can appear
 */

import * as Porto from "porto";
import { base } from "viem/chains";

class PopupPortoService {
  private porto: ReturnType<typeof Porto.Porto.create> | null = null;
  private provider: any = null;
  private isInitialized = false;

  /**
   * Initialize Porto SDK in popup context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[PopupPorto] Already initialized');
      return;
    }

    try {
      console.log('[PopupPorto] Initializing Porto SDK in popup...');

      this.porto = Porto.Porto.create({
        // Supported chains
        chains: [base],

        // Use relay mode (no iframe, direct WebAuthn)
        mode: Porto.Mode.relay({
          multichain: true,
          keystoreHost: undefined,
        }),

        // Use IndexedDB storage
        storage: Porto.Storage.idb(),

        // Don't announce provider (we're in popup)
        announceProvider: false,
      });

      this.provider = this.porto.provider;
      this.isInitialized = true;

      console.log('[PopupPorto] Porto SDK initialized successfully');
      console.log('[PopupPorto] Provider ready:', !!this.provider);
    } catch (error) {
      console.error('[PopupPorto] Failed to initialize Porto:', error);
      throw error;
    }
  }

  /**
   * Count existing Porto accounts (for auto-numbering)
   */
  async countExistingAccounts(): Promise<number> {
    if (!this.provider) {
      return 0;
    }

    try {
      // Try to get existing accounts from Porto
      await this.provider.request({
        method: 'wallet_getCapabilities',
        params: [['0x2105']], // Base chain
      });

      // This is a rough estimate - Porto doesn't expose account count directly
      // We'll increment based on what we find in storage
      return 0; // Will be calculated from storage instead
    } catch (error) {
      console.warn('[PopupPorto] Could not count accounts:', error);
      return 0;
    }
  }

  /**
   * Create a new account
   */
  async createAccount(options: {
    displayName?: string;
    keychainLabel?: string;
  }): Promise<{
    address: string;
    accounts: string[];
  }> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Creating new account...');
    console.log('[PopupPorto] Display name:', options.displayName);
    console.log('[PopupPorto] Keychain label:', options.keychainLabel);
    console.log('[PopupPorto] This will trigger WebAuthn prompt in popup window');

    try {
      // Use keychainLabel for WebAuthn credential (appears in Touch ID)
      // Use displayName for extension UI (can be changed later)
      const keychainLabel = options.keychainLabel || options.displayName || 'Porto Wallet';

      const result = await this.provider.request({
        method: 'wallet_connect',
        params: [{
          capabilities: {
            createAccount: {
              label: keychainLabel, // Immutable - shows in Touch ID prompts
            },
          },
          chainIds: ['0x2105'], // Base chain ID in hex
        }],
      });

      console.log('[PopupPorto] Account created successfully:', result);

      // Extract address from Porto response
      // Porto returns: { accounts: [{ address, capabilities }], chainIds: [...] }
      const accountsArray = result.accounts || [];
      if (accountsArray.length === 0) {
        throw new Error('No account returned from Porto');
      }

      // Get the address string from the first account
      const address = accountsArray[0].address;
      console.log('[PopupPorto] Extracted address:', address);

      return {
        address,
        accounts: accountsArray.map((acc: any) => acc.address),
      };
    } catch (error: any) {
      console.error('[PopupPorto] Account creation failed:', error);
      throw error;
    }
  }

  /**
   * Connect to existing account
   */
  async connectAccount(): Promise<{
    address: string;
    accounts: string[];
  }> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Connecting to existing account...');

    try {
      const result = await this.provider.request({
        method: 'wallet_connect',
        params: [{
          capabilities: {
            selectAccount: true,
          },
          chainIds: ['0x2105'], // Base chain ID in hex
        }],
      });

      console.log('[PopupPorto] Account connected:', result);

      // Extract address from Porto response
      const accountsArray = result.accounts || [];
      if (accountsArray.length === 0) {
        throw new Error('No account returned from Porto');
      }

      // Get the address string from the first account
      const address = accountsArray[0].address;
      console.log('[PopupPorto] Extracted address:', address);

      return {
        address,
        accounts: accountsArray.map((acc: any) => acc.address),
      };
    } catch (error: any) {
      console.error('[PopupPorto] Account connection failed:', error);
      throw error;
    }
  }

  // ==================== SIGNING METHODS (Phase 4) ====================

  /**
   * Send a transaction via Porto SDK
   * This triggers WebAuthn for signing
   * @param params Transaction parameters
   * @returns Transaction hash
   */
  async sendTransaction(params: {
    to: string;
    value?: string;
    data?: string;
    chainId: number;
  }): Promise<string> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Sending transaction:', params);

    try {
      // Use wallet_sendCalls (EIP-5792) for Porto
      const chainIdHex = `0x${params.chainId.toString(16)}`;

      const result = await this.provider.request({
        method: 'wallet_sendCalls',
        params: [{
          calls: [{
            to: params.to,
            value: params.value || '0x0',
            data: params.data || '0x',
          }],
          chainId: chainIdHex,
        }],
      });

      console.log('[PopupPorto] Transaction sent, result:', result);

      // wallet_sendCalls returns bundle id, need to get tx hash
      // For now, return the bundle id as the result
      // The actual tx hash can be retrieved via wallet_getCallsStatus if needed
      return result;
    } catch (error: any) {
      console.error('[PopupPorto] Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Sign a personal message via Porto SDK
   * This triggers WebAuthn for signing
   * @param message The message to sign (hex string)
   * @param account The account address to sign with
   * @returns The signature
   */
  async signMessage(message: string, account: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Signing message...');

    try {
      // personal_sign params are [message, account]
      const signature = await this.provider.request({
        method: 'personal_sign',
        params: [message, account],
      });

      console.log('[PopupPorto] Message signed successfully');
      return signature;
    } catch (error: any) {
      console.error('[PopupPorto] Message signing failed:', error);
      throw error;
    }
  }

  /**
   * Sign typed data (EIP-712) via Porto SDK
   * This triggers WebAuthn for signing
   * @param typedData The typed data to sign (as JSON string or object)
   * @param account The account address to sign with
   * @returns The signature
   */
  async signTypedData(typedData: string | object, account: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Signing typed data...');

    try {
      // eth_signTypedData_v4 params are [account, typedDataJson]
      const typedDataJson = typeof typedData === 'string' ? typedData : JSON.stringify(typedData);

      const signature = await this.provider.request({
        method: 'eth_signTypedData_v4',
        params: [account, typedDataJson],
      });

      console.log('[PopupPorto] Typed data signed successfully');
      return signature;
    } catch (error: any) {
      console.error('[PopupPorto] Typed data signing failed:', error);
      throw error;
    }
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized && !!this.provider;
  }
}

// Singleton instance
export const popupPortoService = new PopupPortoService();
