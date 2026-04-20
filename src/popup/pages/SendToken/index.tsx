import { motion } from "motion/react";
import { FlowHeader } from "../../components/layout/FlowHeader";
import { TokenIcon, FeeTokenSelector } from "../../components/token";
import { GlassCard, DismissibleError } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { fadeUp, spring, stagger } from "../../styles/motion";
import { useSendToken } from "./useSendToken";

export function SendToken() {
  const {
    token,
    tokenAddress,
    recipient,
    setRecipient,
    amount,
    setAmount,
    isLoading,
    error,
    feeTokens,
    selectedFeeToken,
    setSelectedFeeToken,
    handleSetMax,
    handleSend,
    handleBack,
    handleGoToTokens,
    dismissError,
  } = useSendToken();

  if (!token || !tokenAddress) {
    return (
      <div
        className="flex flex-col flex-1 min-h-[600px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <FlowHeader title="Send Token" onBack={handleGoToTokens} />
        <div className="px-4 pt-3">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
            Token not found. Please go back and select a token.
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = !isLoading && !!recipient && !!amount;

  return (
    <div
      className="flex flex-col flex-1 min-h-[600px]"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <FlowHeader
        title={`Send ${token.symbol}`}
        onBack={handleBack}
        trailing={
          <TokenIcon
            symbol={token.symbol}
            address={token.address}
            logoUrl={token.logoUrl}
            size="sm"
          />
        }
      />

      <motion.div
        className="flex flex-col gap-4 px-4 pt-3 pb-4 flex-1"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger.base } },
        }}
      >
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="recipient"
                className="block text-[12px] font-medium text-zinc-700"
              >
                Recipient address
              </label>
              <input
                id="recipient"
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x…"
                disabled={isLoading}
                className="w-full px-3 py-2.5 text-[13px] font-mono bg-white/70 border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="amount"
                  className="text-[12px] font-medium text-zinc-700"
                >
                  Amount
                </label>
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  Available: {token.formatted} {token.symbol}
                </span>
              </div>
              <div className="relative">
                <input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  step="any"
                  min="0"
                  disabled={isLoading}
                  className="w-full px-3 py-2.5 pr-20 text-[14px] font-semibold tabular-nums bg-white/70 border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors disabled:opacity-50"
                />
                <motion.button
                  type="button"
                  onClick={handleSetMax}
                  disabled={isLoading}
                  whileTap={isLoading ? undefined : { scale: 0.94 }}
                  transition={spring.snap}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  MAX
                </motion.button>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {feeTokens.length > 0 && (
          <motion.div variants={fadeUp}>
            <FeeTokenSelector
              tokens={feeTokens}
              selected={selectedFeeToken}
              onChange={setSelectedFeeToken}
              disabled={isLoading}
            />
          </motion.div>
        )}

        <DismissibleError message={error} onDismiss={dismissError} />

        <div className="flex-1" />

        <motion.div className="flex gap-2" variants={fadeUp}>
          <motion.button
            onClick={handleBack}
            disabled={isLoading}
            whileTap={isLoading ? undefined : { scale: 0.98 }}
            transition={spring.snap}
            className="flex-1 py-3 text-[13px] font-semibold bg-white/80 border border-white/80 text-zinc-800 rounded-xl hover:bg-white disabled:opacity-50 transition-colors"
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={handleSend}
            disabled={!canSubmit}
            whileHover={canSubmit ? { y: -1 } : undefined}
            whileTap={canSubmit ? { scale: 0.98 } : undefined}
            transition={spring.snap}
            className="flex-1 py-3 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Sending…" : "Send"}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
