/**
 * Grant Permissions Approval Page
 * Shown when a dApp calls wallet_grantPermissions — user reviews the requested
 * session-key scope (calls, spend limits, fee token, expiry) before approving.
 *
 * On approve, we call Porto SDK via popupPortoService.grantPermissions (which
 * prompts the user's passkey to authorize the new key), serialize the
 * GrantedPermission back through APPROVE_SIGNING, and let the background
 * handler parse it before returning to the dApp.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, type SigningRequest } from "../../../types/messages";
import type { PermissionRequest } from "../../../types/porto";
import { popupPortoService } from "../../portoService";
import { errorToString } from "../../../utils/rpcError";

function formatAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatExpiry(unix: number): string {
  const ms = unix * 1000;
  const delta = ms - Date.now();
  if (delta <= 0) return "expired";
  const days = Math.floor(delta / 86_400_000);
  if (days >= 2) return `in ${days} days`;
  const hours = Math.floor(delta / 3_600_000);
  if (hours >= 2) return `in ${hours} hours`;
  const minutes = Math.max(1, Math.floor(delta / 60_000));
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function GrantPermissionsApproval() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SigningRequest | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRequest() {
      try {
        await popupPortoService.initialize();
        const response = await chrome.runtime.sendMessage({
          type: MessageType.GET_PENDING_SIGNING,
          payload: { requestId },
        });
        if (cancelled) return;
        if (response?.success && response.data) {
          setRequest(response.data);
        } else {
          setError(errorToString(response?.error) || "Request not found");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch request");
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    fetchRequest();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const permissionRequest = request?.params?.[0] as PermissionRequest | undefined;

  const handleApprove = async () => {
    if (!request || !permissionRequest) return;
    setIsLoading(true);
    setError(null);
    try {
      const granted = await popupPortoService.grantPermissions({
        address: request.accountAddress,
        permissions: permissionRequest,
      });
      await chrome.runtime.sendMessage({
        type: MessageType.APPROVE_SIGNING,
        payload: { requestId, result: JSON.stringify(granted) },
      });
      window.close();
    } catch (err) {
      console.error("[GrantPermissionsApproval] failed:", err);
      setError(err instanceof Error ? err.message : "Failed to grant permissions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.REJECT_SIGNING,
        payload: { requestId },
      });
    } catch (err) {
      console.error("Failed to reject:", err);
    }
    window.close();
  };

  if (isFetching) {
    return (
      <div className="w-[400px] min-h-[600px] bg-white flex items-center justify-center text-gray-500">
        Loading permission request...
      </div>
    );
  }

  if (!request || !permissionRequest) {
    return (
      <div className="flex flex-col min-h-[600px] p-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Permission Request</h2>
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error || "Request not found or expired"}
        </div>
        <button
          onClick={() => window.close()}
          className="py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  const displayOrigin = request.origin?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Unknown";
  const calls = permissionRequest.permissions.calls ?? [];
  const spendLimits = permissionRequest.permissions.spend ?? [];

  return (
    <div className="flex flex-col min-h-[600px] p-6 gap-4">
      <div className="text-center pb-3 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Grant Session Key</h2>
        <p className="text-xs text-gray-500 mt-1">
          The dApp will be able to sign within these limits without prompting you each time.
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
        {request.metadata?.favicon && (
          <img
            src={request.metadata.favicon}
            alt=""
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="font-medium text-gray-700 truncate">{displayOrigin}</div>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expires</h3>
        <p className="text-sm text-gray-800">{formatExpiry(permissionRequest.expiry)}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Allowed calls ({calls.length})
        </h3>
        <div className="flex flex-col gap-1">
          {calls.map((call, idx) => (
            <div
              key={idx}
              className="px-3 py-2 bg-gray-50 rounded-lg text-xs font-mono text-gray-700 break-all"
            >
              {call.to && <div>to {formatAddress(call.to)}</div>}
              {call.signature && <div className="text-gray-500">{call.signature}</div>}
              {call.selector && <div className="text-gray-500">selector {call.selector}</div>}
            </div>
          ))}
        </div>
      </section>

      {spendLimits.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Spend limits
          </h3>
          <div className="flex flex-col gap-1">
            {spendLimits.map((limit, idx) => (
              <div key={idx} className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-700">
                <span className="font-mono">{limit.limit}</span> per {limit.period} on{" "}
                <span className="font-mono">{formatAddress(limit.token)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee token</h3>
        <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-700">
          Up to <span className="font-mono">{permissionRequest.feeToken.limit}</span>{" "}
          {permissionRequest.feeToken.symbol ?? "native"}
        </div>
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-auto pt-4 border-t border-gray-100">
        <button
          onClick={handleReject}
          disabled={isLoading}
          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Approving..." : "Approve"}
        </button>
      </div>
    </div>
  );
}
