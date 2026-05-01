/**
 * Zustand Store for Popup State Management
 * Manages multi-account client-side state for popup UI
 */

import { create } from "zustand";
import { DEFAULT_CHAIN_ID, SESSION_STORAGE_KEYS } from "../utils/constants";
import { popupPortoService } from "./portoService";
import { passkeyBeat } from "./styles/signatureMotion";
import type { PortoAsset, Permission, AccountKey, RelayHealth } from "../types/porto";

/**
 * One-beat celebration signals. Views subscribe to the timestamp of
 * the latest fire per kind and animate once per advance. Currently
 * one kind: `passkey-success`, emitted after a biometric-gated action
 * (create/connect account, sign message, approve transaction) resolves.
 */
export type CelebrationKind = "passkey-success";

/**
 * Auto-lock timeout options. Numbers are minutes; `"never"` disables
 * the idle timer (manual lock + browser-restart lock still apply).
 */
export type AutoLockMinutes = number | "never";

const SESSION_UNLOCK_KEY = SESSION_STORAGE_KEYS.LAST_UNLOCKED_AT;

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
  /**
   * Timestamp of the last confirmed chain commit. Fires once per
   * successful `SWITCH_CHAIN` reply. Views key signature motion
   * (HeroCard orb pulse) on this timestamp — not on `chainId` itself —
   * so unrelated renders don't re-fire the beat.
   */
  chainCommittedAt: number | null;

  // Asset state (from wallet_getAssets)
  assets: PortoAsset[];
  assetsLoading: boolean;
  assetsLastFetched: number | null;
  /**
   * Timestamp of the most recent `refreshAssets` *completion*, set on
   * both success AND failure. `assetsLastFetched` only advances on
   * success and is also used for cache-freshness gating, so a failed
   * first fetch leaves it null forever — UX gates that need "have we
   * tried yet?" should read this instead.
   */
  assetsLastAttemptedAt: number | null;

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
  /** Timestamp the current error was set (for DismissibleError countdown persistence across tab switches). */
  errorAt: number | null;
  isAccountSwitcherOpen: boolean;
  showTestnets: boolean;

  // Connection state
  isAuthenticated: boolean;

  /**
   * Lock state — UX curtain, not a cryptographic boundary. When `false`
   * the popup renders a LockScreen instead of the normal routes; store
   * contents are still in memory, we just don't render pages that show
   * them. Toggling this flag is the ONLY thing the lock does — signing
   * still requires a fresh biometric via Porto regardless.
   */
  isUnlocked: boolean;
  /** Timestamp of last successful unlock, or null. */
  unlockedAt: number | null;
  /**
   * Idle timeout before auto-lock, in minutes. `"never"` means no idle
   * auto-lock (manual lock + browser-restart lock still apply). Cached
   * from background `settings.autoLockTimeout` on popup init.
   */
  autoLockMinutes: AutoLockMinutes;

  /**
   * Persisted welcome-flow completion flag. Mirrors
   * `settings.hasCompletedOnboarding`. Used to decide whether to start
   * the welcome flow on popup boot — once true, no future boot turns
   * `isOnboardingActive` back on.
   */
  hasCompletedOnboarding: boolean;
  /**
   * In-memory gate for the 4-screen welcome flow. Set true on popup
   * boot when `!hasCompletedOnboarding && accountOrder.length === 0`.
   * Cleared when the user dismisses Step 4. Decoupled from
   * `hasCompletedOnboarding` and `accountOrder` so the success
   * transition (account just created) doesn't tear down the flow
   * before "You're set" can render.
   */
  isOnboardingActive: boolean;

  /**
   * Per-kind timestamp of the latest celebration event (e.g. passkey
   * success beat). Views compare the last-seen timestamp to advance
   * their one-beat animations — never on value equality, always on
   * timestamp change.
   */
  celebrations: Partial<Record<CelebrationKind, number>>;

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
  /** Mark a chain commit as confirmed — fires the tide-shift beat. */
  markChainCommitted: () => void;
  /**
   * Fire a celebration beat synchronously. Views observing the
   * `celebrations[kind]` timestamp will mount a fresh keyframe run.
   */
  celebrate: (kind: CelebrationKind) => void;
  /**
   * Fire `celebrate(kind)` and return a promise that resolves after
   * `settleMs` (default: the beat's own perceived duration). Approval
   * hooks call this between the APPROVE background message and
   * `window.close()` so the beat gets frames to play before teardown.
   *
   * The isTrusted gate must still run BEFORE this — ordering is:
   *   isTrusted → biometric sign → approve message → awaitCelebration → close
   */
  awaitCelebration: (
    kind: CelebrationKind,
    opts?: { settleMs?: number }
  ) => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setAccountSwitcherOpen: (isOpen: boolean) => void;
  setShowTestnets: (show: boolean) => Promise<void>;

  // Lock actions
  /** Mark the wallet as unlocked and persist the timestamp to session storage. */
  unlock: () => void;
  /** Lock the wallet and clear the session timestamp. */
  lock: () => void;
  /**
   * Resolve lock state on popup open. Does a GET_SETTINGS roundtrip
   * to pick up the persisted `autoLockTimeout`, then reads the session
   * timestamp to decide unlocked state. Call once on boot after
   * `syncStoreWithBackground`.
   */
  hydrateLockFromSession: () => Promise<void>;
  /**
   * Session-only refresh: re-reads `lastUnlockedAt` and re-derives
   * the lock state using the `autoLockMinutes` already in the store.
   * Skips GET_SETTINGS — so it can't race an in-flight
   * `setAutoLockMinutes` write. Use this from listeners on
   * `chrome.storage.session` changes.
   */
  refreshLockFromSession: () => Promise<void>;
  /** Update the idle timeout setting. Persists via background. */
  setAutoLockMinutes: (value: AutoLockMinutes) => Promise<void>;
  /**
   * Persist welcome-flow completion. Sets the cached flag and writes
   * `settings.hasCompletedOnboarding=true` via background. Idempotent.
   * Does NOT clear `isOnboardingActive` — Step 4 fires this on the
   * `passkey-success` celebrate beat (i.e. as soon as create/restore
   * succeeds), before the user sees the Done screen.
   */
  completeOnboarding: () => Promise<void>;
  /**
   * Clear the in-memory onboarding gate. Called when the user dismisses
   * Step 4 ("Open wallet" / Receive / Settings) so AuthGuard switches
   * to the normal layout. Persistence is handled separately.
   */
  dismissOnboarding: () => void;

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
  chainCommittedAt: null as number | null,

  // Assets (from wallet_getAssets)
  assets: [] as PortoAsset[],
  assetsLoading: false,
  assetsLastFetched: null as number | null,
  assetsLastAttemptedAt: null as number | null,

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
  errorAt: null as number | null,
  isAccountSwitcherOpen: false,
  // Default mirrors the persisted `showTestNetworks` storage default
  // (false). The real value is hydrated from GET_SETTINGS on popup
  // boot; starting `true` would briefly flash testnets in
  // ChainSwitcher before hydration lands.
  showTestnets: false,

  // Connection
  isAuthenticated: false,

  // Lock — start locked. `hydrateLockFromSession` unlocks if the
  // session timestamp is fresh. Onboarding path has zero accounts so
  // the gate doesn't render anyway.
  isUnlocked: false,
  unlockedAt: null as number | null,
  autoLockMinutes: 15 as AutoLockMinutes,
  hasCompletedOnboarding: false,
  isOnboardingActive: false,

  // Celebration timestamps
  celebrations: {} as Partial<Record<CelebrationKind, number>>,

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
      assetsLastAttemptedAt: null,
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

      const now = Date.now();
      set({
        assets,
        assetsLastFetched: now,
        assetsLastAttemptedAt: now,
        assetsLoading: false,
      });
    } catch (error) {
      console.error('[Store] Failed to refresh assets:', error);
      // Mark the attempt as completed even on failure so UX gates
      // ("have we tried yet?") don't hang on the loading state.
      set({ assetsLoading: false, assetsLastAttemptedAt: Date.now() });
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
    const { activeAddress, fetchPermissions, fetchKeys, unlock } = get();
    if (!activeAddress) return false;

    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }

      // Detect warm path: `ensureAccountAuthorized` short-circuits when
      // the account is already in Porto's IDB-persisted authorized
      // list — no biometric fires. Only the cold path (account not
      // yet authorized → wallet_connect → Touch ID) counts as
      // attention proof for extending the unlock session.
      const authorizedBefore = await popupPortoService.getAuthorizedAccounts();
      const wasAlreadyAuthorized = authorizedBefore.some(
        (a) => a.toLowerCase() === activeAddress.toLowerCase()
      );

      const isConnected = await popupPortoService.ensureAccountAuthorized(activeAddress);

      if (isConnected) {
        if (!wasAlreadyAuthorized) {
          // Cold path — biometric fired. Refresh the unlock session
          // so they don't get re-prompted on the next lock screen.
          unlock();
        }
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

  setChainId: (chainId) =>
    set({
      chainId,
      assets: [],
      assetsLastFetched: null,
      assetsLastAttemptedAt: null,
    }),

  markChainCommitted: () => set({ chainCommittedAt: Date.now() }),

  celebrate: (kind) =>
    set((state) => ({
      celebrations: { ...state.celebrations, [kind]: Date.now() },
    })),

  awaitCelebration: async (kind, opts) => {
    const settleMs = opts?.settleMs ?? passkeyBeat.settleMs;
    set((state) => ({
      celebrations: { ...state.celebrations, [kind]: Date.now() },
    }));
    await new Promise<void>((resolve) => setTimeout(resolve, settleMs));
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, errorAt: error ? Date.now() : null }),

  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  setAccountSwitcherOpen: (isAccountSwitcherOpen) => set({ isAccountSwitcherOpen }),

  setShowTestnets: async (show) => {
    // Optimistic + revert-on-failure, matching `setAutoLockMinutes`.
    // Without persistence the toggle would silently snap back when the
    // popup reopens and re-hydrates from storage.
    const prev = get().showTestnets;
    set({ showTestnets: show });
    try {
      const res = await chrome.runtime.sendMessage({
        type: "UPDATE_SETTINGS",
        payload: { showTestNetworks: show },
      });
      if (!res?.success) {
        set({ showTestnets: prev });
        console.warn("[Store] UPDATE_SETTINGS rejected:", res?.error);
      }
    } catch (err) {
      set({ showTestnets: prev });
      console.warn("[Store] Failed to persist showTestnets:", err);
    }
  },

  // ==================== LOCK ACTIONS ====================

  unlock: () => {
    const now = Date.now();
    set({ isUnlocked: true, unlockedAt: now });
    // sync try/catch doesn't see async rejections from chrome.storage
    // — attach .catch() so a rejected write actually surfaces in logs
    // instead of a silent UnhandledPromiseRejection.
    void chrome.storage.session
      .set({ [SESSION_UNLOCK_KEY]: now })
      .catch((err) => {
        console.warn("[Store] Failed to write unlock timestamp:", err);
      });
  },

  lock: () => {
    set({ isUnlocked: false, unlockedAt: null });
    void chrome.storage.session.remove(SESSION_UNLOCK_KEY).catch((err) => {
      console.warn("[Store] Failed to clear unlock timestamp:", err);
    });
  },

  hydrateLockFromSession: async () => {
    try {
      // Pull the persisted timeout first so the freshness check uses
      // the user's chosen window, not the initial-state default.
      try {
        const settingsRes = await chrome.runtime.sendMessage({
          type: "GET_SETTINGS",
        });
        if (settingsRes?.success && settingsRes.data) {
          const raw = settingsRes.data.autoLockTimeout;
          // Storage schema stores 0 to mean "never" (see setAutoLockMinutes).
          if (typeof raw === "number") {
            set({ autoLockMinutes: raw === 0 ? "never" : raw });
          }
          const storedCompleted = settingsRes.data.hasCompletedOnboarding;
          const completed = storedCompleted === true;
          if (typeof storedCompleted === "boolean") {
            set({ hasCompletedOnboarding: storedCompleted });
          }

          const storedShowTestnets = settingsRes.data.showTestNetworks;
          if (typeof storedShowTestnets === "boolean") {
            set({ showTestnets: storedShowTestnets });
          }

          // Decide whether the welcome flow should run on this boot.
          // - First-run (no accounts, never completed) → run it.
          // - Existing user (accounts already exist, flag missing
          //   because they predate this feature) → backfill the flag
          //   so a future wipe-and-recreate doesn't replay onboarding.
          // - Mid-flow refresh (popup re-opened before user dismissed
          //   Step 4) → don't auto-restart from Step 1; user can keep
          //   using the wallet.
          const accountCount = get().accountOrder.length;
          if (!completed) {
            if (accountCount === 0) {
              set({ isOnboardingActive: true });
            } else if (storedCompleted !== true) {
              void get().completeOnboarding();
            }
          }
        }
      } catch (settingsErr) {
        console.warn("[Store] Settings fetch failed; using default:", settingsErr);
      }
      await get().refreshLockFromSession();
    } catch (err) {
      console.warn("[Store] Failed to hydrate lock state:", err);
      set({ isUnlocked: false, unlockedAt: null });
    }
  },

  refreshLockFromSession: async () => {
    try {
      const autoLockMinutes = get().autoLockMinutes;
      const result = await chrome.storage.session.get(SESSION_UNLOCK_KEY);
      const lastUnlockedAt = result[SESSION_UNLOCK_KEY] as number | undefined;
      if (typeof lastUnlockedAt !== "number") {
        set({ isUnlocked: false, unlockedAt: null });
        return;
      }
      if (autoLockMinutes === "never") {
        set({ isUnlocked: true, unlockedAt: lastUnlockedAt });
        return;
      }
      const idleMs = Date.now() - lastUnlockedAt;
      const timeoutMs = autoLockMinutes * 60_000;
      if (idleMs < timeoutMs) {
        set({ isUnlocked: true, unlockedAt: lastUnlockedAt });
      } else {
        set({ isUnlocked: false, unlockedAt: null });
        chrome.storage.session.remove(SESSION_UNLOCK_KEY).catch(() => {});
      }
    } catch (err) {
      console.warn("[Store] Failed to refresh lock state:", err);
    }
  },

  setAutoLockMinutes: async (value) => {
    // Optimistic set so the timer effect re-runs immediately; revert
    // on persistence failure so the popup doesn't lie about what's
    // saved (reopen would snap the value back silently otherwise).
    const prev = get().autoLockMinutes;
    set({ autoLockMinutes: value });

    // Changing the preset IS user activity. Refresh the session stamp
    // before the settings write so the background's `isLocked()` compute
    // under the new (possibly tighter) timeout doesn't retroactively
    // judge prior idle time as "expired" and fire a spurious lock
    // transition that disconnects dApps.
    if (get().isUnlocked) {
      try {
        const now = Date.now();
        set({ unlockedAt: now });
        await chrome.storage.session.set({ [SESSION_UNLOCK_KEY]: now });
      } catch (err) {
        console.warn("[Store] Failed to refresh session stamp:", err);
      }
    }

    try {
      // Persist via background so the value survives popup close.
      // `autoLockTimeout` is the canonical field name in Settings; we
      // round-trip `"never"` as 0 and treat 0 from storage as "never" on
      // the popup side — keeps the storage schema stable.
      const stored = value === "never" ? 0 : value;
      const res = await chrome.runtime.sendMessage({
        type: "UPDATE_SETTINGS",
        payload: { autoLockTimeout: stored },
      });
      if (!res?.success) {
        set({ autoLockMinutes: prev });
        console.warn("[Store] UPDATE_SETTINGS rejected:", res?.error);
      }
    } catch (err) {
      set({ autoLockMinutes: prev });
      console.warn("[Store] Failed to persist autoLockMinutes:", err);
    }
  },

  completeOnboarding: async () => {
    if (get().hasCompletedOnboarding) return;
    set({ hasCompletedOnboarding: true });
    try {
      const res = await chrome.runtime.sendMessage({
        type: "UPDATE_SETTINGS",
        payload: { hasCompletedOnboarding: true },
      });
      if (!res?.success) {
        console.warn("[Store] UPDATE_SETTINGS rejected:", res?.error);
      }
    } catch (err) {
      console.warn("[Store] Failed to persist hasCompletedOnboarding:", err);
    }
  },

  dismissOnboarding: () => {
    if (!get().isOnboardingActive) return;
    set({ isOnboardingActive: false });
  },

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
        ...(addressChanged || chainChanged
          ? { assets: [], assetsLastFetched: null, assetsLastAttemptedAt: null }
          : {}),
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
          origin: "popup://sigby-wallet",
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
