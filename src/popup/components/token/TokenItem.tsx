/**
 * TokenItem Component
 * Individual token row showing balance and metadata
 */

import type { TokenBalance } from "../../../types/account";
import { TokenIcon } from "./TokenIcon";

interface TokenItemProps {
  /** Token balance data */
  token: TokenBalance;
  /** Click handler for token row */
  onClick?: (token: TokenBalance) => void;
  /** Show remove button */
  showRemove?: boolean;
  /** Remove handler */
  onRemove?: (token: TokenBalance) => void;
}

export function TokenItem({
  token,
  onClick,
  showRemove = false,
  onRemove,
}: TokenItemProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(token);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(token);
    }
  };

  return (
    <div
      className={`
        flex items-center gap-3
        px-4 py-3
        bg-white
        border-b border-gray-100
        last:border-b-0
        ${onClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}
      `}
      onClick={onClick ? handleClick : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      {/* Token Icon */}
      <TokenIcon
        symbol={token.symbol}
        address={token.address}
        logoUrl={token.logoUrl}
        size="md"
      />

      {/* Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {token.symbol}
          </span>
        </div>
        <div className="text-xs text-gray-400 truncate">{token.name}</div>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0">
        <div className="font-medium text-gray-900">
          {parseFloat(token.formatted).toLocaleString(undefined, {
            maximumFractionDigits: 6,
          })}
        </div>
        {token.usdValue && (
          <div className="text-xs text-gray-400">
            ${parseFloat(token.usdValue).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        )}
      </div>

      {/* Remove Button */}
      {showRemove && onRemove && (
        <button
          onClick={handleRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          aria-label={`Remove ${token.symbol}`}
        >
          <svg
            className="w-4 h-4"
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
      )}
    </div>
  );
}
