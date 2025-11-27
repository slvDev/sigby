/**
 * Home Page (Dashboard)
 * Main wallet view with balance, actions, and recent transactions
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore, syncStoreWithBackground } from "../store";
import { popupPortoService } from "../portoService";
import { Header } from "../components/layout/Header";
import { BottomNav } from "../components/layout/BottomNav";

export function Home() {
  const navigate = useNavigate();
  const {
    accounts,
    accountOrder,
    activeAddress,
    chainId,
    assets,
    assetsLoading,
    refreshAssets,
    isLoading,
    error,
    setLoading,
    setError,
  } = useWalletStore();

  const [walletName, setWalletName] = useState("");
  const [accountCount, setAccountCount] = useState(0);

  // Get native balance from assets
  const nativeAsset = assets.find((a) => a.type === "native");
  const balance = nativeAsset
    ? (Number(BigInt(nativeAsset.balance)) / 1e18).toFixed(7)
    : "0";

  // Get account count on mount
  useEffect(() => {
    async function getAccountCount() {
      try {
        const stateResponse = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        setAccountCount(stateResponse.data?.accountCount || 0);
      } catch (e) {
        console.error("Failed to get account count:", e);
      }
    }
    getAccountCount();
  }, []);

  // Refresh assets when active account or chain changes
  useEffect(() => {
    if (activeAddress) {
      refreshAssets();
    }
  }, [activeAddress, chainId]);

  // Handle account creation
  const handleCreateAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const keychainLabel = `Porto Wallet ${accountCount + 1}`;
      const displayName = walletName.trim() || `Account ${accountCount + 1}`;

      const result = await popupPortoService.createAccount({
        displayName,
        keychainLabel,
      });

      const response = await chrome.runtime.sendMessage({
        type: "CREATE_ACCOUNT",
        payload: {
          address: result.address,
          displayName: displayName,
        },
      });

      if (response.success) {
        await syncStoreWithBackground();
        setWalletName("");
        setAccountCount((c) => c + 1);
      } else {
        setError(response.error || "Failed to save account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  // Handle account connection
  const handleConnectAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await popupPortoService.connectAccount();

      const response = await chrome.runtime.sendMessage({
        type: "CONNECT_ACCOUNT",
        payload: { address: result.address },
      });

      if (response.success) {
        await syncStoreWithBackground();
      } else {
        setError(response.error || "Failed to save account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setLoading(false);
    }
  };

  const hasAccounts = accountOrder.length > 0;
  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  // No accounts - show onboarding
  if (!hasAccounts) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Porto Wallet</h1>
        <p className="text-sm text-gray-500 mb-8">Next-gen crypto wallet with biometric authentication</p>

        {error && (
          <div className="w-full max-w-xs mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="w-full max-w-xs space-y-4">
          <div className="space-y-2">
            <label htmlFor="wallet-name" className="block text-sm font-medium text-gray-700 text-left">
              Name your wallet:
            </label>
            <input
              id="wallet-name"
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. Main Wallet, Trading, Savings"
              disabled={isLoading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 text-left">
              In Touch ID prompts, you'll see: "Porto Wallet {accountCount + 1}"
              <br />
              <span className="text-gray-300">(Keychain names can't be changed)</span>
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleCreateAccount}
              disabled={isLoading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create New Wallet"}
            </button>

            <button
              onClick={handleConnectAccount}
              disabled={isLoading}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Connecting..." : "I Have a Wallet"}
            </button>
          </div>
        </div>

        <div className="mt-10 space-y-2 text-sm text-gray-400">
          <div>No passwords or seed phrases</div>
          <div>Sign in with Face ID / Touch ID</div>
          <div>Multi-chain support</div>
        </div>
      </div>
    );
  }

  // Has accounts - show wallet
  return (
    <div className="flex flex-col flex-1">
      <Header />

      {activeAccount ? (
        <div className="flex-1 flex flex-col">
          <div className="p-6 flex flex-col gap-6 flex-1">
            {/* Address */}
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-sm text-gray-500">
                {activeAccount.address.slice(0, 6)}...{activeAccount.address.slice(-4)}
              </span>
              <button
                className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                onClick={() => navigator.clipboard.writeText(activeAccount.address)}
                title="Copy address"
                aria-label="Copy wallet address to clipboard"
              >
                Copy
              </button>
            </div>

            {/* Balance */}
            <div className="text-center py-6">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Balance</div>
              <div className="text-4xl font-bold text-gray-900">
                {assetsLoading ? "..." : balance} ETH
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                onClick={() => navigate("/send")}
              >
                Send
              </button>
              <button
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                onClick={() => navigate("/receive")}
              >
                Receive
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          {/* Bottom Navigation */}
          <BottomNav />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 text-gray-500">
          Select an account from the dropdown above
        </div>
      )}
    </div>
  );
}
