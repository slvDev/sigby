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
import { useTransactionWatcher } from "./hooks";
import { FONT_STACK } from "./styles/theme";
import { tween } from "./styles/motion";

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
 * AuthGuard
 * Redirects to onboarding if no accounts exist
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading } = useWalletStore();
  const location = useLocation();

  // Skip guard for approval routes
  if (location.pathname.startsWith("/connect") ||
      location.pathname.startsWith("/transaction") ||
      location.pathname.startsWith("/sign") ||
      location.pathname.startsWith("/grant-permissions")) {
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

  return (
    <MotionConfig reducedMotion="user" transition={tween.baseOut}>
      <ToastProvider>
        <TransactionWatcher />
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
