import { AnimatePresence, motion } from "motion/react";
import { GlassCard, ActivityRow, Icon, PillButton } from "../../components/ui";
import { fadeUp, stagger, tween } from "../../styles/motion";
import { useHistory } from "./useHistory";

export function History() {
  const {
    rows,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    pendingCount,
    getChainName,
    getExplorerUrl,
    openDetail,
    loadMore,
  } = useHistory();

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
          Activity
        </h1>
        <AnimatePresence initial={false}>
          {pendingCount > 0 && (
            <motion.div
              key="pending-pill"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={tween.shortOut}
              className="flex items-center gap-1.5 text-[11px] text-amber-700"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              {pendingCount} pending
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-[13px]">
          Loading…
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <motion.div
          className="flex-1 flex flex-col items-center justify-center text-center px-6"
          initial={fadeUp.hidden}
          animate={fadeUp.show}
          transition={tween.baseOut}
        >
          <div className="text-[14px] font-semibold text-zinc-800">
            No transactions yet
          </div>
          <p className="text-[12px] text-zinc-500 mt-1">
            Your activity will appear here.
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
        <GlassCard className="overflow-hidden flex-1 min-h-0">
          <ul className="divide-y divide-zinc-200/60 overflow-y-auto max-h-full">
            <AnimatePresence initial={false}>
              {rows.map((tx, i) => {
                const dir: "in" | "out" | "other" | "approve" =
                  tx.summary.direction === "send"
                    ? "out"
                    : tx.summary.direction === "receive"
                      ? "in"
                      : tx.summary.direction === "approve"
                        ? "approve"
                        : "other";
                const chainLabel = getChainName(tx.chainId);
                const parts: string[] = [];
                if (tx.relativeTime) parts.push(tx.relativeTime);
                parts.push(chainLabel);
                if (tx.summary.counterparty) {
                  const c = tx.summary.counterparty;
                  parts.push(`${c.slice(0, 6)}…${c.slice(-4)}`);
                } else if (tx.hash) {
                  parts.push(`${tx.hash.slice(0, 6)}…${tx.hash.slice(-4)}`);
                }
                const subtitle = parts.join(" · ");
                return (
                  <motion.li
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      ...tween.baseOut,
                      // Cap stagger at 5 rows — past that, simultaneous reads faster.
                      delay: Math.min(i, 5) * stagger.tight,
                    }}
                    className="relative group"
                  >
                    <ActivityRow
                      direction={dir}
                      title={tx.summary.title}
                      subtitle={subtitle}
                      amount={tx.summary.primary?.signedAmount
                        ? `${tx.summary.primary.signedAmount} ${tx.summary.primary.symbol}`
                        : undefined}
                      status={tx.status}
                      onClick={() => openDetail(tx.id)}
                    />
                    {tx.hash && (
                      <a
                        href={getExplorerUrl(tx.chainId, tx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 p-1 focus:outline-none focus-visible:opacity-100 transition-opacity"
                        aria-label="View on explorer"
                      >
                        <Icon name="external" className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </GlassCard>
        {hasMore && (
          <div className="flex justify-center pb-1">
            <PillButton
              variant="secondary"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </PillButton>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
