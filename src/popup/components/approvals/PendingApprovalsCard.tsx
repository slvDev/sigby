/**
 * Pending-approvals queue surfaced on the Home page.
 *
 * When a user dismisses an approval popup (clicks X or clicks away), we no
 * longer auto-reject — the request stays `state: "pending"` in storage until
 * the 5-min signing timeout or an explicit approve/reject. This card lets
 * them resume any dismissed request instead of reloading the dApp.
 */

import { useEffect, useState } from "react";
import { MessageType, type PendingApprovalSummary } from "../../../types/messages";
import { STORAGE_KEYS } from "../../../utils/constants";
import { errorToString } from "../../../utils/rpcError";

const METHOD_LABELS: Record<string, string> = {
  eth_sendTransaction: "Send transaction",
  wallet_sendCalls: "Send calls",
  personal_sign: "Sign message",
  eth_sign: "Sign data",
  eth_signTypedData: "Sign typed data",
  eth_signTypedData_v3: "Sign typed data",
  eth_signTypedData_v4: "Sign typed data",
};

function formatRelative(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatOrigin(origin: string): string {
  return origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function PendingApprovalsCard() {
  const [items, setItems] = useState<PendingApprovalSummary[]>([]);
  const [resuming, setResuming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.LIST_PENDING_APPROVALS,
      });
      if (response?.success) {
        setItems(response.data ?? []);
      }
    } catch (e) {
      console.warn("[PendingApprovalsCard] Failed to load:", e);
    }
  };

  useEffect(() => {
    load();

    // Refresh when the persisted queue changes (new request, approved,
    // rejected, swept). No polling — event-driven via chrome.storage.
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "local" && changes[STORAGE_KEYS.PENDING_SIGNING_REQUESTS]) {
        load();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);

    // Gentle re-render so "Xs ago" labels tick while the popup is open.
    const interval = setInterval(() => setItems((prev) => [...prev]), 10_000);

    return () => {
      chrome.storage.onChanged.removeListener(onChanged);
      clearInterval(interval);
    };
  }, []);

  const handleResume = async (requestId: string) => {
    setResuming(requestId);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.RESUME_PENDING_APPROVAL,
        payload: { requestId },
      });
      if (!response?.success) {
        setError(errorToString(response?.error) || "Could not reopen approval");
        await load();
        return;
      }
      // Closing the toolbar popup gives focus to the reopened approval window.
      window.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reopen approval");
    } finally {
      setResuming(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-wider text-amber-800">
        Pending approval{items.length === 1 ? "" : "s"}
      </div>
      {items.map((item) => (
        <div
          key={item.requestId}
          className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-amber-100"
        >
          {item.metadata?.favicon ? (
            <img
              src={item.metadata.favicon}
              alt=""
              className="w-6 h-6 rounded object-contain bg-white"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-6 h-6 rounded bg-gray-200" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {METHOD_LABELS[item.method] ?? item.method}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {formatOrigin(item.origin)} · {formatRelative(item.createdAt)}
            </div>
          </div>
          <button
            onClick={() => handleResume(item.requestId)}
            disabled={resuming === item.requestId}
            className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {resuming === item.requestId ? "Opening..." : "Resume"}
          </button>
        </div>
      ))}
      {error && (
        <div className="text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
