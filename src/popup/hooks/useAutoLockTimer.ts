import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useWalletStore } from "../store";
import { SESSION_STORAGE_KEYS } from "../../utils/constants";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart"] as const;

const APPROVAL_PREFIXES = [
  "/connect",
  "/transaction",
  "/sign",
  "/grant-permissions",
] as const;

/**
 * Idle auto-lock timer. Active only when the wallet is unlocked AND
 * `autoLockMinutes` is numeric. Resets on user activity. On fire,
 * calls `store.lock()` — the AuthGuard re-renders to LockScreen.
 *
 * Also write-throughs the unlock timestamp to `chrome.storage.session`
 * on activity (debounced 30s) so that re-opening the popup inside the
 * idle window stays unlocked even if the popup was closed without any
 * explicit "refresh" of the timestamp.
 */
export function useAutoLockTimer() {
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const autoLockMinutes = useWalletStore((s) => s.autoLockMinutes);
  const lock = useWalletStore((s) => s.lock);
  const location = useLocation();

  const timeoutRef = useRef<number | null>(null);
  const lastSessionWriteRef = useRef<number>(0);

  // Approval popups open as standalone windows. They bypass the lock
  // guard (they run their own biometric) and must not participate in
  // the shared lock state — otherwise dormant approval popups flip
  // the session flag for the main popup.
  const isApprovalRoute = APPROVAL_PREFIXES.some((p) =>
    location.pathname.startsWith(p)
  );

  useEffect(() => {
    if (isApprovalRoute) return;
    if (!isUnlocked || autoLockMinutes === "never") return;

    const timeoutMs = autoLockMinutes * 60_000;

    function scheduleLock() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        lock();
      }, timeoutMs);
    }

    function touchSessionTimestamp() {
      const now = Date.now();
      if (now - lastSessionWriteRef.current < 30_000) return;
      lastSessionWriteRef.current = now;
      // sync try/catch can't trap chrome.storage async rejections —
      // swallow via .catch() so failure doesn't log as an unhandled
      // rejection but also doesn't block the in-popup timer.
      void chrome.storage.session
        .set({ [SESSION_STORAGE_KEYS.LAST_UNLOCKED_AT]: now })
        .catch(() => {
          // Session storage unavailable — in-popup timer still works.
        });
    }

    function onActivity() {
      scheduleLock();
      touchSessionTimestamp();
    }

    scheduleLock();

    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, onActivity, { passive: true });
    }

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      for (const ev of ACTIVITY_EVENTS) {
        document.removeEventListener(ev, onActivity);
      }
    };
  }, [isUnlocked, autoLockMinutes, lock, isApprovalRoute]);
}
