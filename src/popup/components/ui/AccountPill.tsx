import type { MouseEvent } from "react";
import { motion } from "motion/react";
import { Icon } from "./Icon";
import { SOFT_SHADOW } from "../../styles/theme";
import { spring } from "../../styles/motion";

type AccountPillProps = {
  displayName: string;
  addressTruncated: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * Account switcher pill. Avatar initial + display name + truncated
 * address + chevron. Click opens account switcher.
 */
export function AccountPill({
  displayName,
  addressTruncated,
  onClick,
}: AccountPillProps) {
  const initial = displayName.slice(0, 1).toUpperCase() || "A";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Switch account"
      whileTap={{ scale: 0.97 }}
      transition={spring.snap}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 text-[13px] font-semibold text-zinc-900 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      style={{ boxShadow: SOFT_SHADOW }}
    >
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[11px] font-semibold">
        {initial}
      </span>
      <span className="leading-none">{displayName}</span>
      <span className="text-zinc-500 font-normal leading-none tabular-nums">
        {addressTruncated}
      </span>
      <Icon name="chevron-down" className="w-3.5 h-3.5 text-zinc-400" />
    </motion.button>
  );
}
