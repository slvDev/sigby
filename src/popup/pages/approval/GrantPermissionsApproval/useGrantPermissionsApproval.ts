import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, type SigningRequest } from "../../../../types/messages";
import type { PermissionRequest } from "../../../../types/porto";
import { popupPortoService } from "../../../portoService";
import { errorToString } from "../../../../utils/rpcError";
import { analyzeOrigin } from "../../../utils/originCheck";
import { useWalletStore } from "../../../store";

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatExpiry(unix: number): string {
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

export function useGrantPermissionsApproval() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const awaitCelebration = useWalletStore((s) => s.awaitCelebration);

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
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to fetch request");
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }
    fetchRequest();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Hoisted hook — must run before any early return (React hook-order rule).
  const originAnalysis = useMemo(
    () => analyzeOrigin(request?.origin || ""),
    [request?.origin]
  );

  const permissionRequest = request?.params?.[0] as
    | PermissionRequest
    | undefined;

  const handleApprove = async (e: React.MouseEvent) => {
    if (!e.isTrusted) return;
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
      // Order: isTrusted → grant → approve message → celebrate+settle → close.
      await awaitCelebration("passkey-success");
      window.close();
    } catch (err) {
      console.error("[GrantPermissionsApproval] failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to grant permissions"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    if (!e.isTrusted) return;
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

  const handleClose = () => window.close();

  return {
    request,
    permissionRequest,
    isFetching,
    isLoading,
    error,
    originAnalysis,
    displayOrigin: originAnalysis.hostname,
    handleApprove,
    handleReject,
    handleClose,
    dismissError: () => setError(null),
  };
}
