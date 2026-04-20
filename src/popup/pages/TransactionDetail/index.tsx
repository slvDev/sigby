import { motion } from "motion/react";
import { FlowHeader } from "../../components/layout/FlowHeader";
import {
  AddressText,
  BalanceDisplay,
  GlassCard,
  HeroCard,
  Icon,
  PillButton,
  StatusChip,
} from "../../components/ui";
import { TokenIcon } from "../../components/token";
import { palette, FONT_STACK } from "../../styles/theme";
import { fadeUp, spring, stagger } from "../../styles/motion";
import { useTransactionDetail } from "./useTransactionDetail";

export function TransactionDetail() {
  const view = useTransactionDetail();

  if (view.loading) {
    return (
      <div
        className="flex flex-col flex-1 min-h-[600px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <FlowHeader title="Transaction" onBack={view.handleBack} />
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-[13px]">
          Loading…
        </div>
      </div>
    );
  }

  if (view.error) {
    return (
      <div
        className="flex flex-col flex-1 min-h-[600px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <FlowHeader title="Transaction" onBack={view.handleBack} />
        <div className="px-4 pt-3 flex flex-col gap-3">
          <GlassCard className="p-4 text-[13px] text-rose-700">
            {view.error}
          </GlassCard>
          <div className="flex justify-end">
            <PillButton variant="secondary" onClick={view.handleRetry}>
              Retry
            </PillButton>
          </div>
        </div>
      </div>
    );
  }

  const primary = view.summary.primary;
  const chainBadge = view.chainName || undefined;

  return (
    <div
      className="flex flex-col flex-1 min-h-[600px]"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <FlowHeader
        title={view.summary.title}
        subtitle={chainBadge}
        onBack={view.handleBack}
      />

      <motion.div
        className="flex flex-col gap-4 px-4 pt-3 pb-4 flex-1"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger.base } },
        }}
      >
        {/* 1. Hero — primary asset diff. */}
        <motion.div variants={fadeUp}>
          <HeroCard className="p-5 flex flex-col items-center text-center">
            {primary ? (
              <BalanceDisplay
                balance={primary.signedAmount}
                symbol={primary.symbol}
                fiat={primary.usdValue}
                size="hero"
                label="Amount"
              />
            ) : (
              <div className="py-6 text-[18px] font-semibold text-zinc-900">
                {view.summary.title}
              </div>
            )}
          </HeroCard>
        </motion.div>

        {/* 2. Status + timestamp row. */}
        <motion.div
          variants={fadeUp}
          className="flex items-center justify-between px-1"
        >
          <div className="flex items-center gap-2">
            <StatusChip status={view.statusLabel} />
            {view.relativeTime && (
              <span
                className="text-[11px] text-zinc-500"
                title={view.absoluteTime || undefined}
              >
                {view.relativeTime}
              </span>
            )}
          </div>
          {chainBadge && (
            <span className="text-[11px] font-medium text-zinc-500">
              {chainBadge}
            </span>
          )}
        </motion.div>

        {/* 3. Asset diffs. */}
        {view.assetRows.length > 0 && (
          <motion.div variants={fadeUp}>
            <GlassCard className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2">
                Asset movements
              </div>
              <ul className="divide-y divide-zinc-200/60">
                {view.assetRows.map((row, i) => (
                  <li
                    key={`${row.address ?? "native"}-${i}`}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <TokenIcon
                      symbol={row.symbol}
                      address={row.address || "native"}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-zinc-900 truncate">
                        {row.name || row.symbol}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {row.type === "erc721"
                          ? "NFT"
                          : row.type === "erc20"
                            ? "ERC-20"
                            : "Native"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-[13px] font-semibold tabular-nums ${
                          row.direction === "incoming"
                            ? "text-emerald-700"
                            : "text-zinc-900"
                        }`}
                      >
                        {row.signedAmount} {row.symbol}
                      </div>
                      {row.usdValue && (
                        <div className="text-[11px] text-zinc-500 tabular-nums">
                          {row.usdValue}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </motion.div>
        )}

        {/* 4a. What happened — decoded Orchestrator inner calls. */}
        {view.decodedRows.length > 0 && (
          <motion.div variants={fadeUp}>
            <GlassCard className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2">
                What happened
              </div>
              <ul className="divide-y divide-zinc-200/60">
                {view.decodedRows.map((row, i) => (
                  <li
                    key={`${row.kind}-${row.to}-${i}`}
                    className="flex items-start gap-3 py-2"
                  >
                    <Icon
                      name={
                        row.kind === "approve"
                          ? "lock"
                          : row.kind === "swap"
                            ? "swap"
                            : row.kind === "transfer" ||
                                row.kind === "transferFrom" ||
                                row.kind === "native-transfer"
                              ? "send"
                              : "activity"
                      }
                      className="w-3.5 h-3.5 mt-0.5 text-zinc-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-zinc-900 truncate">
                        {row.label}
                      </div>
                      {row.counterparty && (
                        <AddressText address={row.counterparty} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </motion.div>
        )}

        {/* 4. Fees. */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                Network fee
              </div>
              {view.fee.sponsored && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                  Sponsored
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[14px] font-semibold text-zinc-900 tabular-nums">
                {view.fee.amount
                  ? `${view.fee.amount} ${view.fee.currency || ""}`.trim()
                  : view.fee.sponsored
                    ? "Paid by sponsor"
                    : "—"}
              </span>
              {view.fee.usdValue && (
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {view.fee.usdValue}
                </span>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* 5. Parties. */}
        {view.counterparties.length > 0 && (
          <motion.div variants={fadeUp}>
            <GlassCard className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2">
                {view.summary.direction === "send"
                  ? "To"
                  : view.summary.direction === "receive"
                    ? "From"
                    : "Counterparties"}
              </div>
              <div className="flex flex-col gap-2">
                {view.counterparties.map((addr) => (
                  <AddressText key={addr} address={addr} />
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* 6. Provenance. */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2">
              Signed by
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-zinc-900 truncate">
                  {view.signerLabel}
                </div>
                {view.keyHash && (
                  <div className="text-[11px] text-zinc-500 font-mono truncate">
                    {view.keyHash.slice(0, 10)}…{view.keyHash.slice(-8)}
                  </div>
                )}
              </div>
              {!view.signerIsAdmin && view.keyHash && (
                <PillButton
                  variant="secondary"
                  onClick={view.goPermissions}
                  ariaLabel="Manage session keys"
                >
                  Manage sessions
                </PillButton>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* 7. Bundle id + transactions. */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2">
              Bundle
            </div>
            <AddressText address={view.bundleId} />
            {view.transactions.length > 0 && (
              <>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2">
                  Transactions
                </div>
                <ul className="flex flex-col gap-2">
                  {view.transactions.map((t) => (
                    <li
                      key={t.transactionHash}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-zinc-500">
                          {t.chainName}
                        </div>
                        <AddressText address={t.transactionHash} />
                      </div>
                      {t.explorerUrl && (
                        <a
                          href={t.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-zinc-800 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded"
                          aria-label="View transaction on explorer"
                        >
                          <Icon name="external" className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </GlassCard>
        </motion.div>

        {/* 8. Developer accordion. */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <motion.button
              type="button"
              onClick={view.toggleDev}
              whileTap={{ scale: 0.98 }}
              transition={spring.snap}
              className="w-full flex items-center justify-between text-[12px] font-medium text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded"
              aria-expanded={view.devOpen}
            >
              <span>Developer data</span>
              <Icon
                name={view.devOpen ? "chevron-down" : "chevron-right"}
                className="w-4 h-4 text-zinc-400"
              />
            </motion.button>
            {view.devOpen && (
              <div className="mt-3 space-y-3">
                {view.status?.receipts?.map((r, i) => (
                  <div key={`${r.transactionHash}-${i}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-1">
                      Logs · {r.transactionHash.slice(0, 6)}…
                      {r.transactionHash.slice(-4)}
                    </div>
                    {r.logs && r.logs.length > 0 ? (
                      <pre className="text-[10px] font-mono text-zinc-700 bg-white/60 border border-white/80 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(r.logs, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-[11px] text-zinc-500">No logs</div>
                    )}
                  </div>
                ))}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-1">
                    Raw entry
                  </div>
                  <pre className="text-[10px] font-mono text-zinc-700 bg-white/60 border border-white/80 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(view.entry, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
