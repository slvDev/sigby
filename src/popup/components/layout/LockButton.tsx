import { motion } from "motion/react";
import { useWalletStore } from "../../store";
import { Icon } from "../ui";
import { spring } from "../../styles/motion";

/**
 * LockButton — header icon button that locks the wallet immediately.
 * Styled to match AccountPill / ChainPill visual weight (small glass
 * surface, rounded-full) so the header row reads as one group.
 */
export function LockButton() {
  const lock = useWalletStore((s) => s.lock);

  return (
    <motion.button
      type="button"
      onClick={() => lock()}
      aria-label="Lock wallet"
      title="Lock wallet"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.94 }}
      transition={spring.snap}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/70 backdrop-blur border border-white/80 text-zinc-700 hover:text-zinc-900 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
    >
      <Icon name="lock" className="w-3.5 h-3.5" />
    </motion.button>
  );
}
