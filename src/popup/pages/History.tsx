/**
 * History Page
 * Transaction history display
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../store";
import type { Transaction } from "../../types/account";

export function History() {
  const navigate = useNavigate();
  const { activeAddress } = useWalletStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      if (!activeAddress) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          type: "GET_STATE",
        });

        // Filter transactions for active account (simplified - in production would be per-account)
        const allTx = response.data?.transactions || [];
        setTransactions(allTx);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [activeAddress]);

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const formatValue = (value: string) => {
    try {
      const wei = BigInt(value);
      const eth = Number(wei) / 1e18;
      return eth.toFixed(4) + " ETH";
    } catch {
      return value;
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 font-medium">No transactions yet</p>
            <p className="text-sm text-gray-400 mt-1">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900">
                      {tx.to ? "Send" : "Contract"}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      To: {tx.to?.slice(0, 8)}...{tx.to?.slice(-6) || "Contract"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{formatValue(tx.value)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${getStatusClasses(tx.status)}`}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400">{formatTimestamp(tx.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
