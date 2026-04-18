/**
 * History Page
 * Transaction history display using Porto SDK's wallet_getCallsHistory
 */

import { useState, useEffect } from "react";
import { useWalletStore } from "../store";
import { BottomNav } from "../components/layout/BottomNav";
import { popupPortoService } from "../portoService";
import { portoStatusToString } from "../../types/porto";
import type { PortoHistoryEntry } from "../../types/porto";
import { CHAIN_CONFIGS } from "../../utils/constants";

interface DisplayTransaction {
  id: string;
  chainId: number;
  status: 'pending' | 'confirmed' | 'failed';
  hash?: string;
}

export function History() {
  const { activeAddress, pendingTransactions, historyRefreshTrigger } = useWalletStore();

  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      if (!activeAddress) {
        setIsLoading(false);
        return;
      }

      try {
        // Initialize Porto if needed
        if (!popupPortoService.isReady()) {
          await popupPortoService.initialize();
        }

        // Fetch history from Porto SDK
        const history = await popupPortoService.getCallsHistory(activeAddress);
        console.log('[History] Raw history from Porto:', JSON.stringify(history, null, 2));

        // Porto's getCallsHistory returns entries with `transactions[]` —
        // each carries the chainId (hex) and transactionHash. Earlier code
        // fell back to top-level `entry.chainId` / `entry.receipts[]` but
        // the relay doesn't populate those, so the fallbacks were dead.
        const displayTxs: DisplayTransaction[] = history.map((entry: PortoHistoryEntry) => {
          const first = entry.transactions?.[0];
          const chainIdHex = first?.chainId;
          return {
            id: entry.id,
            chainId: chainIdHex ? parseInt(chainIdHex, 16) : 0,
            status: portoStatusToString(entry.status),
            hash: first?.transactionHash,
          };
        });

        setTransactions(displayTxs);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transaction history");
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [activeAddress, historyRefreshTrigger]);

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

  const getChainName = (txChainId: number) => {
    return CHAIN_CONFIGS[txChainId]?.name || `Chain ${txChainId}`;
  };

  const truncateHash = (hash?: string) => {
    if (!hash) return "Pending...";
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
        {pendingTransactions.length > 0 && (
          <div className="flex items-center gap-2 mt-2 text-sm text-yellow-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
            Watching {pendingTransactions.length} pending transaction{pendingTransactions.length > 1 ? 's' : ''}...
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">Loading transactions...</div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 font-medium">{error}</p>
            <p className="text-sm text-gray-400 mt-1">Please try again later</p>
          </div>
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
                      Transaction
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {truncateHash(tx.hash)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">{getChainName(tx.chainId)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${getStatusClasses(tx.status)}`}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </span>
                  </div>
                </div>
                {tx.hash && (
                  <a
                    href={`${CHAIN_CONFIGS[tx.chainId]?.blockExplorerUrls?.[0] || 'https://etherscan.io'}/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline"
                  >
                    View on Explorer
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
