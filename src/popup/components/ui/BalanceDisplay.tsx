import { Icon } from "./Icon";

type BalanceDisplayProps = {
  balance: string;
  symbol: string;
  fiat?: string;
  changePct?: string;
  /** Size variant for different contexts. */
  size?: "hero" | "jumbo" | "sm";
};

/**
 * Balance typography block. Uppercase label + prominent number +
 * symbol + optional fiat with trend indicator. Size variants keep the
 * visual vocabulary identical across pages that display balance at
 * different scales.
 */
export function BalanceDisplay({
  balance,
  symbol,
  fiat,
  changePct,
  size = "hero",
}: BalanceDisplayProps) {
  const sizes = {
    hero: { num: "text-[38px]", sym: "text-[18px]" },
    jumbo: { num: "text-[52px]", sym: "text-[22px]" },
    sm: { num: "text-[28px]", sym: "text-[15px]" },
  } as const;
  const s = sizes[size];
  return (
    <>
      <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
        Total balance
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`${s.num} leading-none font-semibold tracking-tight text-zinc-900 tabular-nums`}
        >
          {balance}
        </span>
        <span className={`${s.sym} font-medium text-zinc-500`}>{symbol}</span>
      </div>
      {(fiat || changePct) && (
        <div className="mt-1.5 flex items-center gap-2 text-[13px] text-zinc-500 tabular-nums">
          {fiat && <span>{fiat}</span>}
          {changePct && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <Icon name="trend-up" className="w-2.5 h-2.5" />
              {changePct}
            </span>
          )}
        </div>
      )}
    </>
  );
}
