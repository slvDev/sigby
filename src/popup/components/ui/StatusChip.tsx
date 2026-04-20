import { motion } from "motion/react";
import { spring } from "../../styles/motion";

type StatusChipProps = {
  status: "confirmed" | "pending" | "failed";
};

/**
 * Status pill for transaction rows. Capitalized, 10 px, tonal. `layout`
 * lets the row's parent reshape when the chip mounts/unmounts instead
 * of snapping to the new size (research §6.5).
 */
export function StatusChip({ status }: StatusChipProps) {
  const map = {
    confirmed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-rose-100 text-rose-700",
  } as const;
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring.soft}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${map[status]}`}
    >
      {status}
    </motion.span>
  );
}
