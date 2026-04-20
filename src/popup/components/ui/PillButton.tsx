import type { ReactNode, MouseEvent } from "react";
import { motion } from "motion/react";
import { SOFT_SHADOW } from "../../styles/theme";
import { spring } from "../../styles/motion";

type PillButtonProps = {
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  ariaCurrent?: boolean;
};

/**
 * Glassy pill button. `primary` = accent-blue fill, `secondary` =
 * white-on-glass, `danger` = rose fill. Used for actions, chain
 * selectors, copy affordances, account switchers.
 */
export function PillButton({
  variant = "secondary",
  type = "button",
  onClick,
  className = "",
  children,
  disabled = false,
  ariaLabel,
  ariaCurrent,
}: PillButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full border text-[13px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
  const variants = {
    primary:
      "bg-blue-600 text-white border-blue-700/20 hover:bg-blue-700 px-4 py-2",
    secondary:
      "bg-white/75 backdrop-blur-xl border-white/80 text-zinc-800 hover:bg-white/95 px-3 py-1.5",
    danger:
      "bg-rose-600 text-white border-rose-700/20 hover:bg-rose-700 px-4 py-2",
  } as const;
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={ariaCurrent ? "page" : undefined}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring.snap}
      className={`${base} ${variants[variant]} ${className}`}
      style={{ boxShadow: SOFT_SHADOW }}
    >
      {children}
    </motion.button>
  );
}
