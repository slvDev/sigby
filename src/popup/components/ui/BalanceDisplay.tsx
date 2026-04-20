import { Icon } from "./Icon";
import { NumberTicker } from "./NumberTicker";
import { NumberScramble } from "./NumberScramble";

type BalanceDisplayProps = {
  balance: string;
  symbol: string;
  fiat?: string;
  changePct?: string;
  /** Size variant for different contexts. */
  size?: "hero" | "jumbo" | "sm";
  /** Uppercase caption above the number. Defaults to "Total balance". */
  label?: string;
  /**
   * When true, renders `balance` as a spring-animated ticker (parses
   * the string numerically, formats with the same digit count). When
   * false (default), renders the string verbatim — useful for the
   * loading ellipsis placeholder.
   */
  animateValue?: boolean;
  /**
   * When supplied, changes to this key trigger a scramble (chaotic
   * intermediate values before landing). In-place balance updates
   * that leave `scrambleKey` stable continue to use the smooth ticker.
   * Typical use: pass `activeAddress` so an account switch scrambles,
   * while a balance refresh within the same account tickers.
   */
  scrambleKey?: string | number;
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
  label = "Total balance",
  animateValue = false,
  scrambleKey,
}: BalanceDisplayProps) {
  const sizes = {
    hero: { num: "text-[38px]", sym: "text-[18px]" },
    jumbo: { num: "text-[52px]", sym: "text-[22px]" },
    sm: { num: "text-[28px]", sym: "text-[15px]" },
  } as const;
  const s = sizes[size];

  const parsed = parseFloat(balance);
  const canTick = animateValue && Number.isFinite(parsed);
  const decimals = (() => {
    const dot = balance.indexOf(".");
    return dot >= 0 ? balance.length - dot - 1 : 0;
  })();
  const format = (v: number) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();

  return (
    <>
      <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        {canTick ? (
          scrambleKey !== undefined ? (
            <NumberScramble
              value={parsed}
              format={format}
              scrambleKey={scrambleKey}
              className={`${s.num} leading-none font-semibold tracking-tight text-zinc-900`}
              ariaLabel="Balance"
            />
          ) : (
            <NumberTicker
              value={parsed}
              format={format}
              className={`${s.num} leading-none font-semibold tracking-tight text-zinc-900`}
              ariaLabel="Balance"
            />
          )
        ) : (
          <span
            className={`${s.num} leading-none font-semibold tracking-tight text-zinc-900 tabular-nums`}
          >
            {balance}
          </span>
        )}
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
