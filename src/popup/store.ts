/**
 * Zustand Store for Popup State Management
 * Manages multi-account client-side state for popup UI
 */

import { create } from "zustand";

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
 * Balance cache with TTL (30 seconds)
 */
const BALANCE_CACHE_TTL = 30_000;
const balanceCache = new Map<string, BalanceCacheEntry>();

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

  // UI state
  isLoading: boolean;
  error: string | null;
  isAccountSwitcherOpen: boolean;

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

  // UI actions
  setChainId: (chainId: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setAccountSwitcherOpen: (isOpen: boolean) => void;

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

  // Network
  chainId: 8453, // Base

  // UI
  isLoading: false,
  error: null as string | null,
  isAccountSwitcherOpen: false,

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

  // ==================== UI ACTIONS ====================

  setChainId: (chainId) => set({ chainId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  setAccountSwitcherOpen: (isAccountSwitcherOpen) => set({ isAccountSwitcherOpen }),

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

      useWalletStore.setState({
        // Multi-account state
        accounts: accountsWithBalance,
        accountOrder: accountOrder || [],
        activeAddress: activeAddress || null,

        // Legacy single-account (for backward compatibility)
        account: activeAccount,

        // Connection state
        isAuthenticated: isAuthenticated || false,
        chainId: chainId || 8453,
        error: null,
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
 */
export async function fetchBalanceWithCache(
  address: string,
  forceRefresh = false
): Promise<string> {
  const now = Date.now();
  const cached = balanceCache.get(address);
  const store = useWalletStore.getState();

  // Return cached value if fresh (and not forcing refresh)
  if (cached && !forceRefresh && now - cached.timestamp < BALANCE_CACHE_TTL) {
    return cached.balance;
  }

  // If we have a stale cached value, update UI immediately and fetch in background
  if (cached && !forceRefresh) {
    // Update store with cached value immediately
    store.updateAccount(address, { balance: cached.balance });

    // Fetch fresh data in background (don't await)
    fetchAndUpdateBalance(address).catch(console.error);

    return cached.balance;
  }

  // No cache or forced refresh - fetch and wait
  return fetchAndUpdateBalance(address);
}

// Track in-flight balance requests to prevent race conditions
const balanceFetchPromises = new Map<string, Promise<string>>();

/**
 * Internal: Fetch balance from RPC and update cache/store
 */
async function fetchAndUpdateBalance(address: string): Promise<string> {
  // Check if there's already a fetch in progress for this address
  const existingPromise = balanceFetchPromises.get(address);
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
        },
      });

      if (response.success && response.data) {
        const balanceWei = BigInt(response.data);
        const balanceEth = (Number(balanceWei) / 1e18).toFixed(4);

        // Update cache
        balanceCache.set(address, {
          balance: balanceEth,
          timestamp: Date.now(),
        });

        // Update store
        useWalletStore.getState().updateAccount(address, { balance: balanceEth });

        return balanceEth;
      }
    } catch (error) {
      console.error("[Store] Failed to fetch balance:", error);
    } finally {
      // Clean up the in-flight promise
      balanceFetchPromises.delete(address);
    }

    return "0";
  })();

  balanceFetchPromises.set(address, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch balances for all accounts
 */
export async function fetchAllBalances(): Promise<void> {
  const { accountOrder } = useWalletStore.getState();

  // Fetch all balances in parallel
  await Promise.all(
    accountOrder.map((address) => fetchBalanceWithCache(address, true))
  );
}

/**
 * Clear balance cache (call on account removal)
 */
export function clearBalanceCache(address?: string): void {
  if (address) {
    balanceCache.delete(address);
  } else {
    balanceCache.clear();
  }
}
