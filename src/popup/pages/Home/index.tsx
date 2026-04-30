import { motion } from "motion/react";
import { PendingApprovalsCard } from "../../components/approvals/PendingApprovalsCard";
import { AddTokenModal } from "../../components/token";
import {
  HeroCard,
  GlassCard,
  AddressText,
  BalanceDisplay,
  QuickActionButton,
  DismissibleError,
  PillButton,
  Icon,
} from "../../components/ui";
import { fadeUp, stagger, tween } from "../../styles/motion";
import { useHome } from "./useHome";
import { useTokens } from "../Tokens/useTokens";

export function Home() {
  const {
    walletName,
    setWalletName,
    accountCount,
    activeAccount,
    hasAccounts,
    balance,
    nativeSymbol,
    assetsLoading,
    isLoading,
    error,
    errorAt,
    handleCreateAccount,
    handleConnectAccount,
    handleGoSend,
    handleGoReceive,
    dismissError,
  } = useHome();

  // Tokens inline on the Wallet tab. Activity has its own tab.
  const {
    activeAddress: tokensAccount,
    chainId,
    chainName,
    tokens,
    isAddModalOpen,
    handleTokenAdded,
    handleTokenClick,
    handleRemoveToken,
    openAddModal,
    closeAddModal,
  } = useTokens();

  // First-run users never reach this branch — `AuthGuard` renders
  // `<Onboarding />` instead. This is the wipe-and-recreate fallback
  // for users who completed onboarding once and then deleted every
  // account; copy + visual language mirrors Onboarding Step 3.
  if (!hasAccounts) {
    const keychainLabel = `Berth ${accountCount + 1}`;
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col">
          <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
            Create passkey account
          </h1>
          <p className="text-[13px] text-zinc-500 leading-relaxed mt-1.5">
            Wallet name is local and editable. The browser passkey label is
            permanent (
            <span className="font-mono text-zinc-700">{keychainLabel}</span>).
          </p>

          <div className="mt-5">
            <GlassCard className="px-3.5 py-3.5">
              <label
                htmlFor="wallet-name"
                className="block text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500 mb-2"
              >
                Wallet name
              </label>
              <input
                id="wallet-name"
                type="text"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="Main, Trading, Hot…"
                disabled={isLoading}
                maxLength={32}
                className="w-full px-3.5 py-2.5 text-[14px] bg-white/80 backdrop-blur border border-white/80 rounded-lg placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
              />
            </GlassCard>
          </div>

          <div className="mt-3">
            <DismissibleError
              message={error}
              onDismiss={dismissError}
              since={errorAt}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 pt-5">
          <motion.button
            onClick={handleCreateAccount}
            disabled={isLoading}
            whileHover={isLoading ? undefined : { y: -1 }}
            whileTap={isLoading ? undefined : { scale: 0.98 }}
            className="w-full py-3.5 text-[14px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Waiting for passkey…" : "Create with passkey"}
          </motion.button>

          <motion.button
            onClick={handleConnectAccount}
            disabled={isLoading}
            className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed underline-offset-2 hover:underline focus:outline-none focus-visible:underline py-1"
          >
            {isLoading ? "Connecting…" : "Restore existing passkey account"}
          </motion.button>
        </div>
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-[13px]">
        Select an account from the header.
      </div>
    );
  }

  const rowDelay = (i: number) => i * stagger.base;

  return (
    <motion.div
      className="flex flex-col gap-4 pb-2"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger.base } },
      }}
    >
      <PendingApprovalsCard />

      <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
        <HeroCard className="p-5">
          <BalanceDisplay
            balance={assetsLoading ? "…" : balance}
            symbol={nativeSymbol}
            animateValue={!assetsLoading}
            scrambleKey={activeAccount.address}
          />
          <div className="mt-3">
            <AddressText
              address={activeAccount.address}
              scrambleKey={activeAccount.address}
            />
          </div>
        </HeroCard>
      </motion.div>

      <motion.div
        className="grid grid-cols-3 gap-2.5"
        variants={fadeUp}
        transition={tween.mediumOutStrong}
      >
        <QuickActionButton label="Send" icon="send" onClick={handleGoSend} />
        <QuickActionButton
          label="Receive"
          icon="receive"
          onClick={handleGoReceive}
        />
        <QuickActionButton label="Swap" icon="swap" disabled />
      </motion.div>

      <DismissibleError message={error} onDismiss={dismissError} since={errorAt} />

      {/* Tokens section — merged into Wallet tab. */}
      <motion.div
        className="flex flex-col"
        variants={fadeUp}
        transition={tween.mediumOutStrong}
      >
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-[13px] font-semibold text-zinc-900 tracking-tight">
            Tokens
          </h2>
          <PillButton variant="secondary" onClick={openAddModal}>
            <Icon name="plus" className="w-3 h-3" />
            Add
          </PillButton>
        </div>
        {tokens.length === 0 ? (
          <div className="text-center px-6 py-4">
            <p className="text-[12px] text-zinc-500">
              {assetsLoading ? "Loading tokens…" : "No tokens on this network."}
            </p>
          </div>
        ) : (
          <GlassCard className="overflow-hidden">
            <ul className="divide-y divide-zinc-200/60">
              {tokens.map((token, i) => (
                <motion.li
                  key={token.address}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ ...tween.baseOut, delay: rowDelay(i) }}
                >
                  <motion.button
                    type="button"
                    onClick={() => handleTokenClick(token)}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.7)" }}
                    whileTap={{ scale: 0.995 }}
                    className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-2.5 focus:outline-none focus-visible:bg-white/70 text-left"
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[10px] font-semibold">
                      {token.symbol.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-zinc-900 truncate">
                        {token.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 tabular-nums">
                        {token.formatted} {token.symbol}
                      </div>
                    </div>
                    <div className="text-right">
                      {token.usdValue && (
                        <div className="text-[12px] font-semibold text-zinc-900 tabular-nums">
                          $
                          {parseFloat(token.usdValue).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      )}
                      {token.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveToken(token);
                          }}
                          className="text-[10px] text-zinc-400 hover:text-rose-600"
                          aria-label={`Remove ${token.symbol}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </motion.button>
                </motion.li>
              ))}
            </ul>
          </GlassCard>
        )}
      </motion.div>

      {tokensAccount && (
        <AddTokenModal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          onSuccess={handleTokenAdded}
          accountAddress={tokensAccount}
          chainId={chainId}
          chainName={chainName}
        />
      )}
    </motion.div>
  );
}
