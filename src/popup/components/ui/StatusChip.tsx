type StatusChipProps = {
  status: "confirmed" | "pending" | "failed";
};

/**
 * Status pill for transaction rows. Capitalized, 10 px, tonal.
 */
export function StatusChip({ status }: StatusChipProps) {
  const map = {
    confirmed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-rose-100 text-rose-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${map[status]}`}
    >
      {status}
    </span>
  );
}
