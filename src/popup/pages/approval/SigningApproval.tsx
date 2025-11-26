/**
 * Signing Approval Page
 * Shown when a dApp requests a message signature
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, SigningRequest } from "../../../types/messages";
import { popupPortoService } from "../../portoService";

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
          setError(response.error || "Request not found");
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

  const decodeMessage = (hex: string): string => {
    if (!hex || !hex.startsWith("0x")) {
      // Sanitize non-hex strings to prevent XSS
      return String(hex || "").replace(/[<>&"']/g, (char) => {
        const escapeMap: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return escapeMap[char] || char;
      });
    }
    try {
      const bytes = hex.slice(2).match(/.{1,2}/g) || [];
      const decoded = bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
      // Only allow printable ASCII + common whitespace to prevent injection
      if (/^[\x20-\x7E\n\r\t]*$/.test(decoded)) {
        // Still sanitize even printable content
        return decoded.replace(/[<>&"']/g, (char) => {
          const escapeMap: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#39;'
          };
          return escapeMap[char] || char;
        });
      }
      return hex;
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

  const displayOrigin = request.origin?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Unknown";
  const isPersonalSign = request.method === "personal_sign";
  const messageContent = isPersonalSign
    ? decodeMessage(request.params?.[0] || "")
    : formatTypedData(request.params?.[1] || request.params?.[0]);

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

      {/* Message Content */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          {isPersonalSign ? "Message to sign:" : "Typed data to sign:"}
        </div>
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-[300px]">
          <pre
            className="font-mono text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words m-0"
            dangerouslySetInnerHTML={{ __html: messageContent }}
          />
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
