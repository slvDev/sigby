/**
 * Header Component
 * Displays account switcher and chain badge
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore, syncStoreWithBackground } from "../../store";
import { ChainSelector } from "../chain";
import { ConfirmModal, IconButton } from "../common";
import { errorToString } from "../../../utils/rpcError";

export function Header() {
  const {
    accounts,
    accountOrder,
    activeAddress,
    setLoading,
    setError,
  } = useWalletStore();

  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteAddress, setDeleteAddress] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const orderedAccounts = accountOrder
    .map((addr) => accounts[addr])
    .filter(Boolean);

  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
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
  }, [isDropdownOpen]);

  const handleSwitchAccount = async (address: string) => {
    if (address === activeAddress) {
      setIsDropdownOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "SWITCH_ACCOUNT",
        payload: { address },
      });

      if (response.success) {
        await syncStoreWithBackground();
      } else {
        setError(errorToString(response.error) || "Failed to switch account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to switch account");
    } finally {
      setLoading(false);
      setIsDropdownOpen(false);
    }
  };

  const handleStartRename = (address: string, currentName: string) => {
    setEditingAddress(address);
    setEditName(currentName);
  };

  const handleSaveRename = async (address: string) => {
    if (!editName.trim()) {
      setEditingAddress(null);
      return;
    }

    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "UPDATE_ACCOUNT",
        payload: { address, displayName: editName.trim() },
      });

      if (response.success) {
        await syncStoreWithBackground();
      } else {
        setError(errorToString(response.error) || "Failed to rename account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to rename account");
    } finally {
      setLoading(false);
      setEditingAddress(null);
    }
  };

  const handleDeleteAccount = async (address: string) => {
    setDeleteAddress(null);
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "DELETE_ACCOUNT",
        payload: { address },
      });

      if (response.success) {
        await syncStoreWithBackground();
      } else {
        setError(errorToString(response.error) || "Failed to delete account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  if (!activeAccount) return null;

  return (
    <header className="flex items-center justify-between p-4 border-b border-gray-100">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteAddress}
        onClose={() => setDeleteAddress(null)}
        onConfirm={() => deleteAddress && handleDeleteAccount(deleteAddress)}
        title="Remove Account"
        message="Remove this account from the wallet?\n\nYour passkey will remain in your keychain and can be reconnected later."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Account Switcher */}
      <div className="relative" ref={dropdownRef}>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-label="Switch account"
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
            {activeAccount.displayName?.charAt(0) || "A"}
          </span>
          <span className="font-medium text-gray-900">{activeAccount.displayName}</span>
          <span className="text-xs text-gray-400">{isDropdownOpen ? "▲" : "▼"}</span>
        </button>

        {/* Dropdown */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 min-w-[280px] bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <span>Accounts</span>
              <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                {orderedAccounts.length}
              </span>
            </div>

            {/* Account List */}
            <div className="py-2">
              {orderedAccounts.map((acc) => (
                <div key={acc.address} className="px-2">
                  {editingAddress === acc.address ? (
                    /* Edit Mode */
                    <div className="flex gap-2 px-3 py-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(acc.address);
                          if (e.key === "Escape") setEditingAddress(null);
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveRename(acc.address)}
                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className={`flex items-center rounded-xl ${acc.address === activeAddress ? "bg-primary-50" : ""}`}>
                      <div
                        className="flex items-center gap-3 p-3 flex-1 cursor-pointer hover:bg-gray-50 rounded-xl transition-colors"
                        onClick={() => handleSwitchAccount(acc.address)}
                      >
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {acc.displayName?.charAt(0) || "A"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{acc.displayName}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {acc.address.slice(0, 6)}...{acc.address.slice(-4)}
                          </div>
                        </div>
                        {acc.address === activeAddress && (
                          <span className="text-primary-600 text-sm">●</span>
                        )}
                      </div>
                      <div className="flex gap-1 pr-2">
                        <IconButton
                          icon={<span className="text-sm">✎</span>}
                          aria-label={`Rename ${acc.displayName}`}
                          onClick={() => handleStartRename(acc.address, acc.displayName)}
                        />
                        <IconButton
                          icon={<span className="text-base">×</span>}
                          aria-label={`Remove ${acc.displayName}`}
                          variant="danger"
                          onClick={() => setDeleteAddress(acc.address)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-2">
              <button
                className="w-full py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-xl font-medium transition-colors"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate("/settings");
                }}
              >
                + Add Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chain Selector */}
      <ChainSelector />
    </header>
  );
}
