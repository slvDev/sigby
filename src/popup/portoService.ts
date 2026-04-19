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
import type {
  PortoHistoryEntry,
  PortoCallsStatus,
  PortoAssets,
  ChainCapabilities,
  PermissionRequest,
  GrantedPermission,
  Permission,
  AccountKey,
  RelayHealth,
} from "../types/porto";
import { isPortoStatusFailed, portoStatusToString } from "../types/porto";
import { ProviderRpcError, RPC_ERROR_CODES } from "../utils/rpcError";

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
      console.log('[Berth:Popup] Already initialized');
      return;
    }

    try {
      console.log('[Berth:Popup] Initializing Porto SDK in popup...');
      console.log('[Berth:Popup] Configuring with', SUPPORTED_CHAINS.length, 'chains');

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

      console.log('[Berth:Popup] Porto SDK initialized successfully');
      console.log('[Berth:Popup] Provider ready:', !!this.provider);
    } catch (error) {
      console.error('[Berth:Popup] Failed to initialize Porto:', error);
      throw error;
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

    console.log('[Berth:Popup] Creating new account...');
    console.log('[Berth:Popup] Display name:', options.displayName);
    console.log('[Berth:Popup] Keychain label:', options.keychainLabel);
    console.log('[Berth:Popup] This will trigger WebAuthn prompt in popup window');

    try {
      // Use keychainLabel for WebAuthn credential (appears in Touch ID)
      // Use displayName for extension UI (can be changed later)
      const keychainLabel = options.keychainLabel || options.displayName || 'Berth';

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

      console.log('[Berth:Popup] Account created successfully:', result);

      // Extract address from Porto response
      // Porto returns: { accounts: [{ address, capabilities }], chainIds: [...] }
      const accountsArray = result.accounts || [];
      if (accountsArray.length === 0) {
        throw new Error('No account returned from Porto');
      }

      // Get the address string from the first account
      const address = accountsArray[0].address;
      console.log('[Berth:Popup] Extracted address:', address);

      return {
        address,
        accounts: accountsArray.map((acc: any) => acc.address),
      };
    } catch (error: any) {
      console.error('[Berth:Popup] Account creation failed:', error);
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

    console.log('[Berth:Popup] Connecting to existing account...');

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

      console.log('[Berth:Popup] Account connected:', result);

      // Extract address from Porto response
      const accountsArray = result.accounts || [];
      if (accountsArray.length === 0) {
        throw new Error('No account returned from Porto');
      }

      // Get the address string from the first account
      const address = accountsArray[0].address;
      console.log('[Berth:Popup] Extracted address:', address);

      return {
        address,
        accounts: accountsArray.map((acc: any) => acc.address),
      };
    } catch (error: any) {
      console.error('[Berth:Popup] Account connection failed:', error);
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
      console.error('[Berth:Popup] Failed to get accounts:', error);
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
      console.log('[Berth:Popup] Account already authorized:', address);
      return true;
    }

    console.log('[Berth:Popup] Account not authorized, connecting:', address);

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
      console.error('[Berth:Popup] Failed to authorize account:', error);
      return false;
    }
  }

  /**
   * Submit a wallet_sendCalls bundle and return the bundleId immediately.
   * Use this for popup-internal sends where useTransactionWatcher will do
   * the status polling — avoids duplicating the poll here.
   */
  async sendCalls(params: {
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

    const isAuthorized = await this.ensureAccountAuthorized(params.from);
    if (!isAuthorized) {
      throw new Error('Account not authorized. Please reconnect the account.');
    }

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
        from: params.from,
        ...(params.feeToken && {
          capabilities: {
            feeToken: params.feeToken,
          },
        }),
      }],
    });

    const bundleId = typeof result === 'string' ? result : result?.id || result;
    console.log('[Berth:Popup] wallet_sendCalls bundleId:', bundleId);
    return bundleId;
  }

  /**
   * Raw wallet_sendCalls pass-through. Used by the dApp-facing
   * TransactionApproval flow, which needs to forward the dApp's original
   * calls array + capabilities (multi-call, merchant fee-token pin, etc.)
   * rather than the single-call shape `sendCalls` constructs.
   *
   * Prefer `sendCalls` for popup-internal sends.
   */
  async sendCallsRaw(rawParams: any): Promise<string> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }
    const result = await this.provider.request({
      method: 'wallet_sendCalls',
      params: [rawParams],
    });
    const bundleId = typeof result === 'string' ? result : result?.id || result;
    return bundleId;
  }

  /**
   * Submit a transaction and wait for the actual tx hash.
   * Only the dApp-facing legacy `eth_sendTransaction` path needs this — dApps
   * expect a hash they can feed into `eth_getTransactionReceipt`. Everything
   * else should prefer `sendCalls` and let useTransactionWatcher poll.
   */
  async sendTransaction(params: {
    from: string;
    to: string;
    value?: string;
    data?: string;
    chainId: number;
    feeToken?: string;
  }): Promise<string> {
    const bundleId = await this.sendCalls(params);
    const txHash = await this.waitForTransactionHash(bundleId);
    console.log('[Berth:Popup] sendTransaction resolved to tx hash:', txHash);
    return txHash;
  }

  /**
   * Wait for the actual transaction hash from a bundle ID
   * Polls wallet_getCallsStatus until we get the transaction hash
   */
  private async waitForTransactionHash(bundleId: string, maxAttempts = 30, intervalMs = 2000): Promise<string> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[Berth:Popup] Waiting for transaction hash for bundle:', bundleId);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await this.provider.request({
          method: 'wallet_getCallsStatus',
          params: [bundleId],
        });

        console.log('[Berth:Popup] Bundle status:', status);

        // Check if we have receipts with transaction hash
        if (status?.receipts && status.receipts.length > 0) {
          const receipt = status.receipts[0];
          if (receipt?.transactionHash) {
            return receipt.transactionHash;
          }
        }

        // Porto returns numeric status codes (EIP-5792 1xx/2xx/3xx/4xx/5xx).
        // Confirmed without receipt → return bundleId as best identifier.
        if (status?.status === 200 && (!status.receipts || status.receipts.length === 0)) {
          return bundleId;
        }

        // Terminal failure (3xx offchain / 4xx-5xx onchain revert): reject
        // the dApp promise instead of silently returning the bundleId as if
        // it were a successful tx hash.
        if (typeof status?.status === 'number' && isPortoStatusFailed(status.status)) {
          throw new ProviderRpcError(
            RPC_ERROR_CODES.INTERNAL,
            `Transaction ${portoStatusToString(status.status)} (status ${status.status})`,
            { bundleId, status: status.status }
          );
        }

        // Pending (1xx): wait and retry.
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (error) {
        // Don't swallow our own terminal-failure rejection.
        if (error instanceof ProviderRpcError) throw error;
        console.warn('[Berth:Popup] Error getting bundle status:', error);
        // Transient RPC error: wait and retry.
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    // If we couldn't get the tx hash, return the bundle ID as fallback
    console.warn('[Berth:Popup] Could not get tx hash, returning bundle ID:', bundleId);
    return bundleId;
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

    console.log('[Berth:Popup] Signing message...');

    try {
      // personal_sign params are [message, account]
      const signature = await this.provider.request({
        method: 'personal_sign',
        params: [message, account],
      });

      console.log('[Berth:Popup] Message signed successfully');
      return signature;
    } catch (error: any) {
      console.error('[Berth:Popup] Message signing failed:', error);
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

    console.log('[Berth:Popup] Signing typed data...');

    try {
      // eth_signTypedData_v4 params are [account, typedDataJson]
      const typedDataJson = typeof typedData === 'string' ? typedData : JSON.stringify(typedData);

      const signature = await this.provider.request({
        method: 'eth_signTypedData_v4',
        params: [account, typedDataJson],
      });

      console.log('[Berth:Popup] Typed data signed successfully');
      return signature;
    } catch (error: any) {
      console.error('[Berth:Popup] Typed data signing failed:', error);
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

    console.log('[Berth:Popup] Getting calls history for:', address);

    try {
      const history = await this.provider.request({
        method: 'wallet_getCallsHistory',
        params: [{
          address,
          limit: 50,
          sort: 'desc',
        }],
      });

      console.log('[Berth:Popup] Calls history retrieved:', history?.length || 0, 'entries');
      return history || [];
    } catch (error: any) {
      console.error('[Berth:Popup] Failed to get calls history:', error);
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

    console.log('[Berth:Popup] Getting calls status for bundle:', bundleId);

    try {
      const status = await this.provider.request({
        method: 'wallet_getCallsStatus',
        params: [bundleId],
      });

      console.log('[Berth:Popup] Calls status:', status);
      return status;
    } catch (error: any) {
      console.error('[Berth:Popup] Failed to get calls status:', error);
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

    console.log('[Berth:Popup] Getting assets for:', address, 'chains:', chainIds);

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

      console.log('[Berth:Popup] Assets retrieved:', assets);
      return assets || {};
    } catch (error: any) {
      console.error('[Berth:Popup] Failed to get assets:', error);
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

    console.log('[Berth:Popup] Getting capabilities for chain:', chainIdHex);

    try {
      const capabilities = await this.provider.request({
        method: 'wallet_getCapabilities',
        params: [undefined, [chainIdHex]],
      });

      console.log('[Berth:Popup] Capabilities retrieved:', capabilities);
      return capabilities[chainIdHex] || null;
    } catch (error: any) {
      console.error('[Berth:Popup] Failed to get capabilities:', error);
      return null;
    }
  }

  /**
   * Disconnect from Porto SDK (wallet_disconnect)
   * Should be called before deleting account from local storage
   */
  async disconnect(): Promise<void> {
    if (!this.provider) {
      console.warn('[Berth:Popup] Provider not initialized, skipping disconnect');
      return;
    }

    console.log('[Berth:Popup] Disconnecting from Porto...');

    try {
      await this.provider.request({
        method: 'wallet_disconnect',
      });
      console.log('[Berth:Popup] Successfully disconnected from Porto');
    } catch (error: any) {
      // Log but don't throw - local deletion should still proceed
      console.error('[Berth:Popup] Disconnect error:', error);
    }
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized && !!this.provider;
  }

  // ==================== PERMISSION METHODS ====================

  /**
   * Grant session key permissions (wallet_grantPermissions)
   */
  async grantPermissions(params: {
    address: string;
    permissions: PermissionRequest;
  }): Promise<GrantedPermission> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[Berth:Popup] Granting permissions:', JSON.stringify(params, null, 2));

    // Porto's schema (key.ts:50) requires `feeToken.limit`; there's no safe
    // default (limit 0 = the session key can pay no fees), so the caller
    // (dApp or manual grant UI) must supply it explicitly.
    if (!params.permissions.feeToken?.limit) {
      throw new Error('feeToken.limit is required for wallet_grantPermissions');
    }

    try {
      const permissionParams: any = {
        expiry: params.permissions.expiry,
        permissions: params.permissions.permissions,
        feeToken: params.permissions.feeToken,
      };
      if (params.permissions.key) {
        permissionParams.key = params.permissions.key;
      }

      const result = await this.provider.request({
        method: 'wallet_grantPermissions',
        params: [permissionParams],
      });

      console.log('[Berth:Popup] Permissions granted:', result);
      return result;
    } catch (error: any) {
      console.error('[Berth:Popup] Failed to grant permissions:', error);
      throw error;
    }
  }

  /**
   * Get active permissions for an account (wallet_getPermissions)
   */
  async getPermissions(address: string): Promise<Permission[]> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[Berth:Popup] Getting permissions for:', address);

    try {
      const result = await this.provider.request({
        method: 'wallet_getPermissions',
        params: [{ address }],
      });

      console.log('[Berth:Popup] Permissions retrieved:', result);
      return result || [];
    } catch (error: any) {
      // Unauthorized errors are expected when account not connected - log as info
      if (error?.name?.includes('Unauthorized') || error?.message?.includes('Unauthorized')) {
        console.log('[Berth:Popup] Permissions unavailable - account not connected');
      } else {
        console.error('[Berth:Popup] Failed to get permissions:', error);
      }
      throw error;
    }
  }

  /**
   * Revoke a permission (wallet_revokePermissions)
   */
  async revokePermissions(permissionId: string): Promise<void> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[Berth:Popup] Revoking permission:', permissionId);

    try {
      await this.provider.request({
        method: 'wallet_revokePermissions',
        params: [{ id: permissionId }],
      });

      console.log('[Berth:Popup] Permission revoked');
    } catch (error: any) {
      console.error('[Berth:Popup] Failed to revoke permission:', error);
      throw error;
    }
  }

  /**
   * Get authorized keys for an account (wallet_getKeys)
   */
  async getKeys(address: string): Promise<AccountKey[]> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[Berth:Popup] Getting keys for:', address);

    try {
      const result = await this.provider.request({
        method: 'wallet_getKeys',
        params: [{ address }],
      });

      console.log('[Berth:Popup] Keys retrieved:', result);
      return result || [];
    } catch (error: any) {
      // Unauthorized errors are expected when account not connected - log as info
      if (error?.name?.includes('Unauthorized') || error?.message?.includes('Unauthorized')) {
        console.log('[Berth:Popup] Keys unavailable - account not connected');
      } else {
        console.error('[Berth:Popup] Failed to get keys:', error);
      }
      throw error;
    }
  }

  /**
   * Check relay health status (health)
   */
  async getRelayHealth(): Promise<RelayHealth> {
    if (!this.provider) {
      throw new Error('Porto provider not initialized');
    }

    console.log('[Berth:Popup] Checking relay health...');

    try {
      const startTime = Date.now();
      const result = await this.provider.request({
        method: 'health',
        params: [],
      });
      const latency = Date.now() - startTime;

      // Log the raw response to understand its structure
      console.log('[Berth:Popup] Relay health raw result:', JSON.stringify(result, null, 2));
      console.log('[Berth:Popup] Relay health latency:', latency);

      // Extract version from result (Porto returns { version: "..." } or similar)
      const version = typeof result === 'object' && result !== null
        ? (result.version || result.Version || JSON.stringify(result))
        : String(result);

      // Don't spread result - it might override our status!
      return {
        status: 'online',
        latency,
        version,
      };
    } catch (error: any) {
      console.error('[Berth:Popup] Relay health check failed:', error);
      return {
        status: 'offline',
        latency: null,
        error: error.message,
      };
    }
  }
}

// Singleton instance
export const popupPortoService = new PopupPortoService();
