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

  if (!hasAccounts) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 mb-2">
          Berth
        </h1>
        <p className="text-[13px] text-zinc-500 mb-8">
          Sign with a passkey. Same account on every chain.
        </p>

        <div className="w-full max-w-xs mb-4">
          <DismissibleError message={error} onDismiss={dismissError} since={errorAt} />
        </div>

        <div className="w-full max-w-xs space-y-4">
          <div className="space-y-2 text-left">
            <label
              htmlFor="wallet-name"
              className="block text-[13px] font-medium text-zinc-700"
            >
              Name your wallet
            </label>
            <input
              id="wallet-name"
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. Main, Trading, Savings"
              disabled={isLoading}
              className="w-full px-4 py-3 text-[14px] bg-white/80 backdrop-blur border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
            />
            <p className="text-[11px] text-zinc-400">
              Touch ID prompt will show "Berth {accountCount + 1}"
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <motion.button
              onClick={handleCreateAccount}
              disabled={isLoading}
              whileHover={isLoading ? undefined : { y: -1 }}
              whileTap={isLoading ? undefined : { scale: 0.98 }}
              className="w-full py-3 text-[14px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating…" : "Create new wallet"}
            </motion.button>

            <motion.button
              onClick={handleConnectAccount}
              disabled={isLoading}
              whileHover={isLoading ? undefined : { y: -1 }}
              whileTap={isLoading ? undefined : { scale: 0.98 }}
              className="w-full py-3 text-[14px] font-semibold bg-white/80 backdrop-blur border border-white/80 text-zinc-800 rounded-xl hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Connecting…" : "I have a wallet"}
            </motion.button>
          </div>
        </div>

        <div className="mt-10 space-y-1 text-[12px] text-zinc-400">
          <div>No passwords or seed phrases</div>
          <div>Sign in with Face ID / Touch ID</div>
          <div>Multi-chain support</div>
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
