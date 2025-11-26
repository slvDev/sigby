/**
 * Transaction Approval Page
 * Shown when a dApp requests to send a transaction
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, SigningRequest } from "../../../types/messages";
import { popupPortoService } from "../../portoService";

export function TransactionApproval() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRequest() {
      try {
        await popupPortoService.initialize();

        const response = await chrome.runtime.sendMessage({
          type: MessageType.GET_PENDING_SIGNING,
          payload: { requestId },
        });

        if (response.success && response.data) {
          setRequest(response.data);

          const tx = response.data.params?.[0];
          if (tx) {
            try {
              const gasResponse = await chrome.runtime.sendMessage({
                type: MessageType.DAPP_REQUEST,
                payload: {
                  method: "eth_estimateGas",
                  params: [tx],
                  origin: response.data.origin,
                },
              });
              if (gasResponse.success) {
                setGasEstimate(gasResponse.data);
              }
            } catch (e) {
              console.warn("Gas estimation failed:", e);
            }
          }
        } else {
          setError(response.error || "Request not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch request");
      } finally {
        setIsFetching(false);
      }
    }

    fetchRequest();
  }, [requestId]);

  const handleApprove = async () => {
    if (!request) return;

    setIsLoading(true);
    setError(null);

    try {
      const tx = request.params?.[0] || {};

      const result = await popupPortoService.sendTransaction({
        to: tx.to,
        value: tx.value,
        data: tx.data,
        chainId: request.chainId,
      });

      await chrome.runtime.sendMessage({
        type: MessageType.APPROVE_SIGNING,
        payload: { requestId, result },
      });

      window.close();
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
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
        Loading transaction...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col min-h-[600px] p-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Transaction Request</h2>
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

  const tx = request.params?.[0] || {};
  const displayOrigin = request.origin?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Unknown";
  const shortTo = tx.to ? `${tx.to.slice(0, 10)}...${tx.to.slice(-8)}` : "Contract creation";
  const valueInEth = tx.value ? (parseInt(tx.value, 16) / 1e18).toFixed(6) : "0";
  const gasHex = gasEstimate || tx.gas || tx.gasLimit;
  const gasDecimal = gasHex ? parseInt(gasHex, 16).toLocaleString() : "Unknown";

  return (
    <div className="flex flex-col min-h-[600px] p-6 gap-4">
      {/* Header */}
      <div className="text-center pb-3 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Transaction Request</h2>
      </div>

      {/* dApp Info */}
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

      {/* Transaction Details */}
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        <div className="flex justify-between items-start gap-3">
          <span className="text-sm text-gray-500">To:</span>
          <span className="font-medium text-gray-900 font-mono text-sm text-right">
            {shortTo}
          </span>
        </div>
        <div className="flex justify-between items-start gap-3">
          <span className="text-sm text-gray-500">Value:</span>
          <span className="font-medium text-gray-900">{valueInEth} ETH</span>
        </div>
        {tx.data && tx.data !== "0x" && (
          <div className="flex justify-between items-start gap-3">
            <span className="text-sm text-gray-500">Data:</span>
            <span className="font-mono text-xs text-gray-600 text-right max-w-[200px] truncate">
              {tx.data.length > 20 ? `${tx.data.slice(0, 20)}...` : tx.data}
            </span>
          </div>
        )}
        <div className="flex justify-between items-start gap-3">
          <span className="text-sm text-gray-500">Est. Gas:</span>
          <span className="font-medium text-gray-900">{gasDecimal}</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
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
          {isLoading ? "Signing..." : "Approve"}
        </button>
      </div>
    </div>
  );
}
