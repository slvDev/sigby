import { AnimatePresence, motion } from "motion/react";
import { ConfirmModal } from "../../components/common";
import { GlassCard, PillButton, Icon, DismissibleError } from "../../components/ui";
import { RelayStatusCard } from "../../components/relay";
import { AccountKeysCard } from "../../components/keys";
import { fadeUp, spring, stagger, tween } from "../../styles/motion";
import type { AutoLockMinutes } from "../../store";
import { useSettings } from "./useSettings";

const AUTO_LOCK_PRESETS: Array<{ label: string; value: AutoLockMinutes }> = [
  { label: "1m", value: 1 },
  { label: "5m", value: 5 },
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "4h", value: 240 },
  { label: "Never", value: "never" },
];

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
    errorAt,
    showAddAccount,
    showDeleteConfirm,
    showTestnets,
    setShowTestnets,
    autoLockMinutes,
    setAutoLockMinutes,
    handleCreateAccount,
    handleConnectAccount,
    handleDeleteAccount,
    openAddAccount,
    closeAddAccount,
    openDeleteConfirm,
    closeDeleteConfirm,
    dismissError,
  } = useSettings();

  // Same shape as Onboarding/Home so the immutable browser passkey
  // label always reads "Berth N" with mono styling, not raw text.
  const keychainLabel = `Berth ${accountCount + 1}`;

  return (
    <motion.div
      className="flex flex-col flex-1 min-h-0 gap-4 overflow-y-auto pb-2"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger.base } },
      }}
    >
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
        <motion.section variants={fadeUp}>
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
        </motion.section>
      )}

      <motion.section variants={fadeUp}>
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
                <motion.li key={addr} layout transition={spring.soft}>
                  <div
                    className={`relative grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-2.5`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="settings-active-row"
                        className="absolute inset-0 bg-blue-50/60"
                        transition={spring.soft}
                      />
                    )}
                    <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[12px] font-semibold">
                      {acc.displayName?.charAt(0).toUpperCase() || "A"}
                    </span>
                    <div className="relative min-w-0">
                      <div className="text-[13px] font-semibold text-zinc-900 truncate">
                        {acc.displayName}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                        {addr.slice(0, 6)}…{addr.slice(-4)}
                      </div>
                    </div>
                    {isActive && (
                      <span className="relative text-[11px] font-semibold text-blue-600">
                        Active
                      </span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </GlassCard>
      </motion.section>

      <motion.div variants={fadeUp} layout>
        <AnimatePresence mode="wait" initial={false}>
          {showAddAccount ? (
            <motion.section
              key="add-account"
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={tween.baseOut}
              className="space-y-3"
            >
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
                    className="w-full px-3 py-2.5 text-[13px] bg-white/80 border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors disabled:opacity-50"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Passkey label:{" "}
                    <span className="font-mono text-zinc-600">
                      {keychainLabel}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <motion.button
                    onClick={handleCreateAccount}
                    disabled={isLoading}
                    whileHover={isLoading ? undefined : { y: -1 }}
                    whileTap={isLoading ? undefined : { scale: 0.98 }}
                    transition={spring.snap}
                    className="w-full py-2.5 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? "Creating…" : "Create"}
                  </motion.button>
                  <motion.button
                    onClick={handleConnectAccount}
                    disabled={isLoading}
                    whileHover={isLoading ? undefined : { y: -1 }}
                    whileTap={isLoading ? undefined : { scale: 0.98 }}
                    transition={spring.snap}
                    className="w-full py-2.5 text-[13px] font-semibold bg-white/80 border border-white/80 text-zinc-800 rounded-xl hover:bg-white disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? "…" : "Connect existing"}
                  </motion.button>
                  <button
                    onClick={closeAddAccount}
                    className="text-[12px] text-zinc-500 hover:text-zinc-800 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </GlassCard>
            </motion.section>
          ) : (
            <motion.div
              key="add-account-pill"
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={tween.baseOut}
            >
              <PillButton variant="secondary" onClick={openAddAccount}>
                <Icon name="plus" className="w-3.5 h-3.5" />
                Add account
              </PillButton>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <DismissibleError message={error} onDismiss={dismissError} since={errorAt} />

      <motion.section variants={fadeUp}>
        <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
          Security
        </h3>
        <GlassCard className="p-4">
          <div className="text-[13px] font-semibold text-zinc-900">
            Auto-lock after
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Locks the popup after idle. Passkey required to unlock.
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {AUTO_LOCK_PRESETS.map((p) => {
              const isActive = autoLockMinutes === p.value;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setAutoLockMinutes(p.value)}
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white/80 text-zinc-700 border-white/80 hover:bg-white"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </GlassCard>
      </motion.section>

      <motion.section variants={fadeUp}>
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
      </motion.section>

      <motion.section variants={fadeUp}>
        <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
          Account keys
        </h3>
        <AccountKeysCard />
      </motion.section>

      <motion.section className="pt-2 border-t border-zinc-200/60" variants={fadeUp}>
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
      </motion.section>
    </motion.div>
  );
}
