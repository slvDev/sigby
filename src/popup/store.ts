/**
 * Zustand Store for Popup State Management
 * Manages multi-account client-side state for popup UI
 */

import { create } from "zustand";
import { DEFAULT_CHAIN_ID } from "../utils/constants";
import { popupPortoService } from "./portoService";
import type { PortoAsset, Permission, AccountKey, RelayHealth } from "../types/porto";

/**
 * Account state (simplified for UI)
 */
interface AccountState {
  address: string;
  displayName: string;
  balance: string;
  accountIndex?: number;
}

/**
 * Balance cache entry
 */
interface BalanceCacheEntry {
  balance: string;
  timestamp: number;
}

/**
 * Pending transaction being watched for confirmation
 */
interface PendingTransaction {
  id: string;        // Bundle ID from wallet_sendCalls
  chainId: number;
  timestamp: number;
}

/**
 * Per-chain balance cache with TTL (30 seconds)
 * Key format: `${address}:${chainId}`
 */
const BALANCE_CACHE_TTL = 30_000;
const balanceCache = new Map<string, BalanceCacheEntry>();

/**
 * Generate cache key for per-chain balance
 */
function getBalanceCacheKey(address: string, chainId: number): string {
  return `${address}:${chainId}`;
}

/**
 * Wallet state interface with multi-account support
 */
interface WalletState {
  // Multi-account state
  accounts: Record<string, AccountState>;
  accountOrder: string[];
  activeAddress: string | null;

  // Network state
  chainId: number;

  // Asset state (from wallet_getAssets)
  assets: PortoAsset[];
  assetsLoading: boolean;
  assetsLastFetched: number | null;

  // Pending transactions being watched
  pendingTransactions: PendingTransaction[];

  // History refresh trigger (incremented when tx confirmed to trigger refetch)
  historyRefreshTrigger: number;

  // Permissions state
  permissions: Permission[];
  permissionsLoading: boolean;
  permissionsNeedAuth: boolean;

  // Keys state
  accountKeys: AccountKey[];
  keysLoading: boolean;
  keysNeedAuth: boolean;

  // Relay health
  relayHealth: RelayHealth | null;
  relayHealthLoading: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;
  isAccountSwitcherOpen: boolean;
  showTestnets: boolean;

  // Connection state
  isAuthenticated: boolean;

  // Legacy single-account (for backward compatibility)
  account: AccountState | null;

  // Account actions
  setAccounts: (accounts: Record<string, AccountState>) => void;
  setAccountOrder: (order: string[]) => void;
  setActiveAddress: (address: string | null) => void;
  addAccount: (account: AccountState) => void;
  updateAccount: (address: string, updates: Partial<AccountState>) => void;
  removeAccount: (address: string) => void;

  // Asset actions
  setAssets: (assets: PortoAsset[]) => void;
  setAssetsLoading: (loading: boolean) => void;
  refreshAssets: (force?: boolean) => Promise<void>;

  // Pending transaction actions
  addPendingTransaction: (tx: PendingTransaction) => void;
  removePendingTransaction: (id: string) => void;
  clearPendingTransactions: () => void;
  triggerHistoryRefresh: () => void;

  // Permission/Keys/Health actions
  fetchPermissions: () => Promise<void>;
  fetchKeys: () => Promise<void>;
  fetchRelayHealth: () => Promise<void>;
  connectActiveAccount: () => Promise<boolean>;

  // UI actions
  setChainId: (chainId: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setAccountSwitcherOpen: (isOpen: boolean) => void;
  setShowTestnets: (show: boolean) => void;

  // Utility actions
  reset: () => void;

  // Legacy compatibility
  setAccount: (account: AccountState | null) => void;
}

/**
 * Initial state
 */
const initialState = {
  // Multi-account
  accounts: {} as Record<string, AccountState>,
  accountOrder: [] as string[],
  activeAddress: null as string | null,

  // Network - selected chain for popup UI
  chainId: DEFAULT_CHAIN_ID,

  // Assets (from wallet_getAssets)
  assets: [] as PortoAsset[],
  assetsLoading: false,
  assetsLastFetched: null as number | null,

  // Pending transactions
  pendingTransactions: [] as PendingTransaction[],

  // History refresh trigger
  historyRefreshTrigger: 0,

  // Permissions
  permissions: [] as Permission[],
  permissionsLoading: false,
  permissionsNeedAuth: false,

  // Keys
  accountKeys: [] as AccountKey[],
  keysLoading: false,
  keysNeedAuth: false,

  // Relay health
  relayHealth: null as RelayHealth | null,
  relayHealthLoading: false,

  // UI
  isLoading: false,
  error: null as string | null,
  isAccountSwitcherOpen: false,
  showTestnets: true, // Visible by default per user preference

  // Connection
  isAuthenticated: false,

  // Legacy
  account: null as AccountState | null,
};

/**
 * Wallet store with multi-account support
 * Use this hook in React components: const { accounts, activeAddress } = useWalletStore()
 */
export const useWalletStore = create<WalletState>((set, get) => ({
  ...initialState,

  // ==================== ACCOUNT ACTIONS ====================

  setAccounts: (accounts) => set({ accounts }),

  setAccountOrder: (accountOrder) => set({ accountOrder }),

  setActiveAddress: (activeAddress) => {
    const { accounts } = get();
    set({
      activeAddress,
      // Update legacy account for backward compatibility
      account: activeAddress ? accounts[activeAddress] || null : null,
      // Reset caches when switching accounts
      assets: [],
      assetsLastFetched: null,
      // Clear permissions and keys - they're per-account
      permissions: [],
      accountKeys: [],
      // Reset auth flags
      permissionsNeedAuth: false,
      keysNeedAuth: false,
    });
  },

  addAccount: (account) =>
    set((state) => ({
      accounts: { ...state.accounts, [account.address]: account },
      accountOrder: state.accountOrder.includes(account.address)
        ? state.accountOrder
        : [...state.accountOrder, account.address],
    })),

  updateAccount: (address, updates) =>
    set((state) => {
      if (!state.accounts[address]) return state;
      const updatedAccount = { ...state.accounts[address], ...updates };
      return {
        accounts: { ...state.accounts, [address]: updatedAccount },
        // Update legacy account if it's the active one
        account:
          state.activeAddress === address ? updatedAccount : state.account,
      };
    }),

  removeAccount: (address) =>
    set((state) => {
      const { [address]: removed, ...rest } = state.accounts;
      const newOrder = state.accountOrder.filter((a) => a !== address);
      const newActiveAddress =
        state.activeAddress === address ? newOrder[0] || null : state.activeAddress;

      return {
        accounts: rest,
        accountOrder: newOrder,
        activeAddress: newActiveAddress,
        account: newActiveAddress ? rest[newActiveAddress] || null : null,
        isAuthenticated: newOrder.length > 0,
      };
    }),

  // ==================== ASSET ACTIONS ====================

  setAssets: (assets) => set({ assets }),

  setAssetsLoading: (assetsLoading) => set({ assetsLoading }),

  refreshAssets: async (force = false) => {
    const { activeAddress, chainId, assetsLastFetched, assetsLoading } = get();
    if (!activeAddress) return;

    // Skip if already loading
    if (assetsLoading) return;

    // Skip if data is fresh (less than 30 seconds old) unless forced
    const ASSETS_CACHE_TTL = 30_000;
    if (!force && assetsLastFetched && Date.now() - assetsLastFetched < ASSETS_CACHE_TTL) {
      return;
    }

    set({ assetsLoading: true });

    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }

      const allAssets = await popupPortoService.getAssets(activeAddress, [chainId]);
      const chainKeyHex = `0x${chainId.toString(16)}`;
      const assets = allAssets[chainKeyHex] || [];

      // Extract native balance and update account
      const nativeAsset = assets.find((a: PortoAsset) => a.type === 'native');
      if (nativeAsset) {
        const balanceWei = BigInt(nativeAsset.balance);
        const balanceEth = (Number(balanceWei) / 1e18).toFixed(7);
        get().updateAccount(activeAddress, { balance: balanceEth });
      }

      set({
        assets,
        assetsLastFetched: Date.now(),
        assetsLoading: false,
      });
    } catch (error) {
      console.error('[Store] Failed to refresh assets:', error);
      set({ assetsLoading: false });
    }
  },

  // ==================== PENDING TRANSACTION ACTIONS ====================

  addPendingTransaction: (tx) =>
    set((state) => ({
      pendingTransactions: [...state.pendingTransactions, tx],
    })),

  removePendingTransaction: (id) =>
    set((state) => ({
      pendingTransactions: state.pendingTransactions.filter((tx) => tx.id !== id),
    })),

  clearPendingTransactions: () => set({ pendingTransactions: [] }),

  triggerHistoryRefresh: () =>
    set((state) => ({ historyRefreshTrigger: state.historyRefreshTrigger + 1 })),

  // ==================== PERMISSION/KEYS/HEALTH ACTIONS ====================

  fetchPermissions: async () => {
    const { activeAddress } = get();
    if (!activeAddress) return;

    set({ permissionsLoading: true, permissionsNeedAuth: false });
    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }

      // wallet_getPermissions is an SDK method that may fail if account not connected
      // We handle errors gracefully - no auth prompt needed for viewing
      const permissions = await popupPortoService.getPermissions(activeAddress);
      set({ permissions, permissionsLoading: false, permissionsNeedAuth: false });
    } catch (error: any) {
      // Handle unauthorized errors - set flag so UI can show connect button
      // Porto SDK may throw if account not "connected" but we don't want to force auth
      if (error?.message?.includes('Unauthorized') || error?.name?.includes('Unauthorized')) {
        console.log('[Store] Account not connected in Porto SDK - permissions unavailable');
        set({ permissions: [], permissionsLoading: false, permissionsNeedAuth: true });
        return;
      }
      console.error('[Store] Failed to fetch permissions:', error);
      set({ permissions: [], permissionsLoading: false });
    }
  },

  fetchKeys: async () => {
    const { activeAddress } = get();
    if (!activeAddress) return;

    set({ keysLoading: true, keysNeedAuth: false });
    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }

      // wallet_getKeys is a Relay method - it queries the blockchain directly
      // No auth needed, just an address parameter
      const accountKeys = await popupPortoService.getKeys(activeAddress);
      set({ accountKeys, keysLoading: false, keysNeedAuth: false });
    } catch (error: any) {
      // Handle errors gracefully - set flag so UI can show connect button
      if (error?.message?.includes('Unauthorized') || error?.name?.includes('Unauthorized')) {
        console.log('[Store] Keys query failed - may need account connection');
        set({ accountKeys: [], keysLoading: false, keysNeedAuth: true });
        return;
      }
      console.error('[Store] Failed to fetch keys:', error);
      set({ accountKeys: [], keysLoading: false });
    }
  },

  fetchRelayHealth: async () => {
    set({ relayHealthLoading: true });
    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }
      const relayHealth = await popupPortoService.getRelayHealth();
      set({ relayHealth, relayHealthLoading: false });
    } catch (error) {
      console.error('[Store] Failed to fetch relay health:', error);
      set({
        relayHealth: { status: 'offline', latency: null },
        relayHealthLoading: false
      });
    }
  },

  connectActiveAccount: async () => {
    const { activeAddress, fetchPermissions, fetchKeys } = get();
    if (!activeAddress) return false;

    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }

      // This triggers WebAuthn to connect the account
      const isConnected = await popupPortoService.ensureAccountAuthorized(activeAddress);

      if (isConnected) {
        // Refetch permissions and keys now that we're connected
        await fetchPermissions();
        await fetchKeys();
      }

      return isConnected;
    } catch (error) {
      console.error('[Store] Failed to connect account:', error);
      return false;
    }
  },

  // ==================== UI ACTIONS ====================

  setChainId: (chainId) => set({ chainId, assets: [], assetsLastFetched: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  setAccountSwitcherOpen: (isAccountSwitcherOpen) => set({ isAccountSwitcherOpen }),

  setShowTestnets: (showTestnets) => set({ showTestnets }),

  // ==================== UTILITY ACTIONS ====================

  reset: () => set(initialState),

  // Legacy compatibility
  setAccount: (account) => set({ account }),
}));

/**
 * Background state response type
 */
interface BackgroundStateResponse {
  accounts?: Record<string, {
    address: string;
    displayName?: string;
    accountIndex?: number;
  }>;
  accountOrder?: string[];
  activeAddress?: string | null;
  isAuthenticated?: boolean;
  chainId?: number;
  accountCount?: number;
}

/**
 * Helper to sync store with background state (multi-account aware)
 * Call this when popup opens
 */
export async function syncStoreWithBackground(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_STATE",
    });

    if (response.success && response.data) {
      const data = response.data as BackgroundStateResponse;
      const {
        accounts,
        accountOrder,
        activeAddress,
        isAuthenticated,
        chainId,
      } = data;

      // Convert accounts to UI format with balance placeholder
      const accountsWithBalance: Record<string, AccountState> = {};
      if (accounts) {
        for (const [addr, acc] of Object.entries(accounts)) {
          accountsWithBalance[addr] = {
            address: acc.address,
            displayName: acc.displayName || "Account",
            balance: "0", // Will be fetched separately
            accountIndex: acc.accountIndex,
          };
        }
      }

      // Get active account for UI
      const activeAccount = activeAddress ? accountsWithBalance[activeAddress] : null;

      // Check if active address changed - need to reset assets cache
      const currentState = useWalletStore.getState();
      const addressChanged = currentState.activeAddress !== activeAddress;
      const chainChanged = currentState.chainId !== (chainId || DEFAULT_CHAIN_ID);

      useWalletStore.setState({
        // Multi-account state
        accounts: accountsWithBalance,
        accountOrder: accountOrder || [],
        activeAddress: activeAddress || null,

        // Legacy single-account (for backward compatibility)
        account: activeAccount,

        // Connection state
        isAuthenticated: isAuthenticated || false,
        chainId: chainId || DEFAULT_CHAIN_ID,
        error: null,

        // Reset assets cache if address or chain changed
        ...(addressChanged || chainChanged ? { assets: [], assetsLastFetched: null } : {}),
      });
    }
  } catch (error) {
    console.error("[Store] Failed to sync with background:", error);
    // Reset to safe initial state on sync failure
    useWalletStore.setState({
      accounts: {},
      accountOrder: [],
      activeAddress: null,
      account: null,
      isAuthenticated: false,
      isLoading: false,
      error: "Failed to connect to wallet. Please try again.",
    });
  }
}

/**
 * Get ordered accounts array (computed helper)
 */
export function getOrderedAccounts(): AccountState[] {
  const { accounts, accountOrder } = useWalletStore.getState();
  return accountOrder
    .map((addr) => accounts[addr])
    .filter(Boolean);
}

/**
 * Get active account (computed helper)
 */
export function getActiveAccount(): AccountState | null {
  const { accounts, activeAddress } = useWalletStore.getState();
  return activeAddress ? accounts[activeAddress] || null : null;
}

/**
 * Fetch balance with stale-while-revalidate caching
 * Returns cached value immediately while fetching fresh data
 * @param address - Account address
 * @param chainId - Chain ID (defaults to store's current chainId)
 * @param forceRefresh - Force refresh even if cached
 */
export async function fetchBalanceWithCache(
  address: string,
  chainId?: number,
  forceRefresh = false
): Promise<string> {
  const store = useWalletStore.getState();
  const effectiveChainId = chainId ?? store.chainId;
  const cacheKey = getBalanceCacheKey(address, effectiveChainId);

  const now = Date.now();
  const cached = balanceCache.get(cacheKey);

  // Return cached value if fresh (and not forcing refresh)
  if (cached && !forceRefresh && now - cached.timestamp < BALANCE_CACHE_TTL) {
    return cached.balance;
  }

  // If we have a stale cached value, update UI immediately and fetch in background
  if (cached && !forceRefresh) {
    // Update store with cached value immediately
    store.updateAccount(address, { balance: cached.balance });

    // Fetch fresh data in background (don't await)
    fetchAndUpdateBalance(address, effectiveChainId).catch(console.error);

    return cached.balance;
  }

  // No cache or forced refresh - fetch and wait
  return fetchAndUpdateBalance(address, effectiveChainId);
}

// Track in-flight balance requests to prevent race conditions
const balanceFetchPromises = new Map<string, Promise<string>>();

/**
 * Internal: Fetch balance from RPC and update cache/store
 * @param address - Account address
 * @param chainId - Chain ID to fetch balance for
 */
async function fetchAndUpdateBalance(address: string, chainId: number): Promise<string> {
  const cacheKey = getBalanceCacheKey(address, chainId);

  // Check if there's already a fetch in progress for this address+chain
  const existingPromise = balanceFetchPromises.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const fetchPromise = (async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "DAPP_REQUEST",
        payload: {
          method: "eth_getBalance",
          params: [address, "latest"],
          origin: "popup://porto-wallet",
          chainId,
        },
      });

      if (response.success && response.data) {
        const balanceWei = BigInt(response.data);
        const balanceEth = (Number(balanceWei) / 1e18).toFixed(7);

        // Update cache with chain-specific key
        balanceCache.set(cacheKey, {
          balance: balanceEth,
          timestamp: Date.now(),
        });

        // Update store with the balance for the currently selected chain
        const store = useWalletStore.getState();
        if (chainId === store.chainId) {
          store.updateAccount(address, { balance: balanceEth });
        }

        return balanceEth;
      }
    } catch (error) {
      console.error("[Store] Failed to fetch balance:", error);
    } finally {
      // Clean up the in-flight promise
      balanceFetchPromises.delete(cacheKey);
    }

    return "0";
  })();

  balanceFetchPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch balances for all accounts on current chain
 * @param chainId - Optional chain ID (defaults to store's current chainId)
 */
export async function fetchAllBalances(chainId?: number): Promise<void> {
  const store = useWalletStore.getState();
  const effectiveChainId = chainId ?? store.chainId;

  // Fetch all balances in parallel
  await Promise.all(
    store.accountOrder.map((address) =>
      fetchBalanceWithCache(address, effectiveChainId, true)
    )
  );
}

/**
 * Clear balance cache
 * @param address - Optional address to clear (clears all chains for this address)
 * @param chainId - Optional chain ID to clear (requires address)
 */
export function clearBalanceCache(address?: string, chainId?: number): void {
  if (address && chainId !== undefined) {
    // Clear specific address + chain
    balanceCache.delete(getBalanceCacheKey(address, chainId));
  } else if (address) {
    // Clear all chains for this address
    for (const key of balanceCache.keys()) {
      if (key.startsWith(`${address}:`)) {
        balanceCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    balanceCache.clear();
  }
}
