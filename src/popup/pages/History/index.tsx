import { GlassCard, ActivityRow, Icon } from "../../components/ui";
import { useHistory } from "./useHistory";

export function History() {
  const {
    transactions,
    isLoading,
    error,
    pendingCount,
    getChainName,
    getExplorerUrl,
  } = useHistory();

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
          Activity
        </h1>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            {pendingCount} pending
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-[13px]">
          Loading…
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
          {error}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-[14px] font-semibold text-zinc-800">
            No transactions yet
          </div>
          <p className="text-[12px] text-zinc-500 mt-1">
            Your activity will appear here.
          </p>
        </div>
      ) : (
        <GlassCard className="overflow-hidden flex-1 min-h-0">
          <ul className="divide-y divide-zinc-200/60 overflow-y-auto max-h-full">
            {transactions.map((tx) => {
              const subtitle = `${getChainName(tx.chainId)}${
                tx.hash ? ` · ${tx.hash.slice(0, 6)}…${tx.hash.slice(-4)}` : ""
              }`;
              const row = (
                <ActivityRow
                  direction="other"
                  title="Transaction"
                  subtitle={subtitle}
                  status={tx.status}
                />
              );
              return (
                <li key={tx.id} className="relative group">
                  {row}
                  {tx.hash && (
                    <a
                      href={getExplorerUrl(tx.chainId, tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 p-1 focus:outline-none focus-visible:opacity-100"
                      aria-label="View on explorer"
                    >
                      <Icon name="external" className="w-3.5 h-3.5" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
