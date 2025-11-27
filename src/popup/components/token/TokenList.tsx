/**
 * TokenList Component
 * Renders a list of token balances with loading and empty states
 */

import type { TokenBalance } from "../../../types/account";
import { TokenItem } from "./TokenItem";

interface TokenListProps {
  /** Array of token balances to display */
  tokens: TokenBalance[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Token click handler */
  onTokenClick?: (token: TokenBalance) => void;
  /** Show remove buttons */
  showRemove?: boolean;
  /** Remove handler */
  onRemove?: (token: TokenBalance) => void;
  /** Empty state message */
  emptyMessage?: string;
}

export function TokenList({
  tokens,
  isLoading = false,
  error = null,
  onTokenClick,
  showRemove = false,
  onRemove,
  emptyMessage = "No tokens found",
}: TokenListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 animate-pulse"
          >
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-16 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
            <div className="text-right">
              <div className="h-4 bg-gray-200 rounded w-12 mb-1 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-red-600 text-center">{error}</p>
      </div>
    );
  }

  // Empty state
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500 text-center">{emptyMessage}</p>
      </div>
    );
  }

  // Token list
  return (
    <div className="flex flex-col">
      {tokens.map((token) => (
        <TokenItem
          key={`${token.address}-${token.symbol}`}
          token={token}
          onClick={onTokenClick}
          showRemove={showRemove}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
