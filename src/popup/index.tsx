/**
 * Popup Entry Point
 * Main React application for extension popup
 */

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useWalletStore, syncStoreWithBackground } from "./store";
import "./popup.css";

/**
 * Main Popup Component
 */
function Popup() {
  const {
    account,
    isAuthenticated,
    chainId,
    isLoading,
    error,
    setLoading,
    setError,
  } = useWalletStore();

  const [initializing, setInitializing] = useState(true);

  // Initialize on mount
  useEffect(() => {
    async function initialize() {
      try {
        await syncStoreWithBackground();
      } catch (error) {
        console.error("[Popup] Failed to initialize:", error);
      } finally {
        setInitializing(false);
      }
    }

    initialize();
  }, []);

  // Handle account creation
  const handleCreateAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "CREATE_ACCOUNT",
        payload: {
          displayName: "Porto Wallet",
        },
      });

      if (response.success) {
        await syncStoreWithBackground();
        alert("Account created successfully!");
      } else {
        setError(response.error || "Failed to create account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  // Handle account connection
  const handleConnectAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "CONNECT_ACCOUNT",
      });

      if (response.success) {
        await syncStoreWithBackground();
        alert("Account connected successfully!");
      } else {
        setError(response.error || "Failed to connect account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to connect account");
    } finally {
      setLoading(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "DISCONNECT_ACCOUNT",
      });

      if (response.success) {
        await syncStoreWithBackground();
      }
    } catch (error) {
      console.error("[Popup] Failed to disconnect:", error);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (initializing) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Not authenticated - show onboarding
  if (!isAuthenticated || !account) {
    return (
      <div className="popup-container">
        <div className="onboarding">
          <h1>Porto Wallet</h1>
          <p>Next-gen crypto wallet with biometric authentication</p>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button
              onClick={handleCreateAccount}
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? "Creating..." : "Create New Wallet"}
            </button>

            <button
              onClick={handleConnectAccount}
              disabled={isLoading}
              className="btn-secondary"
            >
              {isLoading ? "Connecting..." : "I Have a Wallet"}
            </button>
          </div>

          <div className="features">
            <div className="feature">✓ No passwords or seed phrases</div>
            <div className="feature">✓ Sign in with Face ID / Touch ID</div>
            <div className="feature">✓ Multi-chain support</div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated - show wallet view
  return (
    <div className="popup-container">
      <div className="wallet">
        <header>
          <h2>Porto Wallet</h2>
          <div className="chain-info">Chain: {chainId}</div>
        </header>

        <div className="account-info">
          <div className="address-label">Account</div>
          <div className="address">
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </div>
          {account.displayName && (
            <div className="display-name">{account.displayName}</div>
          )}
        </div>

        <div className="balance">
          <div className="balance-label">Balance</div>
          <div className="balance-value">{account.balance || "0"} ETH</div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="actions">
          <button className="btn-secondary" disabled>
            Send
          </button>
          <button className="btn-secondary" disabled>
            Receive
          </button>
          <button className="btn-secondary" disabled>
            Swap
          </button>
        </div>

        <div className="settings">
          <button onClick={handleDisconnect} className="btn-text">
            Disconnect
          </button>
        </div>

        <div className="phase-info">
          Phase 1: Core Infrastructure Complete
        </div>
      </div>
    </div>
  );
}

// Mount React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
