/**
 * FeeTokenDropdown Component
 * Dropdown for selecting which token to pay gas fees
 * Only shows tokens that Porto actually supports (from capabilities)
 */

import { useState, useEffect, useRef } from "react";
import type { FeeToken } from "../../../types/porto";
import { TokenIcon } from "./TokenIcon";

interface FeeTokenDropdownProps {
  /** Available fee tokens from capabilities */
  tokens: FeeToken[];
  /** Currently selected token symbol */
  selected: string;
  /** Callback when selection changes */
  onChange: (token: string) => void;
  /** Disable the dropdown */
  disabled?: boolean;
}

export function FeeTokenDropdown({
  tokens,
  selected,
  onChange,
  disabled = false,
}: FeeTokenDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get display info for selected token
  const selectedToken = tokens.find((t) => t.symbol === selected) || tokens[0];

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    setIsOpen(false);
  };

  // Don't render if no tokens available
  if (!tokens.length || !selectedToken) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="text-xs font-medium text-gray-500 mb-1.5">Pay gas with</div>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          px-3 py-2.5
          bg-gray-50 hover:bg-gray-100
          border border-gray-200
          rounded-xl
          transition-colors
          text-sm font-medium text-gray-700
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-2">
          <TokenIcon
            symbol={selectedToken.symbol}
            address={selectedToken.address}
            size="sm"
          />
          <span>{selectedToken.symbol}</span>
        </div>
        {tokens.length > 1 && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && tokens.length > 1 && (
        <div
          className="
            absolute top-full left-0 right-0 mt-1
            bg-white
            rounded-xl
            shadow-lg shadow-black/10
            border border-gray-100
            overflow-hidden
            z-50
          "
          role="listbox"
          aria-label="Select fee token"
        >
          <div className="max-h-[200px] overflow-y-auto py-1">
            {tokens.map((token) => {
              const isSelected = selected === token.symbol;
              return (
                <button
                  key={token.address}
                  onClick={() => handleSelect(token.symbol)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5
                    hover:bg-gray-50 transition-colors
                    ${isSelected ? "bg-primary-50" : ""}
                  `}
                  role="option"
                  aria-selected={isSelected}
                >
                  <TokenIcon symbol={token.symbol} address={token.address} size="sm" />
                  <span className="flex-1 text-left text-sm font-medium text-gray-700">
                    {token.symbol}
                  </span>
                  {isSelected && (
                    <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
