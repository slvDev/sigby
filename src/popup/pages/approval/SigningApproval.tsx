/**
 * Signing Approval Page
 * Shown when a dApp requests a message signature
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, SigningRequest } from "../../../types/messages";
import { popupPortoService } from "../../portoService";
import { errorToString } from "../../../utils/rpcError";
import { analyzeOrigin } from "../../utils/originCheck";
import { OriginSecurityBanner } from "../../components/approvals/OriginSecurityBanner";

export function SigningApproval() {
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

  const handleApprove = async () => {
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

  // Returns raw decoded text; React JSX auto-escapes when we render it as a text child.
  const decodeMessage = (hex: string): string => {
    if (!hex || !hex.startsWith("0x")) {
      return String(hex || "");
    }
    try {
      const bytes = hex.slice(2).match(/.{1,2}/g) || [];
      const decoded = bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
      // If the payload looks like text (UTF-8-safe printable + common whitespace), show it;
      // otherwise fall back to the hex so users aren't shown mojibake they can't verify.
      return /^[\x20-\x7E\n\r\t]*$/.test(decoded) ? decoded : hex;
    } catch {
      return hex;
    }
  };

  const formatTypedData = (data: any): string => {
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(data);
    }
  };

  // Pull out the EIP-712 domain so chainId + verifyingContract are the first
  // thing the user sees — phishers swap these to get someone to sign a
  // seaport/permit on the wrong chain or for the wrong contract.
  const parseTypedDataDomain = (
    data: any
  ): { name?: string; chainId?: string | number; verifyingContract?: string } | null => {
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const domain = parsed?.domain;
      if (!domain || typeof domain !== "object") return null;
      return {
        name: typeof domain.name === "string" ? domain.name : undefined,
        chainId: domain.chainId,
        verifyingContract:
          typeof domain.verifyingContract === "string" ? domain.verifyingContract : undefined,
      };
    } catch {
      return null;
    }
  };

  // Invisible / directional chars that can hide content in a signed message:
  // \u200B-\u200F  zero-width + LRM/RLM
  // \u202A-\u202E  BIDI embeddings + LRO/RLO overrides
  // \u2066-\u2069  BIDI isolates
  const INVISIBLE_CHAR_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/;
  const hasInvisibleChars = (s: string): boolean => INVISIBLE_CHAR_RE.test(s);

  if (isFetching) {
    return (
      <div className="w-[400px] min-h-[600px] bg-white flex items-center justify-center text-gray-500">
        Loading request...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col min-h-[600px] p-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Signature Request</h2>
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

  const originAnalysis = useMemo(
    () => analyzeOrigin(request.origin || ""),
    [request.origin]
  );
  const displayOrigin = originAnalysis.hostname;
  const isPersonalSign = request.method === "personal_sign";
  const rawTypedData = isPersonalSign
    ? null
    : (request.params?.[1] ?? request.params?.[0]);
  const messageContent = isPersonalSign
    ? decodeMessage(request.params?.[0] || "")
    : formatTypedData(rawTypedData);
  const typedDataDomain = isPersonalSign ? null : parseTypedDataDomain(rawTypedData);

  return (
    <div className="flex flex-col min-h-[600px] p-6 gap-4">
      {/* Header */}
      <div className="text-center pb-3 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">
          {isPersonalSign ? "Signature Request" : "Typed Data Signature"}
        </h2>
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
      <OriginSecurityBanner analysis={originAnalysis} />

      {/* Typed-data domain summary — shown before the raw JSON so the user
          sees chainId + verifyingContract without scrolling. */}
      {typedDataDomain && (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-xl text-xs text-gray-700 space-y-1">
          {typedDataDomain.name && (
            <div>
              <span className="text-gray-500">Domain:</span>{" "}
              <span className="font-medium">{typedDataDomain.name}</span>
            </div>
          )}
          {typedDataDomain.chainId !== undefined && (
            <div>
              <span className="text-gray-500">Chain ID:</span>{" "}
              <span className="font-mono">
                {typeof typedDataDomain.chainId === "string"
                  ? typedDataDomain.chainId
                  : String(typedDataDomain.chainId)}
              </span>
            </div>
          )}
          {typedDataDomain.verifyingContract && (
            <div className="break-all">
              <span className="text-gray-500">Verifying contract:</span>{" "}
              <span className="font-mono">{typedDataDomain.verifyingContract}</span>
            </div>
          )}
        </div>
      )}

      {/* Message Content */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          {isPersonalSign ? "Message to sign:" : "Typed data to sign:"}
        </div>
        {hasInvisibleChars(messageContent) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            This message contains invisible or directional characters that can
            disguise its true content. Review carefully before signing.
          </div>
        )}
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-[300px]">
          <pre className="font-mono text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words m-0">
            {messageContent}
          </pre>
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
          {isLoading ? "Signing..." : "Sign"}
        </button>
      </div>
    </div>
  );
}
