/**
 * Porto Service for Popup
 * Runs Porto SDK in visible popup context where WebAuthn prompts can appear
 */

import * as Porto from "porto";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
  holesky,
} from "viem/chains";
import { CHAIN_IDS } from "../utils/constants";
import type { PortoHistoryEntry, PortoCallsStatus, PortoAssets, FeeToken, ChainCapabilities } from "../types/porto";

/**
 * All supported chains for Porto SDK
 */
const SUPPORTED_CHAINS = [
  // Mainnets
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  // Testnets
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
  holesky,
];

/**
 * Chain ID hex strings for all supported chains
 */
const SUPPORTED_CHAIN_IDS_HEX = Object.values(CHAIN_IDS).map(
  (id) => `0x${id.toString(16)}`
);

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
      console.log('[PopupPorto] Configuring with', SUPPORTED_CHAINS.length, 'chains');

      this.porto = Porto.Porto.create({
        // All supported chains (cast to satisfy readonly tuple type)
        chains: SUPPORTED_CHAINS as unknown as readonly [typeof mainnet, ...typeof SUPPORTED_CHAINS],

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
      // Try to get existing accounts from Porto using all supported chains
      await this.provider.request({
        method: 'wallet_getCapabilities',
        params: [SUPPORTED_CHAIN_IDS_HEX],
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
          chainIds: SUPPORTED_CHAIN_IDS_HEX, // All supported chains
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
          chainIds: SUPPORTED_CHAIN_IDS_HEX, // All supported chains
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
   * Get currently authorized accounts from Porto
   */
  async getAuthorizedAccounts(): Promise<string[]> {
    if (!this.provider) {
      return [];
    }

    try {
      const accounts = await this.provider.request({
        method: 'eth_accounts',
      });
      return accounts || [];
    } catch (error) {
      console.error('[PopupPorto] Failed to get accounts:', error);
      return [];
    }
  }

  /**
   * Ensure an account is authorized with Porto
   * If not authorized, triggers wallet_connect to authorize it
   */
  async ensureAccountAuthorized(address: string): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    // Check if already authorized
    const authorizedAccounts = await this.getAuthorizedAccounts();
    const isAuthorized = authorizedAccounts.some(
      (acc) => acc.toLowerCase() === address.toLowerCase()
    );

    if (isAuthorized) {
      console.log('[PopupPorto] Account already authorized:', address);
      return true;
    }

    console.log('[PopupPorto] Account not authorized, connecting:', address);

    // Need to connect/authorize the account
    // This will trigger WebAuthn to verify ownership
    try {
      const result = await this.provider.request({
        method: 'wallet_connect',
        params: [{
          capabilities: {
            selectAccount: true,
          },
          chainIds: SUPPORTED_CHAIN_IDS_HEX,
        }],
      });

      // Check if the requested account is now authorized
      const newAccounts = result.accounts?.map((acc: any) => acc.address.toLowerCase()) || [];
      return newAccounts.includes(address.toLowerCase());
    } catch (error) {
      console.error('[PopupPorto] Failed to authorize account:', error);
      return false;
    }
  }

  /**
   * Send a transaction via Porto SDK
   * This triggers WebAuthn for signing
   * @param params Transaction parameters
   * @returns Transaction hash
   */
  async sendTransaction(params: {
    from: string;
    to: string;
    value?: string;
    data?: string;
    chainId: number;
    feeToken?: string; // 'native' | 'USDC' | 'USDT' | token address
  }): Promise<string> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Sending transaction:', params);

    // Ensure the account is authorized before sending
    const isAuthorized = await this.ensureAccountAuthorized(params.from);
    if (!isAuthorized) {
      throw new Error('Account not authorized. Please reconnect the account.');
    }

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
          from: params.from, // Specify which account to send from
          // Add capabilities if feeToken specified
          ...(params.feeToken && {
            capabilities: {
              feeToken: params.feeToken,
            },
          }),
        }],
      });

      console.log('[PopupPorto] Transaction sent, result:', result);

      // wallet_sendCalls returns { id: "0x..." } - extract the bundle ID
      // The actual tx hash can be retrieved via wallet_getCallsStatus if needed
      const bundleId = typeof result === 'string' ? result : result?.id || result;
      return bundleId;
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

  // ==================== PORTO SDK METHODS ====================

  /**
   * Get transaction history via Porto SDK (wallet_getCallsHistory)
   * @param address Account address
   * @returns Array of history entries
   */
  async getCallsHistory(address: string): Promise<PortoHistoryEntry[]> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Getting calls history for:', address);

    try {
      const history = await this.provider.request({
        method: 'wallet_getCallsHistory',
        params: [{
          address,
          limit: 50,
          sort: 'desc',
        }],
      });

      console.log('[PopupPorto] Calls history retrieved:', history?.length || 0, 'entries');
      return history || [];
    } catch (error: any) {
      console.error('[PopupPorto] Failed to get calls history:', error);
      throw error;
    }
  }

  /**
   * Get status of a wallet_sendCalls bundle (wallet_getCallsStatus)
   * Returns receipts with transaction hashes when confirmed
   * @param bundleId Bundle ID from wallet_sendCalls
   * @returns Call status with receipts
   */
  async getCallsStatus(bundleId: string): Promise<PortoCallsStatus> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Getting calls status for bundle:', bundleId);

    try {
      const status = await this.provider.request({
        method: 'wallet_getCallsStatus',
        params: [bundleId],
      });

      console.log('[PopupPorto] Calls status:', status);
      return status;
    } catch (error: any) {
      console.error('[PopupPorto] Failed to get calls status:', error);
      throw error;
    }
  }

  /**
   * Get all assets (native + ERC-20 tokens) via Porto SDK (wallet_getAssets)
   * @param address Account address
   * @param chainIds Optional array of chain IDs to filter (decimal numbers)
   * @returns Assets grouped by chain ID
   */
  async getAssets(address: string, chainIds?: number[]): Promise<PortoAssets> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[PopupPorto] Getting assets for:', address, 'chains:', chainIds);

    try {
      // Convert chain IDs to hex strings (Porto expects hex format)
      const chainFilterHex = chainIds?.map(id => `0x${id.toString(16)}`);

      const assets = await this.provider.request({
        method: 'wallet_getAssets',
        params: [{
          account: address,
          chainFilter: chainFilterHex,
          assetTypeFilter: ['erc20', 'native'],
        }],
      });

      console.log('[PopupPorto] Assets retrieved:', assets);
      return assets || {};
    } catch (error: any) {
      console.error('[PopupPorto] Failed to get assets:', error);
      throw error;
    }
  }

  /**
   * Get wallet capabilities including available fee tokens
   * @param chainId Chain ID (decimal number)
   * @returns Chain capabilities or null if not available
   */
  async getCapabilities(chainId: number): Promise<ChainCapabilities | null> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    const chainIdHex = `0x${chainId.toString(16)}`;

    console.log('[PopupPorto] Getting capabilities for chain:', chainIdHex);

    try {
      const capabilities = await this.provider.request({
        method: 'wallet_getCapabilities',
        params: [undefined, [chainIdHex]],
      });

      console.log('[PopupPorto] Capabilities retrieved:', capabilities);
      return capabilities[chainIdHex] || null;
    } catch (error: any) {
      console.error('[PopupPorto] Failed to get capabilities:', error);
      return null;
    }
  }

  /**
   * Disconnect from Porto SDK (wallet_disconnect)
   * Should be called before deleting account from local storage
   */
  async disconnect(): Promise<void> {
    if (!this.provider) {
      console.warn('[PopupPorto] Provider not initialized, skipping disconnect');
      return;
    }

    console.log('[PopupPorto] Disconnecting from Porto...');

    try {
      await this.provider.request({
        method: 'wallet_disconnect',
      });
      console.log('[PopupPorto] Successfully disconnected from Porto');
    } catch (error: any) {
      // Log but don't throw - local deletion should still proceed
      console.error('[PopupPorto] Disconnect error:', error);
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
