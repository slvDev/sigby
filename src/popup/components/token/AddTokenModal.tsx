/**
 * AddTokenModal Component
 * Modal for adding a custom ERC-20 token by contract address
 */

import { useState } from "react";
import { MessageType } from "../../../types/messages";
import type { TokenBalance } from "../../../types/account";
import { errorToString } from "../../../utils/rpcError";

interface AddTokenModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Success handler with added token */
  onSuccess: (token: TokenBalance) => void;
  /** Current account address */
  accountAddress: string;
  /** Current chain ID */
  chainId: number;
  /** Chain name for display */
  chainName?: string;
}

export function AddTokenModal({
  isOpen,
  onClose,
  onSuccess,
  accountAddress,
  chainId,
  chainName = "current network",
}: AddTokenModalProps) {
  const [tokenAddress, setTokenAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setTokenAddress("");
    setError(null);
    setIsLoading(false);
    onClose();
  };

  // Validate Ethereum address format
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedAddress = tokenAddress.trim();

    // Validate address format
    if (!isValidAddress(trimmedAddress)) {
      setError("Invalid token address. Must be a valid Ethereum address (0x...)");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.ADD_CUSTOM_TOKEN,
        payload: {
          accountAddress,
          tokenAddress: trimmedAddress,
          chainId,
        },
      });

      if (response.success && response.data) {
        onSuccess(response.data);
        handleClose();
      } else {
        setError(errorToString(response.error) || "Failed to add token. Make sure it's a valid ERC-20 contract.");
      }
    } catch (err) {
      console.error("[AddTokenModal] Error adding token:", err);
      setError("Failed to add token. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-[350px] max-h-[80vh] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Token</h2>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label
              htmlFor="token-address"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Token Contract Address
            </label>
            <input
              id="token-address"
              type="text"
              value={tokenAddress}
              onChange={(e) => {
                setTokenAddress(e.target.value);
                setError(null);
              }}
              placeholder="0x..."
              disabled={isLoading}
              className={`
                w-full px-3 py-2.5
                border-2 rounded-xl
                font-mono text-sm
                focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-primary-500"}
              `}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Adding token on {chainName}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !tokenAddress.trim()}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Adding...
                </span>
              ) : (
                "Add Token"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
