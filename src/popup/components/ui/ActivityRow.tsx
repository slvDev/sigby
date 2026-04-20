import { AnimatePresence } from "motion/react";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";

type ActivityRowProps = {
  /** Direction bubble: up arrow for out, down for in, swap for other */
  direction: "in" | "out" | "other";
  /** First-line label (e.g. "Sent", "Received", "Swap") */
  title: string;
  /** Second-line subtitle (e.g. counterparty · time). Optional. */
  subtitle?: string;
  /** Right-side amount, signed as needed by the caller. */
  amount?: string;
  status: "confirmed" | "pending" | "failed";
  /** Drops the subtitle and shrinks dimensions — used in compact lists. */
  compact?: boolean;
  onClick?: () => void;
};

/**
 * One activity row. Direction-tinted icon bubble + title + optional
 * subtitle + status chip + amount. Tap target is the whole row when
 * onClick is provided.
 */
export function ActivityRow({
  direction,
  title,
  subtitle,
  amount,
  status,
  compact = false,
  onClick,
}: ActivityRowProps) {
  const bubbleTone =
    direction === "out"
      ? "bg-gradient-to-b from-zinc-50 to-zinc-100 border-zinc-200 text-zinc-700"
      : direction === "in"
        ? "bg-gradient-to-b from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700"
        : "bg-gradient-to-b from-blue-50 to-blue-100 border-blue-200 text-blue-700";

  const iconName =
    direction === "out" ? "arrow-up" : direction === "in" ? "arrow-down" : "swap";

  const content = (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 ${
        compact ? "px-3 py-2" : "px-3.5 py-2.5"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full border ${
          compact ? "w-7 h-7" : "w-9 h-9"
        } ${bubbleTone}`}
        aria-hidden="true"
      >
        <Icon name={iconName} className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-semibold text-zinc-900 ${
              compact ? "text-[12px]" : "text-[13px]"
            }`}
          >
            {title}
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            {status !== "confirmed" && <StatusChip key={status} status={status} />}
          </AnimatePresence>
        </div>
        {subtitle && !compact && (
          <div className="text-[11px] text-zinc-500 tabular-nums leading-tight mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
      {amount && (
        <div
          className={`text-right font-semibold tabular-nums ${
            compact ? "text-[12px]" : "text-[13px]"
          } ${direction === "in" ? "text-emerald-700" : "text-zinc-900"}`}
        >
          {amount}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left hover:bg-white/70 focus:outline-none focus-visible:bg-white/70 rounded-xl"
      >
        {content}
      </button>
    );
  }
  return content;
}
