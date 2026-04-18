/**
 * Transaction Approval Page
 * Shown when a dApp requests to send a transaction
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, SigningRequest } from "../../../types/messages";
import type { FeeToken } from "../../../types/porto";
import { popupPortoService } from "../../portoService";
import { FeeTokenDropdown } from "../../components/token/FeeTokenDropdown";
import { errorToString } from "../../../utils/rpcError";
import { analyzeOrigin } from "../../utils/originCheck";
import { OriginSecurityBanner } from "../../components/approvals/OriginSecurityBanner";

export function TransactionApproval() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [feeTokens, setFeeTokens] = useState<FeeToken[]>([]);
  const [selectedFeeToken, setSelectedFeeToken] = useState<string>("");
  // When the dApp puts `capabilities.feeToken` on a wallet_sendCalls request,
  // that's a hard requirement (e.g. merchant wants payment in USDC); we lock
  // the picker to it instead of silently overriding the dApp's choice.
  const [dappRequiredFeeToken, setDappRequiredFeeToken] = useState<string | null>(null);

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

          const tx = response.data.params?.[0];
          if (tx) {
            try {
              const gasResponse = await chrome.runtime.sendMessage({
                type: MessageType.DAPP_REQUEST,
                payload: {
                  method: "eth_estimateGas",
                  params: [tx],
                  origin: response.data.origin,
                },
              });
              if (gasResponse.success) {
                setGasEstimate(gasResponse.data);
              }
            } catch (e) {
              console.warn("Gas estimation failed:", e);
            }
          }

          // Parse any dApp-required fee token (wallet_sendCalls only — the
          // capabilities slot doesn't exist on legacy eth_sendTransaction).
          let required: string | null = null;
          if (response.data.method === "wallet_sendCalls") {
            const raw = response.data.params?.[0]?.capabilities?.feeToken;
            required = typeof raw === "string" ? raw : raw?.symbol ?? null;
          }
          setDappRequiredFeeToken(required);

          // Fetch available fee tokens from capabilities
          try {
            const capabilities = await popupPortoService.getCapabilities(response.data.chainId);
            if (capabilities?.feeToken?.supported && capabilities.feeToken.tokens?.length > 0) {
              const tokens = capabilities.feeToken.tokens;
              setFeeTokens(tokens);
              // If the dApp pinned a fee token and it's available, select it
              // and leave it locked. Otherwise default to first.
              const pinned = required && tokens.find((t) => t.symbol === required);
              setSelectedFeeToken(pinned ? pinned.symbol : tokens[0].symbol);
            }
          } catch (e) {
            console.warn("Failed to fetch fee tokens:", e);
          }
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

    // Block approval if the dApp pinned a fee token we can't honour.
    if (
      dappRequiredFeeToken &&
      feeTokens.length > 0 &&
      !feeTokens.some((t) => t.symbol === dappRequiredFeeToken)
    ) {
      setError(
        `This dApp requires ${dappRequiredFeeToken} for gas, which isn't available on this chain.`
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result: string;

      // If the dApp pinned a fee token, always honour it; otherwise use the
      // user's selection (falling back to the first available token).
      const feeToken = dappRequiredFeeToken ?? selectedFeeToken ?? feeTokens[0]?.symbol;

      if (request.method === "wallet_sendCalls") {
        // EIP-5792 raw pass-through: we keep the dApp's full calls/
        // capabilities shape (multi-call, merchant pins, etc.) instead of
        // reducing to single-call. sendCallsRaw handles the provider call.
        await popupPortoService.ensureAccountAuthorized(request.accountAddress);

        const callsParam = request.params[0] || {};
        const { feeToken: _dappFeeToken, ...otherCapabilities } = callsParam.capabilities || {};
        const rawParams = {
          ...callsParam,
          capabilities: {
            ...otherCapabilities,
            feeToken,
          },
        };

        result = await popupPortoService.sendCallsRaw(rawParams);
        console.log("[TransactionApproval] wallet_sendCalls bundleId:", result, "feeToken:", feeToken);
      } else {
        // Legacy eth_sendTransaction - waits for txHash
        const tx = request.params?.[0] || {};
        result = await popupPortoService.sendTransaction({
          from: tx.from,
          to: tx.to,
          value: tx.value,
          data: tx.data,
          chainId: request.chainId,
          feeToken, // Pass selected fee token (including "native" for ETH)
        });
      }

      await chrome.runtime.sendMessage({
        type: MessageType.APPROVE_SIGNING,
        payload: { requestId, result },
      });

      window.close();
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
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

  if (isFetching) {
    return (
      <div className="w-[400px] min-h-[600px] bg-white flex items-center justify-center text-gray-500">
        Loading transaction...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col min-h-[600px] p-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Transaction Request</h2>
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

  // Handle both eth_sendTransaction (single tx) and wallet_sendCalls (calls array)
  const isWalletSendCalls = request.method === "wallet_sendCalls";
  const requestParams = request.params?.[0] || {};

  // For wallet_sendCalls: { calls: [...], chainId, from, capabilities }
  // For eth_sendTransaction: { to, value, data, ... }
  const calls = isWalletSendCalls ? (requestParams.calls || []) : [requestParams];
  const originAnalysis = useMemo(
    () => analyzeOrigin(request.origin || ""),
    [request.origin]
  );
  const displayOrigin = originAnalysis.unicodeHostname ?? originAnalysis.hostname;

  // Helper function to format a single call
  const formatCall = (call: any) => {
    const shortTo = call.to ? `${call.to.slice(0, 10)}...${call.to.slice(-8)}` : "Contract creation";
    const valueInEth = call.value ? (parseInt(call.value, 16) / 1e18).toFixed(6) : "0";
    return { shortTo, valueInEth, data: call.data };
  };

  const gasHex = gasEstimate || requestParams.gas || requestParams.gasLimit;
  const gasDecimal = gasHex ? parseInt(gasHex, 16).toLocaleString() : "Unknown";

  return (
    <div className="flex flex-col min-h-[600px] p-6 gap-4">
      {/* Header */}
      <div className="text-center pb-3 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">
          {isWalletSendCalls && calls.length > 1 ? "Batch Transaction" : "Transaction Request"}
        </h2>
        {isWalletSendCalls && calls.length > 1 && (
          <p className="text-sm text-gray-500 mt-1">{calls.length} transactions</p>
        )}
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

      {/* Transaction Details */}
      <div className="flex-1 overflow-auto space-y-3">
        {calls.map((call: any, index: number) => {
          const { shortTo, valueInEth, data } = formatCall(call);
          return (
            <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
              {calls.length > 1 && (
                <div className="text-xs font-medium text-gray-400 uppercase">
                  Transaction {index + 1}
                </div>
              )}
              <div className="flex justify-between items-start gap-3">
                <span className="text-sm text-gray-500">To:</span>
                <span className="font-medium text-gray-900 font-mono text-sm text-right">
                  {shortTo}
                </span>
              </div>
              <div className="flex justify-between items-start gap-3">
                <span className="text-sm text-gray-500">Value:</span>
                <span className="font-medium text-gray-900">{valueInEth} ETH</span>
              </div>
              {data && data !== "0x" && (
                <div className="flex justify-between items-start gap-3">
                  <span className="text-sm text-gray-500">Data:</span>
                  <span className="font-mono text-xs text-gray-600 text-right max-w-[200px] truncate">
                    {data.length > 20 ? `${data.slice(0, 20)}...` : data}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {!isWalletSendCalls && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex justify-between items-start gap-3">
              <span className="text-sm text-gray-500">Est. Gas:</span>
              <span className="font-medium text-gray-900">{gasDecimal}</span>
            </div>
          </div>
        )}
      </div>

      {/* Fee Token Selector */}
      {feeTokens.length > 0 && (
        <div className="space-y-1">
          <FeeTokenDropdown
            tokens={feeTokens}
            selected={selectedFeeToken}
            onChange={setSelectedFeeToken}
            disabled={isLoading || dappRequiredFeeToken !== null}
          />
          {dappRequiredFeeToken && (
            <p className="text-xs text-gray-500 px-1">
              {feeTokens.some((t) => t.symbol === dappRequiredFeeToken)
                ? `${dappRequiredFeeToken} is required by this dApp.`
                : `${dappRequiredFeeToken} is required by this dApp but isn't available on this chain.`}
            </p>
          )}
        </div>
      )}

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
          {isLoading ? "Signing..." : "Approve"}
        </button>
      </div>
    </div>
  );
}
