import { useState, useEffect, useCallback, useRef } from "react";
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

const PAGE_SIZE = 10;

function mapEntries(
  entries: PortoHistoryEntry[],
  activeAddress: string,
): HistoryRow[] {
  return entries.map((entry) => {
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
  });
}

export function useHistory() {
  const { activeAddress, pendingTransactions, historyRefreshTrigger } =
    useWalletStore();
  const navigate = useNavigate();

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // Next offset to request from Porto. Reset on account switch or refresh
  // trigger; bumped by the returned page length after each fetch.
  const nextIndexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!activeAddress) {
        setIsLoading(false);
        setRows([]);
        setHasMore(false);
        nextIndexRef.current = 0;
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        if (!popupPortoService.isReady()) {
          await popupPortoService.initialize();
        }
        const history = await popupPortoService.getCallsHistory(activeAddress, {
          index: 0,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        const mapped = mapEntries(history, activeAddress);
        setRows(mapped);
        setHasMore(history.length === PAGE_SIZE);
        nextIndexRef.current = history.length;
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load transaction history",
          );
          setRows([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [activeAddress, historyRefreshTrigger]);

  const loadMore = useCallback(async () => {
    if (!activeAddress || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }
      const history = await popupPortoService.getCallsHistory(activeAddress, {
        index: nextIndexRef.current,
        limit: PAGE_SIZE,
      });
      const mapped = mapEntries(history, activeAddress);
      // Dedupe by bundleId — Porto's index shifts if a new tx lands between
      // pages, which can re-surface the last entry of the prior page.
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...mapped.filter((r) => !seen.has(r.id))];
      });
      setHasMore(history.length === PAGE_SIZE);
      nextIndexRef.current += history.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeAddress, isLoadingMore, hasMore]);

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
    isLoadingMore,
    hasMore,
    error,
    pendingCount: pendingTransactions.length,
    getChainName,
    getExplorerUrl,
    openDetail,
    loadMore,
  };
}
