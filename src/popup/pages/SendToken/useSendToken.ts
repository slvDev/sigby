import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";
import { useToast } from "../../components/common";
import { encodeTransfer, parseTokenAmount } from "../../../utils/erc20Abi";
import type { TokenBalance } from "../../../types/account";
import type { FeeToken } from "../../../types/porto";

const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

export function useSendToken() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { address: tokenAddress } = useParams<{ address: string }>();
  const location = useLocation();
  const { activeAddress, chainId, addPendingTransaction } = useWalletStore();

  const token = location.state?.token as TokenBalance | undefined;

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeTokens, setFeeTokens] = useState<FeeToken[]>([]);
  const [selectedFeeToken, setSelectedFeeToken] = useState<string>("");

  useEffect(() => {
    async function fetchFeeTokens() {
      try {
        if (!popupPortoService.isReady()) {
          await popupPortoService.initialize();
        }
        const capabilities = await popupPortoService.getCapabilities(chainId);
        if (capabilities?.feeToken?.supported && capabilities.feeToken.tokens) {
          const tokens = capabilities.feeToken.tokens;
          setFeeTokens(tokens);
          if (tokens.length > 0 && !selectedFeeToken) {
            setSelectedFeeToken(tokens[0].symbol);
          }
        }
      } catch (err) {
        console.warn("[SendToken] Failed to fetch fee tokens:", err);
      }
    }
    fetchFeeTokens();
  }, [chainId]);

  const tokenBalanceRaw = token ? BigInt(token.balance) : 0n;

  const handleSetMax = () => {
    if (token) setAmount(token.formatted);
  };

  const handleSend = async () => {
    if (!token) return;
    if (!recipient || !amount) {
      setError("Please fill in all fields");
      return;
    }
    if (!isValidAddress(recipient)) {
      setError("Invalid recipient address");
      return;
    }
    const amountRaw = parseTokenAmount(amount, token.decimals);
    if (amountRaw <= 0n) {
      setError("Invalid amount");
      return;
    }
    if (amountRaw > tokenBalanceRaw) {
      setError(`Insufficient balance. You have ${token.formatted} ${token.symbol}`);
      return;
    }
    if (activeAddress && recipient.toLowerCase() === activeAddress.toLowerCase()) {
      setError("Cannot send to your own address");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = encodeTransfer(recipient, amountRaw);
      const bundleId = await popupPortoService.sendCalls({
        from: activeAddress!,
        to: token.address,
        value: "0x0",
        data,
        chainId,
        ...(selectedFeeToken && { feeToken: selectedFeeToken }),
      });

      addPendingTransaction({ id: bundleId, chainId, timestamp: Date.now() });
      showToast({ type: "success", message: "Transaction submitted!" });
      navigate("/history");
    } catch (err) {
      console.error("[SendToken] Failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => navigate(-1);
  const handleGoToTokens = () => navigate("/");

  return {
    token,
    tokenAddress,
    recipient,
    setRecipient,
    amount,
    setAmount,
    isLoading,
    error,
    feeTokens,
    selectedFeeToken,
    setSelectedFeeToken,
    handleSetMax,
    handleSend,
    handleBack,
    handleGoToTokens,
    dismissError: () => setError(null),
  };
}
