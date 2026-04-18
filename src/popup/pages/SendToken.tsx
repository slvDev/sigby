/**
 * Send Token Page
 * Send ERC-20 tokens to another address
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useWalletStore } from "../store";
import { popupPortoService } from "../portoService";
import { useToast } from "../components/common";
import { TokenIcon, FeeTokenSelector } from "../components/token";
import { encodeTransfer, parseTokenAmount } from "../../utils/erc20Abi";
import type { TokenBalance } from "../../types/account";
import type { FeeToken } from "../../types/porto";

export function SendToken() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { address: tokenAddress } = useParams<{ address: string }>();
  const location = useLocation();
  const { activeAddress, chainId, addPendingTransaction } = useWalletStore();

  // Token data passed via location state
  const token = location.state?.token as TokenBalance | undefined;

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeTokens, setFeeTokens] = useState<FeeToken[]>([]);
  const [selectedFeeToken, setSelectedFeeToken] = useState<string>("");

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  // Fetch available fee tokens on mount
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
          // Default to first token (usually ETH)
          if (tokens.length > 0 && !selectedFeeToken) {
            setSelectedFeeToken(tokens[0].symbol);
          }
          console.log("[SendToken] Available fee tokens:", tokens);
        }
      } catch (err) {
        console.warn("[SendToken] Failed to fetch fee tokens:", err);
      }
    }
    fetchFeeTokens();
  }, [chainId]);

  // If no token data, show error
  if (!token || !tokenAddress) {
    return (
      <div className="flex flex-col min-h-[600px] w-[400px] bg-white p-6">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <button
            onClick={() => navigate("/tokens")}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Send Token</h2>
        </div>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Token not found. Please go back and select a token.
        </div>
      </div>
    );
  }

  // Parse token balance for validation (raw units)
  const tokenBalanceRaw = BigInt(token.balance);

  const handleSetMax = () => {
    setAmount(token.formatted);
  };

  const handleSend = async () => {
    if (!recipient || !amount) {
      setError("Please fill in all fields");
      return;
    }

    if (!isValidAddress(recipient)) {
      setError("Invalid recipient address");
      return;
    }

    // Parse amount to raw units for validation
    const amountRaw = parseTokenAmount(amount, token.decimals);
    if (amountRaw <= 0n) {
      setError("Invalid amount");
      return;
    }

    // Check if user has sufficient balance (compare raw units)
    if (amountRaw > tokenBalanceRaw) {
      setError(`Insufficient balance. You have ${token.formatted} ${token.symbol}`);
      return;
    }

    // Prevent sending to self
    if (activeAddress && recipient.toLowerCase() === activeAddress.toLowerCase()) {
      setError("Cannot send to your own address");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Encode ERC-20 transfer call (amountRaw already calculated above)
      const data = encodeTransfer(recipient, amountRaw);

      // Submit via wallet_sendCalls; useTransactionWatcher polls for status
      // in the background so we don't double-poll here.
      const bundleId = await popupPortoService.sendCalls({
        from: activeAddress!,
        to: token.address, // Token contract address
        value: "0x0", // No ETH value
        data: data,
        chainId: chainId,
        ...(selectedFeeToken && { feeToken: selectedFeeToken }), // Gas payment token
      });

      addPendingTransaction({
        id: bundleId,
        chainId: chainId,
        timestamp: Date.now(),
      });

      // Show success toast and navigate to history
      showToast({
        type: "success",
        message: "Transaction submitted!",
      });
      navigate("/history");
    } catch (err) {
      console.error("[SendToken] Failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[600px] w-[400px] bg-white p-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-2">
          <TokenIcon
            symbol={token.symbol}
            address={token.address}
            logoUrl={token.logoUrl}
            size="sm"
          />
          <h2 className="text-lg font-semibold text-gray-900">Send {token.symbol}</h2>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5 mt-6 flex-1">
        {/* Recipient Address */}
        <div className="flex flex-col gap-2">
          <label htmlFor="recipient" className="text-sm font-medium text-gray-700">
            Recipient Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl
                       placeholder:text-gray-400
                       focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                       disabled:bg-gray-100 disabled:cursor-not-allowed
                       transition-colors"
          />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-2">
          <label htmlFor="amount" className="text-sm font-medium text-gray-700">
            Amount ({token.symbol})
          </label>
          <div className="relative">
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="any"
              min="0"
              disabled={isLoading}
              className="w-full px-4 py-3 pr-16 text-sm border-2 border-gray-200 rounded-xl
                         placeholder:text-gray-400
                         focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                         disabled:bg-gray-100 disabled:cursor-not-allowed
                         transition-colors"
            />
            <button
              type="button"
              onClick={handleSetMax}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100 disabled:opacity-50 transition-colors"
            >
              MAX
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Available: {token.formatted} {token.symbol}
          </p>
        </div>

        {/* Fee Token Selector */}
        {feeTokens.length > 0 && (
          <FeeTokenSelector
            tokens={feeTokens}
            selected={selectedFeeToken}
            onChange={setSelectedFeeToken}
            disabled={isLoading}
          />
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => navigate(-1)}
            disabled={isLoading}
            className="flex-1 px-4 py-3.5 text-sm font-semibold text-gray-900 bg-gray-100
                       rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !recipient || !amount}
            className="flex-1 px-4 py-3.5 text-sm font-semibold text-white bg-primary-600
                       rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
