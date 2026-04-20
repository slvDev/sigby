import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";
import { portoStatusToString } from "../../../types/porto";
import type { PortoHistoryEntry } from "../../../types/porto";
import { CHAIN_CONFIGS } from "../../../utils/constants";
import {
  deriveSummary,
  formatAbsoluteTime,
  formatRelativeTime,
  type TransactionSummary,
} from "../../utils/transactionSummary";

export interface HistoryRow {
  id: string;
  chainId: number;
  status: "pending" | "confirmed" | "failed";
  hash?: string;
  timestamp?: number;
  relativeTime: string;
  absoluteTime: string;
  summary: TransactionSummary;
}

export function useHistory() {
  const { activeAddress, pendingTransactions, historyRefreshTrigger } =
    useWalletStore();
  const navigate = useNavigate();

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
        const mapped: HistoryRow[] = history.map(
          (entry: PortoHistoryEntry) => {
            const first = entry.transactions?.[0];
            const chainIdHex = first?.chainId;
            const ts = entry.timestamp;
            return {
              id: entry.id,
              chainId: chainIdHex ? parseInt(chainIdHex, 16) : 0,
              status: portoStatusToString(entry.status),
              hash: first?.transactionHash,
              timestamp: ts,
              relativeTime: ts ? formatRelativeTime(ts) : "",
              absoluteTime: ts ? formatAbsoluteTime(ts) : "",
              summary: deriveSummary(entry, activeAddress),
            };
          },
        );

        if (!cancelled) {
          setRows(mapped);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load transaction history",
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [activeAddress, historyRefreshTrigger]);

  const getChainName = useCallback(
    (txChainId: number) =>
      CHAIN_CONFIGS[txChainId]?.name || `Chain ${txChainId}`,
    [],
  );

  const getExplorerUrl = useCallback(
    (txChainId: number, hash: string) =>
      `${
        CHAIN_CONFIGS[txChainId]?.blockExplorerUrls?.[0] ||
        "https://etherscan.io"
      }/tx/${hash}`,
    [],
  );

  const openDetail = useCallback(
    (bundleId: string) => navigate(`/tx/${bundleId}`),
    [navigate],
  );

  return {
    rows,
    isLoading,
    error,
    pendingCount: pendingTransactions.length,
    getChainName,
    getExplorerUrl,
    openDetail,
  };
}
