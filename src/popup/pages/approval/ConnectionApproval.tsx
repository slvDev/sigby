/**
 * Connection Approval Page
 * Shown when a dApp requests to connect
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType } from "../../../types/messages";
import { errorToString } from "../../../utils/rpcError";
import { analyzeOrigin } from "../../utils/originCheck";
import { OriginSecurityBanner } from "../../components/approvals/OriginSecurityBanner";

export function ConnectionApproval() {
  const [searchParams] = useSearchParams();
  const origin = searchParams.get("origin") || "Unknown dApp";
  const accountAddress = searchParams.get("account") || "";
  const favicon = searchParams.get("favicon") || "";
  const title = searchParams.get("title") || origin;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isKnownOrigin, setIsKnownOrigin] = useState<boolean | null>(null);

  const originAnalysis = useMemo(() => analyzeOrigin(origin), [origin]);
  const displayOrigin = originAnalysis.unicodeHostname ?? originAnalysis.hostname;
  const shortAddress = accountAddress
    ? `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`
    : "No account";

  useEffect(() => {
    let cancelled = false;
    chrome.runtime
      .sendMessage({ type: MessageType.IS_ORIGIN_KNOWN, payload: { origin } })
      .then((resp) => {
        if (cancelled) return;
        setIsKnownOrigin(resp?.success ? Boolean(resp.data?.known) : null);
      })
      .catch(() => {
        if (!cancelled) setIsKnownOrigin(null);
      });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  const handleApprove = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.APPROVE_CONNECTION,
        payload: { origin, accountAddress },
      });

      if (response.success) {
        window.close();
      } else {
        setError(errorToString(response.error) || "Failed to approve connection");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.REJECT_CONNECTION,
        payload: { origin, accountAddress },
      });
    } catch (err) {
      console.error("Failed to reject connection:", err);
    }

    window.close();
  };

  return (
    <div className="flex flex-col min-h-[600px] p-6 gap-5">
      {/* Header */}
      <div className="text-center pb-4 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Connection Request</h2>
      </div>

      {/* dApp Info */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        {favicon && (
          <img
            src={favicon}
            alt=""
            className="w-12 h-12 rounded-xl object-contain bg-white p-1 shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{title}</div>
          <div className="text-sm text-gray-500 truncate">{displayOrigin}</div>
        </div>
      </div>

      {/* Security indicators (HTTPS / Punycode / new origin) */}
      <OriginSecurityBanner analysis={originAnalysis} isKnownOrigin={isKnownOrigin} />

      {/* Message */}
      <div className="text-center py-4">
        <p className="text-gray-700">This site wants to connect to your wallet</p>
      </div>

      {/* Account */}
      <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
          Account to connect:
        </div>
        <div className="font-semibold font-mono text-gray-900">{shortAddress}</div>
      </div>

      {/* Permissions */}
      <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
        <div className="text-sm font-medium text-yellow-800 mb-3">
          This site will be able to:
        </div>
        <ul className="space-y-2 text-sm text-yellow-700">
          <li className="flex items-center gap-2">
            <span className="text-yellow-500">•</span>
            View your wallet address
          </li>
          <li className="flex items-center gap-2">
            <span className="text-yellow-500">•</span>
            Request transaction signatures
          </li>
        </ul>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-auto pt-5">
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
          {isLoading ? "Connecting..." : "Connect"}
        </button>
      </div>
    </div>
  );
}
