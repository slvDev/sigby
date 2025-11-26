/**
 * Popup Entry Point
 * Main React application for extension popup with multi-account support
 */

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useWalletStore, syncStoreWithBackground } from "./store";
import { popupPortoService } from "./portoService";
import { MessageType } from "../types/messages";
import "./popup.css";

/**
 * Parse URL parameters
 */
function getUrlParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

/**
 * Connection Approval Component
 * Shown when a dApp requests to connect
 */
function ConnectionApproval() {
  const params = getUrlParams();
  const origin = params.get("origin") || "Unknown dApp";
  const accountAddress = params.get("account") || "";
  const favicon = params.get("favicon") || "";
  const title = params.get("title") || origin;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format origin for display
  const displayOrigin = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const shortAddress = accountAddress
    ? `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`
    : "No account";

  const handleApprove = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.APPROVE_CONNECTION,
        payload: {
          origin,
          accountAddress,
        },
      });

      if (response.success) {
        // Close popup window
        window.close();
      } else {
        setError(response.error || "Failed to approve connection");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.REJECT_CONNECTION,
        payload: {
          origin,
          accountAddress,
        },
      });
    } catch (error) {
      console.error("Failed to reject connection:", error);
    }

    // Close popup window regardless
    window.close();
  };

  return (
    <div className="popup-container">
      <div className="connection-approval">
        <div className="connection-header">
          <h2>Connection Request</h2>
        </div>

        <div className="connection-dapp">
          {favicon && (
            <img
              src={favicon}
              alt=""
              className="connection-favicon"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="connection-dapp-info">
            <div className="connection-dapp-title">{title}</div>
            <div className="connection-dapp-origin">{displayOrigin}</div>
          </div>
        </div>

        <div className="connection-message">
          <p>This site wants to connect to your wallet</p>
        </div>

        <div className="connection-account">
          <div className="connection-account-label">Account to connect:</div>
          <div className="connection-account-address">{shortAddress}</div>
        </div>

        <div className="connection-permissions">
          <div className="connection-permissions-label">This site will be able to:</div>
          <ul className="connection-permissions-list">
            <li>View your wallet address</li>
            <li>Request transaction signatures</li>
          </ul>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="connection-actions">
          <button
            onClick={handleReject}
            disabled={isLoading}
            className="btn-secondary"
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Account Switcher Component
 */
function AccountSwitcher() {
  const {
    accounts,
    accountOrder,
    activeAddress,
    isAccountSwitcherOpen,
    setAccountSwitcherOpen,
    setLoading,
    setError,
  } = useWalletStore();

  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const orderedAccounts = accountOrder
    .map((addr) => accounts[addr])
    .filter(Boolean);

  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  // Handle account switch
  const handleSwitchAccount = async (address: string) => {
    if (address === activeAddress) {
      setAccountSwitcherOpen(false);
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
        setError(response.error || "Failed to switch account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to switch account");
    } finally {
      setLoading(false);
      setAccountSwitcherOpen(false);
    }
  };

  // Handle rename
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
        setError(response.error || "Failed to rename account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to rename account");
    } finally {
      setLoading(false);
      setEditingAddress(null);
    }
  };

  // Handle delete
  const handleDeleteAccount = async (address: string) => {
    if (!confirm("Delete this account?\n\nYour passkey will remain in your keychain and can be reconnected later.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "DELETE_ACCOUNT",
        payload: { address },
      });

      if (response.success) {
        await syncStoreWithBackground();
      } else {
        setError(response.error || "Failed to delete account");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  if (!activeAccount) return null;

  return (
    <div className="account-switcher">
      {/* Trigger */}
      <button
        className="account-switcher-trigger"
        onClick={() => setAccountSwitcherOpen(!isAccountSwitcherOpen)}
      >
        <span className="account-avatar">
          {activeAccount.displayName?.charAt(0) || "A"}
        </span>
        <span className="account-name">{activeAccount.displayName}</span>
        <span className="account-switcher-arrow">{isAccountSwitcherOpen ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {isAccountSwitcherOpen && (
        <div className="account-switcher-dropdown">
          <div className="account-switcher-header">
            <span>ACCOUNTS</span>
            <span className="account-count">{orderedAccounts.length}</span>
          </div>

          <div className="account-switcher-list">
            {orderedAccounts.map((acc) => (
              <div
                key={acc.address}
                className={`account-switcher-item ${acc.address === activeAddress ? "active" : ""}`}
              >
                {editingAddress === acc.address ? (
                  <div className="account-edit-row">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(acc.address);
                        if (e.key === "Escape") setEditingAddress(null);
                      }}
                      autoFocus
                      className="account-edit-input"
                    />
                    <button
                      onClick={() => handleSaveRename(acc.address)}
                      className="account-edit-save"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="account-switcher-item-main"
                      onClick={() => handleSwitchAccount(acc.address)}
                    >
                      <span className="account-avatar">
                        {acc.displayName?.charAt(0) || "A"}
                      </span>
                      <div className="account-switcher-item-info">
                        <div className="account-switcher-item-name">
                          {acc.displayName}
                        </div>
                        <div className="account-switcher-item-address">
                          {acc.address.slice(0, 6)}...{acc.address.slice(-4)}
                        </div>
                      </div>
                      {acc.address === activeAddress && (
                        <span className="account-active-indicator">●</span>
                      )}
                    </div>
                    <div className="account-switcher-item-actions">
                      <button
                        onClick={() => handleStartRename(acc.address, acc.displayName)}
                        className="account-action-btn"
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.address)}
                        className="account-action-btn account-action-delete"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="account-switcher-footer">
            <button
              className="account-switcher-add-btn"
              onClick={() => {
                setAccountSwitcherOpen(false);
                // Scroll to create section or show modal
              }}
            >
              + Add Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Popup Component
 */
function Popup() {
  const {
    accounts,
    accountOrder,
    activeAddress,
    isLoading,
    error,
    setLoading,
    setError,
    isAccountSwitcherOpen,
    setAccountSwitcherOpen,
  } = useWalletStore();

  const [initializing, setInitializing] = useState(true);
  const [walletName, setWalletName] = useState("");
  const [accountCount, setAccountCount] = useState(0);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(".account-switcher") && isAccountSwitcherOpen) {
        setAccountSwitcherOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isAccountSwitcherOpen, setAccountSwitcherOpen]);

  // Initialize on mount
  useEffect(() => {
    async function initialize() {
      try {
        console.log('[Popup] Initializing...');

        // Initialize Porto SDK in popup (for visible WebAuthn prompts)
        await popupPortoService.initialize();
        console.log('[Popup] Porto SDK initialized');

        // Sync with background state
        await syncStoreWithBackground();
        console.log('[Popup] Store synced');

        // Get account count for numbering
        const stateResponse = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        const count = stateResponse.data?.accountCount || 0;
        setAccountCount(count);
        console.log('[Popup] Account count:', count);
      } catch (error) {
        console.error("[Popup] Failed to initialize:", error);
        setError(error instanceof Error ? error.message : 'Initialization failed');
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
      console.log('[Popup] Creating account with Porto SDK...');

      // Auto-generate keychain name (immutable, shows in Touch ID)
      const keychainLabel = `Porto Wallet ${accountCount + 1}`;

      // Use custom name for extension (changeable)
      const displayName = walletName.trim() || `Account ${accountCount + 1}`;

      console.log('[Popup] Keychain label:', keychainLabel);
      console.log('[Popup] Display name:', displayName);

      // Create account using local Porto service
      const result = await popupPortoService.createAccount({
        displayName,
        keychainLabel,
      });

      console.log('[Popup] Account created:', result);

      // Notify background service of new account
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
        setShowAddAccount(false);
        setAccountCount((c) => c + 1);
      } else {
        setError(response.error || "Failed to save account");
      }
    } catch (error) {
      console.error('[Popup] Account creation failed:', error);
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
      console.log('[Popup] Connecting to existing account...');

      // Connect using local Porto service
      const result = await popupPortoService.connectAccount();

      console.log('[Popup] Account connected:', result);

      // Notify background service
      const response = await chrome.runtime.sendMessage({
        type: "CONNECT_ACCOUNT",
        payload: {
          address: result.address,
        },
      });

      if (response.success) {
        await syncStoreWithBackground();
        setShowAddAccount(false);
      } else {
        setError(response.error || "Failed to save account");
      }
    } catch (error) {
      console.error('[Popup] Account connection failed:', error);
      setError(error instanceof Error ? error.message : "Failed to connect account");
    } finally {
      setLoading(false);
    }
  };

  // Handle disconnect (delete active account)
  const handleDisconnect = async () => {
    if (!activeAddress) return;

    if (!confirm("Delete this account?\n\nYour passkey will remain in your keychain.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "DELETE_ACCOUNT",
        payload: { address: activeAddress },
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

  // No accounts - show onboarding
  const hasAccounts = accountOrder.length > 0;

  if (!hasAccounts) {
    return (
      <div className="popup-container">
        <div className="onboarding">
          <h1>Porto Wallet</h1>
          <p>Next-gen crypto wallet with biometric authentication</p>

          {error && <div className="error">{error}</div>}

          <div className="wallet-name-input">
            <label htmlFor="wallet-name">Name your wallet:</label>
            <input
              id="wallet-name"
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. Main Wallet, Trading, Savings"
              disabled={isLoading}
            />
            <div className="keychain-hint">
              In Touch ID prompts, you'll see: "Porto Wallet {accountCount + 1}"
              <br />
              <small>(Keychain names can't be changed)</small>
            </div>
          </div>

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
            <div className="feature">No passwords or seed phrases</div>
            <div className="feature">Sign in with Face ID / Touch ID</div>
            <div className="feature">Multi-chain support</div>
          </div>
        </div>
      </div>
    );
  }

  // Has accounts - show wallet view
  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  return (
    <div className="popup-container">
      <div className="wallet">
        <header>
          <AccountSwitcher />
          <div className="chain-badge">Base</div>
        </header>

        {activeAccount ? (
          <>
            <div className="account-info">
              <div className="address">
                {activeAccount.address.slice(0, 6)}...{activeAccount.address.slice(-4)}
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(activeAccount.address);
                  }}
                  title="Copy address"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="balance">
              <div className="balance-label">Balance</div>
              <div className="balance-value">{activeAccount.balance || "0"} ETH</div>
            </div>
          </>
        ) : (
          <div className="no-active-account">
            Select an account from the dropdown above
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {/* Add Account Section */}
        {showAddAccount ? (
          <div className="add-account-section">
            <div className="wallet-name-input">
              <label htmlFor="new-wallet-name">Name your new wallet:</label>
              <input
                id="new-wallet-name"
                type="text"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="e.g. Trading, Savings"
                disabled={isLoading}
              />
              <div className="keychain-hint">
                Touch ID: "Porto Wallet {accountCount + 1}"
              </div>
            </div>
            <div className="add-account-actions">
              <button
                onClick={handleCreateAccount}
                disabled={isLoading}
                className="btn-primary btn-small"
              >
                {isLoading ? "Creating..." : "Create"}
              </button>
              <button
                onClick={handleConnectAccount}
                disabled={isLoading}
                className="btn-secondary btn-small"
              >
                {isLoading ? "..." : "Connect Existing"}
              </button>
              <button
                onClick={() => setShowAddAccount(false)}
                className="btn-text"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="actions">
            <button className="btn-secondary" disabled>
              Send
            </button>
            <button className="btn-secondary" disabled>
              Receive
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowAddAccount(true)}
            >
              + Add
            </button>
          </div>
        )}

        <div className="settings">
          <button onClick={handleDisconnect} className="btn-text">
            Remove Account
          </button>
        </div>

        <div className="phase-info">
          Multi-Account Support
        </div>
      </div>
    </div>
  );
}

/**
 * App Router
 * Routes to different views based on URL parameters
 */
function App() {
  const params = getUrlParams();
  const view = params.get("view");

  // Route based on view parameter
  switch (view) {
    case "connect":
      return <ConnectionApproval />;
    default:
      return <Popup />;
  }
}

// Mount React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
