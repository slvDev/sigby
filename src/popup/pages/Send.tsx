/**
 * Send Page
 * Send ETH to another address
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../store";
import { popupPortoService } from "../portoService";

export function Send() {
  const navigate = useNavigate();
  const { activeAddress, accounts } = useWalletStore();
  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const userBalance = activeAccount ? parseFloat(activeAccount.balance || "0") : 0;

  const handleSend = async () => {
    if (!recipient || !amount) {
      setError("Please fill in all fields");
      return;
    }

    if (!isValidAddress(recipient)) {
      setError("Invalid recipient address");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Invalid amount");
      return;
    }

    // Check if user has sufficient balance
    if (amountNum > userBalance) {
      setError(`Insufficient balance. You have ${userBalance} ETH`);
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
      // Convert ETH to wei (hex string)
      const valueWei = BigInt(Math.floor(amountNum * 1e18));
      const valueHex = "0x" + valueWei.toString(16);

      // Send via Porto SDK
      const result = await popupPortoService.sendTransaction({
        to: recipient,
        value: valueHex,
        data: "0x",
        chainId: 8453, // Base
      });

      console.log("[Send] Transaction sent:", result);

      // Show success and navigate back
      alert("Transaction sent!");
      navigate("/");
    } catch (err) {
      console.error("[Send] Failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeAccount) {
    return (
      <div className="flex flex-col min-h-[600px] w-[400px] bg-white p-6">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Send</h2>
        </div>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          No active account
        </div>
      </div>
    );
  }

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
        <h2 className="text-lg font-semibold text-gray-900">Send ETH</h2>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5 mt-6 flex-1">
        {/* Recipient Address */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="recipient"
            className="text-sm font-medium text-gray-700"
          >
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
          <label
            htmlFor="amount"
            className="text-sm font-medium text-gray-700"
          >
            Amount (ETH)
          </label>
          <input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.0001"
            min="0"
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl
                       placeholder:text-gray-400
                       focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                       disabled:bg-gray-100 disabled:cursor-not-allowed
                       transition-colors"
          />
          <p className="text-xs text-gray-500">
            Available: {userBalance.toFixed(4)} ETH
          </p>
        </div>

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
