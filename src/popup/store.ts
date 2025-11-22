/**
 * Zustand Store for Popup State Management
 * Manages client-side state for popup UI
 */

import { create } from "zustand";
import type { Account } from "../types/account";

/**
 * Wallet state interface
 */
interface WalletState {
  // Account state
  account: {
    address: string;
    balance: string;
    displayName?: string;
  } | null;

  // Network state
  chainId: number;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Connection state
  isAuthenticated: boolean;

  // Actions
  setAccount: (account: WalletState["account"]) => void;
  setChainId: (chainId: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  reset: () => void;
}

/**
 * Initial state
 */
const initialState = {
  account: null,
  chainId: 8453, // Base
  isLoading: false,
  error: null,
  isAuthenticated: false,
};

/**
 * Wallet store
 * Use this hook in React components: const { account } = useWalletStore()
 */
export const useWalletStore = create<WalletState>((set) => ({
  ...initialState,

  // Actions
  setAccount: (account) => set({ account }),

  setChainId: (chainId) => set({ chainId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  reset: () => set(initialState),
}));

/**
 * Helper to sync store with background state
 * Call this when popup opens
 */
export async function syncStoreWithBackground(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_STATE",
    });

    if (response.success) {
      const { account, isAuthenticated, chainId } = response.data;

      useWalletStore.setState({
        account: account
          ? {
              address: account.address,
              balance: "0", // Will be fetched separately
              displayName: account.displayName,
            }
          : null,
        isAuthenticated,
        chainId: chainId || 8453,
        error: null,
      });
    }
  } catch (error) {
    console.error("[Store] Failed to sync with background:", error);
    useWalletStore.setState({
      error: "Failed to connect to wallet",
    });
  }
}
