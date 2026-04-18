/**
 * Transaction Watcher Hook
 * Polls pending transactions and refreshes balances on confirmation
 */

import { useEffect, useRef } from "react";
import { useWalletStore } from "../store";
import { popupPortoService } from "../portoService";
import { useToast } from "../components/common";

const POLL_INTERVAL = 5000; // 5 seconds

/**
 * Watch pending transactions and trigger balance refresh on confirmation
 * Should be used in App component to work globally
 */
export function useTransactionWatcher() {
  const {
    pendingTransactions,
    removePendingTransaction,
    refreshAssets,
    triggerHistoryRefresh,
  } = useWalletStore();
  const { showToast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // No pending transactions - clear interval
    if (pendingTransactions.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkPendingTransactions = async () => {
      // Ensure Porto is initialized
      if (!popupPortoService.isReady()) {
        try {
          await popupPortoService.initialize();
        } catch (error) {
          console.error("[Watcher] Failed to initialize Porto:", error);
          return;
        }
      }

      for (const tx of pendingTransactions) {
        try {
          const status = await popupPortoService.getCallsStatus(tx.id);

          if (status.status === 200) {
            // Confirmed!
            console.log("[Watcher] Transaction confirmed:", tx.id);
            removePendingTransaction(tx.id);
            await refreshAssets(true); // Force refresh after confirmation
            triggerHistoryRefresh(); // Trigger history page to refetch
            showToast({
              type: "success",
              message: "Transaction confirmed!",
            });
          } else if (status.status >= 300) {
            // Failed
            console.log("[Watcher] Transaction failed:", tx.id, status.status);
            removePendingTransaction(tx.id);
            triggerHistoryRefresh(); // Trigger history page to refetch
            showToast({
              type: "error",
              message: "Transaction failed",
            });
          }
          // status 100 = still pending, keep polling
        } catch (error) {
          console.error("[Watcher] Failed to check status:", error);
        }
      }
    };

    // Initial check
    checkPendingTransactions();

    // Set up polling
    intervalRef.current = setInterval(checkPendingTransactions, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pendingTransactions, removePendingTransaction, refreshAssets, triggerHistoryRefresh, showToast]);
}
