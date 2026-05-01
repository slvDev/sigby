import { AnimatePresence, motion } from "motion/react";
import { ConfirmModal } from "../../components/common";
import { GlassCard, PillButton, Icon, DismissibleError } from "../../components/ui";
import { RelayStatusCard } from "../../components/relay";
import { AccountKeysCard } from "../../components/keys";
import { fadeUp, spring, stagger, tween } from "../../styles/motion";
import type { AutoLockMinutes } from "../../store";
import { AccountListItem } from "../../components/settings/AccountListItem";
import { RenameAccountDialog } from "../../components/settings/RenameAccountDialog";
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
    walletName,
    setWalletName,
    accountCount,
    isLoading,
    error,
    errorAt,
    showAddAccount,
    showTestnets,
    setShowTestnets,
    autoLockMinutes,
    setAutoLockMinutes,
    dappsByAddress,
    renameTarget,
    setRenameTarget,
    deleteTarget,
    setDeleteTarget,
    disconnectAllTarget,
    setDisconnectAllTarget,
    handleCreateAccount,
    handleConnectAccount,
    handleSwitchAccount,
    handleRenameAccount,
    handleDisconnectDapp,
    handleDisconnectAllDapps,
    handleDeleteAccount,
    openAddAccount,
    closeAddAccount,
    dismissError,
  } = useSettings();

  // Same shape as Onboarding/Home so the immutable browser passkey
  // label always reads "Sigby N" with mono styling, not raw text.
  const keychainLabel = `Sigby ${accountCount + 1}`;

  const renameAccount = renameTarget ? accounts[renameTarget] : null;
  const deleteAccount = deleteTarget ? accounts[deleteTarget] : null;
  const deleteAccountDappCount =
    deleteTarget ? (dappsByAddress[deleteTarget]?.length ?? 0) : 0;
  const disconnectAllAccount = disconnectAllTarget
    ? accounts[disconnectAllTarget]
    : null;
  const disconnectAllCount = disconnectAllTarget
    ? (dappsByAddress[disconnectAllTarget]?.length ?? 0)
    : 0;

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
      <RenameAccountDialog
        isOpen={!!renameTarget}
        initialName={renameAccount?.displayName || ""}
        isLoading={isLoading}
        onClose={() => setRenameTarget(null)}
        onSave={(newName) => {
          if (renameTarget) handleRenameAccount(renameTarget, newName);
        }}
      />

      <ConfirmModal
        isOpen={!!disconnectAllTarget}
        onClose={() => setDisconnectAllTarget(null)}
        onConfirm={() => {
          if (disconnectAllTarget) handleDisconnectAllDapps(disconnectAllTarget);
        }}
        title="Disconnect dApps"
        message={
          disconnectAllCount > 0
            ? `Disconnect ${disconnectAllCount} dApp${
                disconnectAllCount === 1 ? "" : "s"
              } from ${disconnectAllAccount?.displayName || "this account"}?\n\nThe selected account will be removed from those dApps. Sites connected to another active account may stay connected.`
            : ""
        }
        confirmText="Disconnect"
        variant="danger"
        isLoading={isLoading}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDeleteAccount(deleteTarget);
        }}
        title={
          deleteAccount
            ? `Remove ${deleteAccount.displayName}?`
            : "Remove account"
        }
        messageNode={
          <ul className="space-y-2 list-disc list-outside pl-4">
            <li>
              Your passkey stays in iCloud Keychain, Google Password Manager,
              1Password, or your security key. You can re-add this account by
              tapping &ldquo;Restore existing passkey account.&rdquo;
            </li>
            {deleteAccountDappCount > 0 && (
              <li>
                <strong className="font-semibold text-zinc-900">
                  {deleteAccountDappCount} dApp connection
                  {deleteAccountDappCount === 1 ? "" : "s"} will be severed.
                </strong>
              </li>
            )}
            <li>
              Transaction history for this account will be hidden from the
              wallet UI.
            </li>
          </ul>
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        isLoading={isLoading}
      />

      <motion.section variants={fadeUp}>
        <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
          Accounts ({accountOrder.length})
        </h3>
        <GlassCard className="overflow-hidden">
          <ul className="divide-y divide-zinc-200/60">
            {accountOrder.map((addr) => {
              const acc = accounts[addr];
              if (!acc) return null;
              return (
                <AccountListItem
                  key={addr}
                  address={addr}
                  displayName={acc.displayName || "Account"}
                  isActive={addr === activeAddress}
                  dapps={dappsByAddress[addr] || []}
                  isBusy={isLoading}
                  onSwitch={() => handleSwitchAccount(addr)}
                  onRename={() => setRenameTarget(addr)}
                  onDisconnectAllDapps={() => setDisconnectAllTarget(addr)}
                  onDisconnectDapp={(origin) => handleDisconnectDapp(addr, origin)}
                  onRemove={() => setDeleteTarget(addr)}
                />
              );
            })}
          </ul>
        </GlassCard>
        <p className="text-[11px] text-zinc-400 mt-2 px-1">
          Tap a row to switch. Use the menu for rename, disconnect, or remove.
        </p>
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
                    maxLength={32}
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
    </motion.div>
  );
}
