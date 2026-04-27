import { motion } from "motion/react";
import { DismissibleError, Icon } from "../../components/ui";
import { fadeUp, tween } from "../../styles/motion";
import { FONT_STACK } from "../../styles/theme";
import { useLock } from "./useLock";

/**
 * LockScreen — shown when the wallet is locked and at least one
 * account exists. Renders in place of the regular routes; once the
 * user unlocks, the store flips `isUnlocked` and the normal Outlet
 * takes over without navigation.
 *
 * Composition: stylized lock glyph centered in the available space,
 * unlock button anchored bottom. Account-anonymous — no address,
 * name, balance, or count is rendered. The extension's toolbar icon
 * already identifies this as Berth; the popup itself doesn't need
 * to repeat the brand. A passerby sees only "this is locked."
 */
export function Lock() {
  const view = useLock();

  return (
    <div
      className="flex-1 flex flex-col px-4 pt-6 pb-8"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* Stylized lock — centered in the vertical space above the
       * action area. Gentle breathing animation on the badge so the
       * screen doesn't feel inert while waiting for input. */}
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={tween.mediumOutStrong}
          className="relative"
        >
          {/* Soft halo behind the badge for depth. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 -m-6 rounded-full bg-blue-500/10 blur-xl"
            animate={{ opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/80 backdrop-blur border border-white/80 text-zinc-700 shadow-md"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon name="lock" className="w-10 h-10" />
          </motion.span>
        </motion.div>
      </div>

      {/* Action area — error (if any), then button, then footer.
       * Anchored at the bottom of the popup. */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { delayChildren: 0.08, staggerChildren: 0.06 } },
        }}
        className="flex flex-col gap-3"
      >
        <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
          <DismissibleError
            message={view.error}
            onDismiss={view.dismissError}
            since={view.errorAt}
          />
        </motion.div>

        <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
          <motion.button
            type="button"
            onClick={view.handleUnlock}
            disabled={view.isUnlocking || !view.hasActiveAddress}
            whileHover={view.isUnlocking ? undefined : { y: -1 }}
            whileTap={view.isUnlocking ? undefined : { scale: 0.98 }}
            className="w-full py-3.5 text-[14px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {view.isUnlocking ? (
              "Waiting for passkey…"
            ) : (
              <>
                <Icon name="lock" className="w-3.5 h-3.5" />
                Unlock with passkey
              </>
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
