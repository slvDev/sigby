/**
 * App Layout Component
 * Main layout wrapper with Header and LegacyParamHandler
 */

import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { useWalletStore, syncStoreWithBackground } from "./store";
import { popupPortoService } from "./portoService";
import { ToastProvider } from "./components/common";
import { useTransactionWatcher, useAutoLockTimer } from "./hooks";
import { FONT_STACK } from "./styles/theme";
import { tween } from "./styles/motion";
import { Lock } from "./pages/Lock";
import { SESSION_STORAGE_KEYS } from "../utils/constants";

/**
 * LegacyParamHandler
 * Redirects old ?view=X URL params to hash routes for backward compatibility
 */
function LegacyParamHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get("view");

    if (view) {
      // Build new hash route path
      let path = `/${view}`;
      const searchParams = new URLSearchParams();

      // Copy relevant params
      ["requestId", "origin", "account", "favicon", "title"].forEach((key) => {
        const value = urlParams.get(key);
        if (value) searchParams.set(key, value);
      });

      const search = searchParams.toString();
      navigate(`${path}${search ? `?${search}` : ""}`, { replace: true });
    }
  }, [navigate]);

  return null;
}

/**
 * TransactionWatcher
 * Watches pending transactions and triggers balance refresh on confirmation
 */
function TransactionWatcher() {
  useTransactionWatcher();
  return null;
}

/**
 * AutoLockTimer
 * Idle timer that fires `lock()` after `autoLockMinutes` of inactivity.
 */
function AutoLockTimer() {
  useAutoLockTimer();
  return null;
}

/**
 * AuthGuard
 * Gates rendering on lock state. Approval routes bypass entirely —
 * they run their own biometric on approve. Onboarding (no accounts)
 * renders through to Home which shows the create/connect form. The
 * lock gate only fires when we have accounts AND the session is
 * stale/unset.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoading = useWalletStore((s) => s.isLoading);
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const hasAccounts = useWalletStore((s) => s.accountOrder.length > 0);
  const location = useLocation();

  // Skip guard for approval routes
  if (
    location.pathname.startsWith("/connect") ||
    location.pathname.startsWith("/transaction") ||
    location.pathname.startsWith("/sign") ||
    location.pathname.startsWith("/grant-permissions")
  ) {
    return <>{children}</>;
  }

  // Show loading while checking
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  // Lock gate — render LockScreen in place of normal routes.
  if (hasAccounts && !isUnlocked) {
    return <Lock />;
  }

  return <>{children}</>;
}

/**
 * App Component
 */
export function App() {
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize Porto SDK
        await popupPortoService.initialize();

        // Sync with background state
        await syncStoreWithBackground();

        // Resolve lock state from session storage AFTER accounts have
        // been synced — LockScreen reads accountName from activeAddress.
        await useWalletStore.getState().hydrateLockFromSession();
      } catch (error) {
        console.error("[App] Initialization failed:", error);
        // Use direct state update instead of destructured function
        useWalletStore.setState({
          error: error instanceof Error ? error.message : "Initialization failed",
          errorAt: Date.now(),
        });
      } finally {
        setInitializing(false);
      }
    }

    initialize();
  }, []); // Empty deps - only run once on mount

  // Keep lock state in sync with the shared session timestamp so that
  // an approval window unlocking the wallet (or another context
  // writing the stamp) reflects in this popup without requiring a
  // second Touch ID. chrome.storage.onChanged fires across all
  // extension contexts on writes in any context, including self.
  //
  // Uses the session-only refresh variant — NOT the full hydrate —
  // because hydrate pulls `autoLockTimeout` via GET_SETTINGS, which
  // races an in-flight `setAutoLockMinutes` (the optimistic store
  // update gets clobbered by the background's not-yet-updated value
  // before UPDATE_SETTINGS lands). Also saves a roundtrip on every
  // session touch from useAutoLockTimer.
  useEffect(() => {
    function onChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) {
      if (
        area !== "session" ||
        !changes[SESSION_STORAGE_KEYS.LAST_UNLOCKED_AT]
      ) {
        return;
      }
      useWalletStore.getState().refreshLockFromSession();
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  if (initializing) {
    return (
      <div
        className="w-[400px] min-h-[600px] flex flex-col text-zinc-900"
        style={{ fontFamily: FONT_STACK, background: "#f6f7fb" }}
      >
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          Loading…
        </div>
      </div>
    );
  }

  // Motion always plays — no os-flag / in-app reduce-motion branch.
  return (
    <MotionConfig reducedMotion="never" transition={tween.baseOut}>
      <ToastProvider>
        <TransactionWatcher />
        <AutoLockTimer />
        <div
          className="w-[400px] min-h-[600px] flex flex-col text-zinc-900"
          style={{ fontFamily: FONT_STACK }}
        >
          <LegacyParamHandler />
          <AuthGuard>
            <Outlet />
          </AuthGuard>
        </div>
      </ToastProvider>
    </MotionConfig>
  );
}
