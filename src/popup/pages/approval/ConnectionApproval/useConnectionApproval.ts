import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType } from "../../../../types/messages";
import { errorToString } from "../../../../utils/rpcError";
import { analyzeOrigin } from "../../../utils/originCheck";

export function useConnectionApproval() {
  const [searchParams] = useSearchParams();
  const origin = searchParams.get("origin") || "Unknown dApp";
  const accountAddress = searchParams.get("account") || "";
  const favicon = searchParams.get("favicon") || "";
  const title = searchParams.get("title") || origin;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isKnownOrigin, setIsKnownOrigin] = useState<boolean | null>(null);

  // Hoisted hooks — MUST run on every render before any early return,
  // otherwise React raises error #310 (hook-order mismatch) when a
  // conditional render flips between loading and loaded states.
  const originAnalysis = useMemo(() => analyzeOrigin(origin), [origin]);

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

  const shortAddress = accountAddress
    ? `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`
    : "No account";
  const displayOrigin = originAnalysis.hostname;

  const handleApprove = async (e: React.MouseEvent) => {
    if (!e.isTrusted) return;
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

  const handleReject = async (e: React.MouseEvent) => {
    if (!e.isTrusted) return;
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

  return {
    origin,
    favicon,
    title,
    shortAddress,
    displayOrigin,
    originAnalysis,
    isKnownOrigin,
    isLoading,
    error,
    handleApprove,
    handleReject,
    dismissError: () => setError(null),
  };
}
