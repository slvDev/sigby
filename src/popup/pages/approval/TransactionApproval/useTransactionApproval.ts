import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageType, SigningRequest } from "../../../../types/messages";
import type { FeeToken } from "../../../../types/porto";
import { popupPortoService } from "../../../portoService";
import { errorToString } from "../../../../utils/rpcError";
import { analyzeOrigin } from "../../../utils/originCheck";
import { CHAIN_CONFIGS } from "../../../../utils/constants";
import { useWalletStore } from "../../../store";
import { getAddress, isAddress } from "viem";

export function useTransactionApproval() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [feeTokens, setFeeTokens] = useState<FeeToken[]>([]);
  const [selectedFeeToken, setSelectedFeeToken] = useState<string>("");
  // When a dApp puts capabilities.feeToken on wallet_sendCalls, it's a hard
  // requirement (merchant wants payment in USDC etc.) — lock the picker.
  const [dappRequiredFeeToken, setDappRequiredFeeToken] = useState<string | null>(
    null
  );
  const awaitCelebration = useWalletStore((s) => s.awaitCelebration);

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
              if (gasResponse.success) setGasEstimate(gasResponse.data);
            } catch (e) {
              console.warn("Gas estimation failed:", e);
            }
          }

          // Parse dApp-pinned fee token (wallet_sendCalls only).
          let required: string | null = null;
          if (response.data.method === "wallet_sendCalls") {
            const raw = response.data.params?.[0]?.capabilities?.feeToken;
            required = typeof raw === "string" ? raw : raw?.symbol ?? null;
          }
          setDappRequiredFeeToken(required);

          try {
            const capabilities = await popupPortoService.getCapabilities(
              response.data.chainId
            );
            if (
              capabilities?.feeToken?.supported &&
              capabilities.feeToken.tokens?.length > 0
            ) {
              const tokens = capabilities.feeToken.tokens;
              setFeeTokens(tokens);
              const pinned =
                required && tokens.find((t) => t.symbol === required);
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

  // Hoisted hook — must run before any early return (React hook-order rule).
  const originAnalysis = useMemo(
    () => analyzeOrigin(request?.origin || ""),
    [request?.origin]
  );

  const handleApprove = async (e: React.MouseEvent) => {
    if (!e.isTrusted) return;
    if (!request) return;

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
      const feeToken =
        dappRequiredFeeToken ?? selectedFeeToken ?? feeTokens[0]?.symbol;

      if (request.method === "wallet_sendCalls") {
        // EIP-5792 raw pass-through preserves the dApp's full calls/
        // capabilities shape. sendCallsRaw handles the provider call.
        await popupPortoService.ensureAccountAuthorized(request.accountAddress);

        const callsParam = request.params[0] || {};
        const { feeToken: _dappFeeToken, ...otherCapabilities } =
          callsParam.capabilities || {};
        const rawParams = {
          ...callsParam,
          capabilities: { ...otherCapabilities, feeToken },
        };

        result = await popupPortoService.sendCallsRaw(rawParams);
      } else {
        const tx = request.params?.[0] || {};
        result = await popupPortoService.sendTransaction({
          from: tx.from,
          to: tx.to,
          value: tx.value,
          data: tx.data,
          chainId: request.chainId,
          feeToken,
        });
      }

      await chrome.runtime.sendMessage({
        type: MessageType.APPROVE_SIGNING,
        payload: { requestId, result },
      });

      // Order: isTrusted → sign → approve message → celebrate+settle → close.
      // The settle gives the CTA's CelebrationGlow frames to play before
      // `chrome.windows.create` tears the window down.
      // Background's handleApproveSigning writes the unlock-session
      // stamp atomically before resolving the dApp promise.
      await awaitCelebration("passkey-success");
      window.close();
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
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

  // Derived shape — safe to compute only when request is loaded; view guards.
  const isWalletSendCalls = request?.method === "wallet_sendCalls";
  const requestParams = request?.params?.[0] || {};
  const calls = isWalletSendCalls
    ? requestParams.calls || []
    : request
      ? [requestParams]
      : [];
  const displayOrigin = originAnalysis.hostname;
  const nativeSymbol = request
    ? CHAIN_CONFIGS[request.chainId]?.nativeCurrency.symbol || "ETH"
    : "ETH";

  const formatCall = (call: any) => {
    const toRaw = typeof call.to === "string" ? call.to : "";
    const to = toRaw && isAddress(toRaw) ? getAddress(toRaw) : toRaw;
    const valueInEth = call.value
      ? (parseInt(call.value, 16) / 1e18).toFixed(6)
      : "0";
    return { to, valueInEth, data: call.data };
  };

  const gasHex = gasEstimate || requestParams.gas || requestParams.gasLimit;
  const gasDecimal = gasHex ? parseInt(gasHex, 16).toLocaleString() : "Unknown";

  return {
    request,
    isFetching,
    isLoading,
    error,
    isWalletSendCalls,
    calls,
    displayOrigin,
    originAnalysis,
    nativeSymbol,
    gasDecimal,
    feeTokens,
    selectedFeeToken,
    setSelectedFeeToken,
    dappRequiredFeeToken,
    formatCall,
    handleApprove,
    handleReject,
    handleClose,
    dismissError: () => setError(null),
  };
}
