import { useState } from "react";
import { motion } from "motion/react";
import { FlowHeader } from "../../components/layout/FlowHeader";
import { TokenIcon } from "../../components/token";
import { GlassCard, HeroCard, Icon } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { fadeUp, spring, stagger } from "../../styles/motion";
import { useTokenDetail } from "./useTokenDetail";

// Headline keeps at most 6 fractional digits; full precision lives in
// the mono row below.
function shortBalance(formatted: string): string {
  const dot = formatted.indexOf(".");
  if (dot < 0) return formatted;
  const intPart = formatted.slice(0, dot);
  const frac = formatted.slice(dot + 1, dot + 1 + 6).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

export function TokenDetail() {
  const { token, address, handleBack, handleGoToTokens, handleSend } =
    useTokenDetail();
  const [copiedExact, setCopiedExact] = useState(false);

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
          <HeroCard className="p-5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[32px] leading-none font-semibold tracking-tight text-zinc-900 tabular-nums">
                {shortBalance(token.formatted)}
              </span>
              <span className="text-[16px] font-medium text-zinc-500">
                {token.symbol}
              </span>
            </div>
            {fiat && (
              <div className="mt-2 text-[14px] text-zinc-500 tabular-nums">
                {fiat}
              </div>
            )}
            {shortBalance(token.formatted) !== token.formatted && (
              <button
                type="button"
                onClick={async () => {
                  // writeText rejects asynchronously on permission /
                  // availability failures, so a sync try/catch can't
                  // see those — and flipping `copiedExact` before the
                  // promise resolves would lie about a failed copy.
                  try {
                    await navigator.clipboard.writeText(
                      `${token.formatted} ${token.symbol}`
                    );
                    setCopiedExact(true);
                    window.setTimeout(() => setCopiedExact(false), 1200);
                  } catch {
                    // Clipboard unavailable — leave the affordance idle.
                  }
                }}
                aria-label={
                  copiedExact
                    ? "Full balance copied"
                    : "Copy full-precision balance"
                }
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-800 tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded px-1 -mx-1 break-all text-left"
              >
                <span>
                  {token.formatted} {token.symbol}
                </span>
                <Icon
                  name={copiedExact ? "check" : "copy"}
                  className={`w-3 h-3 flex-shrink-0 ${
                    copiedExact ? "text-emerald-600" : ""
                  }`}
                />
              </button>
            )}
          </HeroCard>
        </motion.div>

        {!token.isNative && (
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
        )}

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
