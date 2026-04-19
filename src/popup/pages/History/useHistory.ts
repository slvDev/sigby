import { useState, useEffect } from "react";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";
import { portoStatusToString } from "../../../types/porto";
import type { PortoHistoryEntry } from "../../../types/porto";
import { CHAIN_CONFIGS } from "../../../utils/constants";

export interface DisplayTransaction {
  id: string;
  chainId: number;
  status: "pending" | "confirmed" | "failed";
  hash?: string;
}

export function useHistory() {
  const { activeAddress, pendingTransactions, historyRefreshTrigger } =
    useWalletStore();

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
        if (!popupPortoService.isReady()) {
          await popupPortoService.initialize();
        }

        const history = await popupPortoService.getCallsHistory(activeAddress);

        // Porto's getCallsHistory returns entries with `transactions[]` —
        // each carries chainId (hex) and transactionHash. Earlier code
        // fell back to entry.chainId / entry.receipts[] but the relay
        // doesn't populate those, so the fallbacks were dead.
        const displayTxs: DisplayTransaction[] = history.map(
          (entry: PortoHistoryEntry) => {
            const first = entry.transactions?.[0];
            const chainIdHex = first?.chainId;
            return {
              id: entry.id,
              chainId: chainIdHex ? parseInt(chainIdHex, 16) : 0,
              status: portoStatusToString(entry.status),
              hash: first?.transactionHash,
            };
          }
        );

        setTransactions(displayTxs);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load transaction history"
        );
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [activeAddress, historyRefreshTrigger]);

  const getChainName = (txChainId: number) =>
    CHAIN_CONFIGS[txChainId]?.name || `Chain ${txChainId}`;

  const getExplorerUrl = (txChainId: number, hash: string) =>
    `${
      CHAIN_CONFIGS[txChainId]?.blockExplorerUrls?.[0] || "https://etherscan.io"
    }/tx/${hash}`;

  return {
    transactions,
    isLoading,
    error,
    pendingCount: pendingTransactions.length,
    getChainName,
    getExplorerUrl,
  };
}
