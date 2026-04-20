import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { FlowHeader } from "../../components/layout/FlowHeader";
import { GlassCard, Icon } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { fadeUp, spring, stagger, tween } from "../../styles/motion";
import { useReceive } from "./useReceive";

export function Receive() {
  const {
    activeAccount,
    activeAddress,
    nativeSymbol,
    chainName,
    copied,
    handleCopy,
    handleBack,
  } = useReceive();

  if (!activeAccount) {
    return (
      <div
        className="flex flex-col flex-1 min-h-[600px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <FlowHeader title="Receive" onBack={handleBack} />
        <div className="px-4 pt-3">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
            No active account
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-[600px]"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <FlowHeader title="Receive" subtitle={chainName} onBack={handleBack} />

      <motion.div
        className="flex flex-col items-center px-4 pt-4 pb-6 flex-1 gap-5"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger.base } },
        }}
      >
        {/* QR mount — scale+fade reveal. The QR image is crisp so the
         * subtle 0.96 → 1 scale reads as depth rather than magnification. */}
        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 0.96 },
            show: { opacity: 1, scale: 1 },
          }}
          transition={{ ...tween.mediumOutStrong, duration: 0.35 }}
        >
          <GlassCard className="p-4" radius={22}>
            <QRCodeSVG
              value={activeAddress || ""}
              size={200}
              level="H"
              includeMargin
            />
          </GlassCard>
        </motion.div>

        <motion.div className="text-center" variants={fadeUp}>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500 mb-2">
            Your address
          </div>
          <div className="font-mono text-[12px] text-zinc-900 break-all max-w-xs">
            {activeAddress}
          </div>
        </motion.div>

        <motion.button
          onClick={handleCopy}
          variants={fadeUp}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={spring.snap}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-3 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors"
          aria-label={copied ? "Address copied" : "Copy address"}
        >
          {/* Icon cross-fade between copy + check — draws on the mode
           * switch instead of replacing the glyph, which read as a
           * dropped frame. 220 ms ease-out. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "check" : "copy"}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={spring.snap}
              className="inline-flex"
            >
              <Icon name={copied ? "check" : "copy"} className="w-4 h-4" />
            </motion.span>
          </AnimatePresence>
          <motion.span layout>{copied ? "Copied" : "Copy address"}</motion.span>
        </motion.button>

        <motion.div
          className="text-center text-[12px] text-zinc-500 max-w-xs mt-auto"
          variants={fadeUp}
        >
          Only send {nativeSymbol} and ERC-20 tokens on{" "}
          <strong className="text-zinc-700">{chainName}</strong> to this
          address.
        </motion.div>
      </motion.div>
    </div>
  );
}
