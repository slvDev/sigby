import { Toggle, ConfirmModal, Button } from "../../components/common";
import { Header } from "../../components/layout/Header";
import { BottomNav } from "../../components/layout/BottomNav";
import { RelayStatusCard } from "../../components/relay";
import { AccountKeysCard } from "../../components/keys";
import { useSettings } from "./useSettings";

export function Settings() {
  const {
    accounts,
    accountOrder,
    activeAddress,
    activeAccount,
    walletName,
    setWalletName,
    accountCount,
    isLoading,
    error,
    showAddAccount,
    showDeleteConfirm,
    showTestnets,
    setShowTestnets,
    handleCreateAccount,
    handleConnectAccount,
    handleDeleteAccount,
    openAddAccount,
    closeAddAccount,
    openDeleteConfirm,
    closeDeleteConfirm,
  } = useSettings();

  return (
    <div className="flex flex-col flex-1">
      <Header />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteAccount}
        title="Remove Account"
        message="Remove this account from the wallet?\n\nYour passkey will remain in your keychain and can be reconnected later."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        isLoading={isLoading}
      />

      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Active Account
          </h3>
          {activeAccount ? (
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="font-medium text-gray-900">
                {activeAccount.displayName}
              </div>
              <div className="text-sm text-gray-500 font-mono mt-1">
                {activeAddress?.slice(0, 10)}...{activeAddress?.slice(-8)}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No active account</p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Accounts ({accountOrder.length})
          </h3>
          <div className="space-y-2">
            {accountOrder.map((addr) => {
              const acc = accounts[addr];
              if (!acc) return null;
              return (
                <div
                  key={addr}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    addr === activeAddress ? "bg-primary-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {acc.displayName?.charAt(0) || "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {acc.displayName}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {addr.slice(0, 6)}...{addr.slice(-4)}
                    </div>
                  </div>
                  {addr === activeAddress && (
                    <span className="text-xs text-primary-600 font-medium">
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {showAddAccount ? (
          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Add Account
            </h3>
            <div className="space-y-2">
              <label
                htmlFor="new-wallet-name"
                className="block text-sm font-medium text-gray-700"
              >
                Name your new wallet:
              </label>
              <input
                id="new-wallet-name"
                type="text"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="e.g. Trading, Savings"
                disabled={isLoading}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none disabled:opacity-50"
              />
              <p className="text-xs text-gray-400">
                Touch ID: "Berth {accountCount + 1}"
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCreateAccount}
                disabled={isLoading}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Create"}
              </button>
              <button
                onClick={handleConnectAccount}
                disabled={isLoading}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isLoading ? "..." : "Connect Existing"}
              </button>
              <button
                onClick={closeAddAccount}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : (
          <button
            onClick={openAddAccount}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            + Add Account
          </button>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Network
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-xl">
              <Toggle
                checked={showTestnets}
                onChange={setShowTestnets}
                label="Show test networks"
                description="Display Sepolia, Holesky, and other testnets"
              />
            </div>
            <RelayStatusCard />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Account Keys
          </h3>
          <AccountKeysCard />
        </section>

        <section className="pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">
            Danger Zone
          </h3>
          <Button
            variant="danger"
            fullWidth
            onClick={openDeleteConfirm}
            disabled={!activeAddress}
          >
            Remove Current Account
          </Button>
          <p className="text-xs text-gray-400 mt-2">
            Your passkey will remain in your keychain and can be reconnected.
          </p>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
