/**
 * Fee Token Selector Component
 * Dropdown to select which token to use for paying gas fees
 */

import type { FeeToken } from "../../../types/porto";

interface FeeTokenSelectorProps {
  /** Available fee tokens from wallet_getCapabilities */
  tokens: FeeToken[];
  /** Currently selected token ('native' or token symbol) */
  selected: string;
  /** Callback when selection changes */
  onChange: (token: string) => void;
  /** Disable the selector (e.g., during transaction) */
  disabled?: boolean;
}

export function FeeTokenSelector({
  tokens,
  selected,
  onChange,
  disabled = false,
}: FeeTokenSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="feeToken"
        className="text-sm font-medium text-gray-700"
      >
        Pay gas with
      </label>
      <select
        id="feeToken"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl
                   bg-white
                   focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                   disabled:bg-gray-100 disabled:cursor-not-allowed
                   transition-colors"
      >
        {tokens.map((token) => (
          <option key={token.address || token.symbol} value={token.symbol}>
            {token.symbol}
          </option>
        ))}
      </select>
    </div>
  );
}
