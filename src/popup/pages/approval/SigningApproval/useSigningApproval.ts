import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, SigningRequest } from "../../../../types/messages";
import { popupPortoService } from "../../../portoService";
import { errorToString } from "../../../../utils/rpcError";
import { analyzeOrigin } from "../../../utils/originCheck";

// Raw decoded text; JSX renders as a text child so React auto-escapes.
function decodeMessage(hex: string): string {
  if (!hex || !hex.startsWith("0x")) return String(hex || "");
  try {
    const bytes = hex.slice(2).match(/.{1,2}/g) || [];
    const decoded = bytes
      .map((b) => String.fromCharCode(parseInt(b, 16)))
      .join("");
    // Show as text only when it's UTF-8-safe printable + common whitespace —
    // otherwise fall back to hex rather than show mojibake.
    return /^[\x20-\x7E\n\r\t]*$/.test(decoded) ? decoded : hex;
  } catch {
    return hex;
  }
}

function formatTypedData(data: any): string {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(data);
  }
}

// Surface EIP-712 domain before the raw JSON — phishers swap chainId /
// verifyingContract to trick users into signing on the wrong chain.
function parseTypedDataDomain(
  data: any
): { name?: string; chainId?: string | number; verifyingContract?: string } | null {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    const domain = parsed?.domain;
    if (!domain || typeof domain !== "object") return null;
    return {
      name: typeof domain.name === "string" ? domain.name : undefined,
      chainId: domain.chainId,
      verifyingContract:
        typeof domain.verifyingContract === "string"
          ? domain.verifyingContract
          : undefined,
    };
  } catch {
    return null;
  }
}

// Invisible / directional chars that can hide content in a signed message:
// \u200B-\u200F  zero-width + LRM/RLM
// \u202A-\u202E  BIDI embeddings + LRO/RLO overrides
// \u2066-\u2069  BIDI isolates
const INVISIBLE_CHAR_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/;
const hasInvisibleChars = (s: string): boolean => INVISIBLE_CHAR_RE.test(s);

export function useSigningApproval() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SigningRequest | null>(null);

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
        } else {
          setError(errorToString(response.error) || "Request not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch request");
      } finally {
        setIsFetching(false);
      }
    }
    fetchRequest();
  }, [requestId]);

  // Hoisted hook — must run before any early return (React hook-order rule).
  const originAnalysis = useMemo(
    () => analyzeOrigin(request?.origin || ""),
    [request?.origin]
  );

  const handleApprove = async (e: React.MouseEvent) => {
    if (!e.isTrusted) return;
    if (!request) return;
    setIsLoading(true);
    setError(null);
    try {
      let result: string;
      if (request.method === "personal_sign") {
        const message = request.params?.[0] || "";
        const account = request.params?.[1] || request.accountAddress;
        result = await popupPortoService.signMessage(message, account);
      } else {
        const account = request.params?.[0] || request.accountAddress;
        const typedData = request.params?.[1] || request.params?.[0];
        result = await popupPortoService.signTypedData(typedData, account);
      }
      await chrome.runtime.sendMessage({
        type: MessageType.APPROVE_SIGNING,
        payload: { requestId, result },
      });
      window.close();
    } catch (err) {
      console.error("Signing failed:", err);
      setError(err instanceof Error ? err.message : "Signing failed");
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

  // Derived — safe only when request loaded; view guards.
  const isPersonalSign = request?.method === "personal_sign";
  const rawTypedData =
    isPersonalSign || !request
      ? null
      : request.params?.[1] ?? request.params?.[0];
  const messageContent = request
    ? isPersonalSign
      ? decodeMessage(request.params?.[0] || "")
      : formatTypedData(rawTypedData)
    : "";
  const typedDataDomain = isPersonalSign
    ? null
    : parseTypedDataDomain(rawTypedData);
  const displayOrigin = originAnalysis.hostname;

  return {
    request,
    isFetching,
    isLoading,
    error,
    isPersonalSign,
    messageContent,
    typedDataDomain,
    displayOrigin,
    originAnalysis,
    hasInvisibleChars: hasInvisibleChars(messageContent),
    handleApprove,
    handleReject,
    handleClose,
    dismissError: () => setError(null),
  };
}
