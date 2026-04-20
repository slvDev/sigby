import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";
import type {
  PortoCallsStatus,
  PortoHistoryEntry,
} from "../../../types/porto";
import { CHAIN_CONFIGS } from "../../../utils/constants";
import {
  deriveSummary,
  flattenAssetDiffs,
  formatAbsoluteTime,
  formatRelativeTime,
  formatTokenAmount,
  formatUsd,
  type TransactionSummary,
} from "../../utils/transactionSummary";

export interface DetailAssetRow {
  address?: string | null;
  symbol: string;
  name?: string | null;
  type: "erc20" | "erc721" | null;
  direction: "incoming" | "outgoing";
  amount: string;
  signedAmount: string;
  usdValue?: string;
}

export interface DetailFeeSummary {
  /** Formatted native fee (if feeTotals had a chain-matching entry). */
  amount?: string;
  currency?: string;
  usdValue?: string;
  /** Fee appeared to be paid by a paymaster/sponsor (no user-side outgoing fee diff). */
  sponsored: boolean;
}

export interface DetailTransactionRow {
  chainId: number;
  chainName: string;
  transactionHash: string;
  explorerUrl?: string;
}

export interface TransactionDetailView {
  loading: boolean;
  error: string | null;
  bundleId: string;
  entry: PortoHistoryEntry | null;
  status: PortoCallsStatus | null;
  summary: TransactionSummary;
  chainId: number;
  chainName: string;
  statusLabel: "confirmed" | "pending" | "failed";
  relativeTime: string;
  absoluteTime: string;
  assetRows: DetailAssetRow[];
  fee: DetailFeeSummary;
  counterparties: string[];
  transactions: DetailTransactionRow[];
  keyHash?: string;
  signerLabel: string;
  signerIsAdmin: boolean;
  primaryExplorerUrl?: string;
  devOpen: boolean;
  toggleDev: () => void;
  handleBack: () => void;
  handleRetry: () => void;
  goPermissions: () => void;
  explorerUrl: (chainId: number, hash: string) => string;
}

function statusLabel(
  n: number | undefined,
): "confirmed" | "pending" | "failed" {
  if (n === 100) return "pending";
  if (n === 200) return "confirmed";
  return "failed";
}

function getChainName(id: number): string {
  return CHAIN_CONFIGS[id]?.name || `Chain ${id}`;
}

function makeExplorer(chainId: number, hash: string): string {
  const base =
    CHAIN_CONFIGS[chainId]?.blockExplorerUrls?.[0] || "https://etherscan.io";
  return `${base}/tx/${hash}`;
}

export function useTransactionDetail(): TransactionDetailView {
  const navigate = useNavigate();
  const { bundleId: rawBundleId } = useParams<{ bundleId: string }>();
  const bundleId = rawBundleId || "";
  const { activeAddress, accountKeys } = useWalletStore();

  const [entry, setEntry] = useState<PortoHistoryEntry | null>(null);
  const [status, setStatus] = useState<PortoCallsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!bundleId || !activeAddress) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (!popupPortoService.isReady()) {
          await popupPortoService.initialize();
        }
        const result = await popupPortoService.getTransaction(
          bundleId,
          activeAddress,
        );
        if (cancelled) return;
        setEntry(result.entry);
        setStatus(result.status);
        if (!result.entry && !result.status) {
          setError("Transaction not found. It may still be propagating.");
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load transaction detail",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [bundleId, activeAddress, fetchNonce]);

  const summary = useMemo<TransactionSummary>(
    () =>
      entry && activeAddress
        ? deriveSummary(entry, activeAddress)
        : { direction: "unknown", title: "Transaction" },
    [entry, activeAddress],
  );

  const firstTx = entry?.transactions?.[0];
  const primaryChainId = useMemo<number>(() => {
    if (firstTx?.chainId) {
      return parseInt(firstTx.chainId, 16);
    }
    if (status?.chainId) {
      // Porto may return chainId as number or hex wire string.
      const c = status.chainId as unknown as number | string;
      if (typeof c === "number") return c;
      if (typeof c === "string") return parseInt(c, 16);
    }
    return 0;
  }, [firstTx, status]);

  const assetRows = useMemo<DetailAssetRow[]>(() => {
    if (!entry || !activeAddress) return [];
    const mine = flattenAssetDiffs(entry.capabilities?.assetDiffs, activeAddress);
    return mine.map((d) => {
      const raw = (() => {
        try {
          return BigInt(d.value);
        } catch {
          return 0n;
        }
      })();
      const abs = raw < 0n ? -raw : raw;
      const decimals = d.decimals ?? 0;
      const amount = formatTokenAmount(abs, decimals);
      const sign = d.direction === "outgoing" ? "-" : "+";
      return {
        address: d.address ?? null,
        symbol: d.symbol,
        name: d.name ?? null,
        type: d.type,
        direction: d.direction,
        amount,
        signedAmount: `${sign}${amount}`,
        usdValue: formatUsd(d.fiat?.value),
      };
    });
  }, [entry, activeAddress]);

  const fee = useMemo<DetailFeeSummary>(() => {
    const totals = entry?.capabilities?.feeTotals;
    if (!totals) return { sponsored: false };
    const hexChain = firstTx?.chainId;
    // Fee totals are keyed by chain hex; prefer the firstTx chain, else
    // the only entry, else the first.
    const keys = Object.keys(totals);
    const key = hexChain && totals[hexChain.toLowerCase()]
      ? hexChain.toLowerCase()
      : hexChain && totals[hexChain]
        ? hexChain
        : keys[0];
    if (!key) return { sponsored: false };
    const total = totals[key];
    if (!total) return { sponsored: false };
    // Sponsored heuristic: no outgoing native diff for the same chain
    // that matches the fee currency. We can't perfectly detect this
    // without the paymaster metadata; flagged in report.
    const diffs = entry?.capabilities?.assetDiffs;
    let sponsored = false;
    if (diffs && activeAddress && key) {
      const chainRows = diffs[key] || [];
      const mine = chainRows.find(([addr]) =>
        addr.toLowerCase() === activeAddress.toLowerCase(),
      );
      const hasOutgoingMatch = (mine?.[1] || []).some(
        (e) =>
          e.direction === "outgoing" &&
          e.symbol.toUpperCase() === (total.currency || "").toUpperCase(),
      );
      // If the user has no outgoing diff matching the fee currency,
      // assume paymaster/sponsor covered it.
      sponsored = !hasOutgoingMatch;
    }
    return {
      amount: total.value,
      currency: total.currency,
      usdValue: undefined,
      sponsored,
    };
  }, [entry, firstTx, activeAddress]);

  const counterparties = useMemo<string[]>(() => {
    const out = new Set<string>();
    if (summary.counterparty) out.add(summary.counterparty);
    return Array.from(out);
  }, [summary]);

  const transactions = useMemo<DetailTransactionRow[]>(() => {
    const txs = entry?.transactions || [];
    return txs.map((t) => {
      const id = parseInt(t.chainId, 16);
      const hash = t.transactionHash;
      return {
        chainId: id,
        chainName: getChainName(id),
        transactionHash: hash,
        explorerUrl: hash ? makeExplorer(id, hash) : undefined,
      };
    });
  }, [entry]);

  const { signerLabel, signerIsAdmin } = useMemo(() => {
    const kh = entry?.keyHash;
    if (!kh) {
      return { signerLabel: "Unknown key", signerIsAdmin: false };
    }
    const key = accountKeys.find(
      (k) => (k.id || "").toLowerCase() === kh.toLowerCase(),
    );
    if (!key) {
      // We don't persist a name-per-key mapping yet; show truncated
      // hash and treat as session-key until we know otherwise.
      return {
        signerLabel: `Key ${kh.slice(0, 6)}…${kh.slice(-4)}`,
        signerIsAdmin: false,
      };
    }
    if (key.role === "admin") {
      return { signerLabel: "Admin key", signerIsAdmin: true };
    }
    return { signerLabel: "Session key", signerIsAdmin: false };
  }, [entry, accountKeys]);

  const handleBack = useCallback(() => {
    // Ensure the back button always returns to the History tab rather
    // than history.back() which could leave the tab context.
    navigate("/history");
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setFetchNonce((n) => n + 1);
  }, []);

  const toggleDev = useCallback(() => {
    setDevOpen((o) => !o);
  }, []);

  const goPermissions = useCallback(() => {
    navigate("/permissions");
  }, [navigate]);

  const explorerUrl = useCallback(
    (chainId: number, hash: string) => makeExplorer(chainId, hash),
    [],
  );

  const primaryExplorerUrl = firstTx?.transactionHash
    ? makeExplorer(primaryChainId, firstTx.transactionHash)
    : undefined;

  return {
    loading,
    error,
    bundleId,
    entry,
    status,
    summary,
    chainId: primaryChainId,
    chainName: primaryChainId ? getChainName(primaryChainId) : "",
    statusLabel: statusLabel(entry?.status ?? status?.status),
    relativeTime: entry?.timestamp ? formatRelativeTime(entry.timestamp) : "",
    absoluteTime: entry?.timestamp ? formatAbsoluteTime(entry.timestamp) : "",
    assetRows,
    fee,
    counterparties,
    transactions,
    keyHash: entry?.keyHash,
    signerLabel,
    signerIsAdmin,
    primaryExplorerUrl,
    devOpen,
    toggleDev,
    handleBack,
    handleRetry,
    goPermissions,
    explorerUrl,
  };
}
