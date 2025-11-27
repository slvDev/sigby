/**
 * ChainSelector Component
 * Dropdown for switching between blockchain networks
 */

import { useState, useEffect, useRef } from "react";
import { useWalletStore, fetchAllBalances, clearBalanceCache } from "../../store";
import {
  CHAIN_CONFIGS,
  MAINNET_CHAIN_IDS,
  TESTNET_CHAIN_IDS,
} from "../../../utils/constants";
import { ChainIcon } from "./ChainIcon";
import { ChainList } from "./ChainList";

export function ChainSelector() {
  const { chainId, setChainId, showTestnets } = useWalletStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentChain = CHAIN_CONFIGS[chainId];

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    // Add listener on next tick to avoid closing immediately
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

  const handleSelectChain = async (newChainId: number) => {
    if (newChainId === chainId) {
      setIsOpen(false);
      return;
    }

    // Update store immediately (optimistic)
    setChainId(newChainId);
    setIsOpen(false);

    // Notify background to update default chain AND broadcast to all dApps
    try {
      await chrome.runtime.sendMessage({
        type: "SWITCH_CHAIN",
        payload: { chainId: newChainId },
      });

      // Clear and refetch balances for new chain
      clearBalanceCache();
      await fetchAllBalances(newChainId);
    } catch (error) {
      console.error("[ChainSelector] Failed to switch chain:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-1.5
          px-2.5 py-1.5
          bg-gray-100 hover:bg-gray-200
          rounded-lg
          transition-colors
          text-sm font-medium text-gray-700
        "
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <ChainIcon chainId={chainId} size="sm" />
        <span className="max-w-[80px] truncate">{currentChain?.shortName || "Unknown"}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="
            absolute top-full right-0 mt-2
            w-[220px]
            bg-white
            rounded-xl
            shadow-lg shadow-black/10
            border border-gray-100
            overflow-hidden
            z-50
          "
          role="listbox"
          aria-label="Select network"
        >
          <div className="max-h-[320px] overflow-y-auto">
            <ChainList
              chainIds={[...MAINNET_CHAIN_IDS]}
              selectedChainId={chainId}
              onSelect={handleSelectChain}
              title="Mainnets"
            />

            {showTestnets && (
              <>
                <div className="h-px bg-gray-100 mx-3" />
                <ChainList
                  chainIds={[...TESTNET_CHAIN_IDS]}
                  selectedChainId={chainId}
                  onSelect={handleSelectChain}
                  title="Testnets"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
