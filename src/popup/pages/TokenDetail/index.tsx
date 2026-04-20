import { motion } from "motion/react";
import { FlowHeader } from "../../components/layout/FlowHeader";
import { TokenIcon } from "../../components/token";
import { GlassCard, HeroCard, BalanceDisplay } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { fadeUp, spring, stagger } from "../../styles/motion";
import { useTokenDetail } from "./useTokenDetail";

export function TokenDetail() {
  const { token, address, handleBack, handleGoToTokens, handleSend } =
    useTokenDetail();

  if (!token || !address) {
    return (
      <div
        className="flex flex-col flex-1 min-h-[600px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <FlowHeader title="Token" onBack={handleGoToTokens} />
        <div className="px-4 pt-3">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
            Token not found. Please go back and select a token.
          </div>
        </div>
      </div>
    );
  }

  const fiat = token.usdValue
    ? `$${parseFloat(token.usdValue).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : undefined;

  return (
    <div
      className="flex flex-col flex-1 min-h-[600px]"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <FlowHeader
        title={token.name}
        subtitle={token.symbol}
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
          <HeroCard className="p-5 flex flex-col items-center text-center">
            <TokenIcon
              symbol={token.symbol}
              address={token.address}
              logoUrl={token.logoUrl}
              size="lg"
              className="w-14 h-14 text-2xl mb-3"
            />
            <BalanceDisplay
              balance={token.formatted}
              symbol={token.symbol}
              fiat={fiat}
              animateValue
            />
          </HeroCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
              Contract address
            </div>
            <div className="mt-2 text-[11px] font-mono text-zinc-700 break-all">
              {token.address}
            </div>
          </GlassCard>
        </motion.div>

        <div className="flex-1" />

        <motion.button
          onClick={handleSend}
          variants={fadeUp}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={spring.snap}
          className="w-full py-3.5 text-[14px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          Send {token.symbol}
        </motion.button>
      </motion.div>
    </div>
  );
}
