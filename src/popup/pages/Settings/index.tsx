import { ConfirmModal } from "../../components/common";
import { GlassCard, PillButton, Icon } from "../../components/ui";
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
    <div className="flex flex-col flex-1 min-h-0 gap-4 overflow-y-auto pb-2">
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteAccount}
        title="Remove account"
        message="Remove this account from the wallet?\n\nYour passkey will remain in your keychain and can be reconnected later."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        isLoading={isLoading}
      />

      {activeAccount && (
        <section>
          <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
            Active account
          </h3>
          <GlassCard className="p-4">
            <div className="text-[14px] font-semibold text-zinc-900">
              {activeAccount.displayName}
            </div>
            <div className="text-[12px] text-zinc-500 font-mono mt-1 break-all">
              {activeAddress}
            </div>
          </GlassCard>
        </section>
      )}

      <section>
        <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
          Accounts ({accountOrder.length})
        </h3>
        <GlassCard className="overflow-hidden">
          <ul className="divide-y divide-zinc-200/60">
            {accountOrder.map((addr) => {
              const acc = accounts[addr];
              if (!acc) return null;
              const isActive = addr === activeAddress;
              return (
                <li key={addr}>
                  <div
                    className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-2.5 ${
                      isActive ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[12px] font-semibold">
                      {acc.displayName?.charAt(0).toUpperCase() || "A"}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-zinc-900 truncate">
                        {acc.displayName}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                        {addr.slice(0, 6)}…{addr.slice(-4)}
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[11px] font-semibold text-blue-600">
                        Active
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      </section>

      {showAddAccount ? (
        <section className="space-y-3">
          <h3 className="px-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
            Add account
          </h3>
          <GlassCard className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="new-wallet-name"
                className="block text-[12px] font-medium text-zinc-700"
              >
                Name your new wallet
              </label>
              <input
                id="new-wallet-name"
                type="text"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="e.g. Trading, Savings"
                disabled={isLoading}
                className="w-full px-3 py-2.5 text-[13px] bg-white/80 border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
              />
              <p className="text-[11px] text-zinc-400">
                Touch ID: "Berth {accountCount + 1}"
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCreateAccount}
                disabled={isLoading}
                className="w-full py-2.5 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Creating…" : "Create"}
              </button>
              <button
                onClick={handleConnectAccount}
                disabled={isLoading}
                className="w-full py-2.5 text-[13px] font-semibold bg-white/80 border border-white/80 text-zinc-800 rounded-xl hover:bg-white disabled:opacity-50"
              >
                {isLoading ? "…" : "Connect existing"}
              </button>
              <button
                onClick={closeAddAccount}
                className="text-[12px] text-zinc-500 hover:text-zinc-800 py-1"
              >
                Cancel
              </button>
            </div>
          </GlassCard>
        </section>
      ) : (
        <PillButton variant="secondary" onClick={openAddAccount}>
          <Icon name="plus" className="w-3.5 h-3.5" />
          Add account
        </PillButton>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
          {error}
        </div>
      )}

      <section>
        <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
          Network
        </h3>
        <div className="space-y-3">
          <GlassCard className="px-4 py-3.5">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="text-[13px] font-semibold text-zinc-900">
                  Show test networks
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Sepolia, Holesky, Amoy, and other testnets
                </div>
              </div>
              <input
                type="checkbox"
                checked={showTestnets}
                onChange={(e) => setShowTestnets(e.target.checked)}
                className="w-5 h-5 accent-blue-600"
              />
            </label>
          </GlassCard>
          <RelayStatusCard />
        </div>
      </section>

      <section>
        <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
          Account keys
        </h3>
        <AccountKeysCard />
      </section>

      <section className="pt-2 border-t border-zinc-200/60">
        <h3 className="px-1 mb-2 text-[11px] font-semibold text-rose-600 uppercase tracking-[0.1em]">
          Danger zone
        </h3>
        <PillButton
          variant="danger"
          onClick={openDeleteConfirm}
          disabled={!activeAddress}
          className="w-full"
        >
          Remove current account
        </PillButton>
        <p className="text-[11px] text-zinc-400 mt-2 px-1">
          Your passkey will remain in your keychain and can be reconnected.
        </p>
      </section>
    </div>
  );
}
