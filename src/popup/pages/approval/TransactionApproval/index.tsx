import { motion } from "motion/react";
import { FeeTokenDropdown } from "../../../components/token/FeeTokenDropdown";
import { OriginSecurityBanner } from "../../../components/approvals/OriginSecurityBanner";
import { GlassCard, PillButton, DismissibleError } from "../../../components/ui";
import { palette, FONT_STACK } from "../../../styles/theme";
import { fadeUp, stagger } from "../../../styles/motion";
import { useTransactionApproval } from "./useTransactionApproval";

export function TransactionApproval() {
  const {
    request,
    isFetching,
    isLoading,
    error,
    isWalletSendCalls,
    calls,
    displayOrigin,
    originAnalysis,
    nativeSymbol,
    gasDecimal,
    feeTokens,
    selectedFeeToken,
    setSelectedFeeToken,
    dappRequiredFeeToken,
    formatCall,
    handleApprove,
    handleReject,
    handleClose,
    dismissError,
  } = useTransactionApproval();

  if (isFetching) {
    return (
      <div
        className="w-[400px] min-h-[600px] flex items-center justify-center text-zinc-500 text-[13px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        Loading transaction…
      </div>
    );
  }

  if (!request) {
    return (
      <div
        className="flex flex-col min-h-[600px] px-6 pt-6 pb-5 gap-4"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900">
          Transaction request
        </h2>
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
          {error || "Request not found or expired"}
        </div>
        <PillButton variant="primary" onClick={handleClose} className="py-3">
          Close
        </PillButton>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col min-h-[600px] px-6 pt-6 pb-5 gap-4"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger.base } },
      }}
    >
      <motion.div
        className="text-center pb-3 border-b border-zinc-200/60"
        variants={fadeUp}
      >
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900">
          {isWalletSendCalls && calls.length > 1
            ? "Batch transaction"
            : "Transaction request"}
        </h2>
        {isWalletSendCalls && calls.length > 1 && (
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {calls.length} transactions
          </p>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <GlassCard className="flex items-center gap-3 p-3">
          {request.metadata?.favicon && (
            <img
              src={request.metadata.favicon}
              alt=""
              className="w-8 h-8 rounded-lg object-contain bg-white/90 p-0.5 shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="text-[13px] font-medium text-zinc-700 truncate">
            {displayOrigin}
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <OriginSecurityBanner analysis={originAnalysis} />
      </motion.div>

      <motion.div
        className="flex-1 overflow-auto space-y-2.5"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger.tight } },
        }}
      >
        {calls.map((call: any, index: number) => {
          const { to, valueInEth, data } = formatCall(call);
          return (
            <motion.div key={index} variants={fadeUp}>
              <GlassCard className="p-3.5 space-y-2.5">
                {calls.length > 1 && (
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.1em]">
                    Transaction {index + 1}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-500">To</span>
                  <span className="text-[12px] font-mono text-zinc-900 break-all">
                    {to || "Contract creation"}
                  </span>
                </div>
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-[11px] text-zinc-500">Value</span>
                  <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">
                    {valueInEth} {nativeSymbol}
                  </span>
                </div>
                {data && data !== "0x" && (
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-[11px] text-zinc-500">Data</span>
                    <span className="text-[11px] font-mono text-zinc-600 text-right max-w-[200px] truncate">
                      {data.length > 20 ? `${data.slice(0, 20)}…` : data}
                    </span>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
        {!isWalletSendCalls && (
          <motion.div variants={fadeUp}>
            <GlassCard className="p-3.5">
              <div className="flex justify-between items-baseline gap-3">
                <span className="text-[11px] text-zinc-500">Est. gas</span>
                <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">
                  {gasDecimal}
                </span>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </motion.div>

      {feeTokens.length > 0 && (
        <motion.div className="space-y-1" variants={fadeUp}>
          <FeeTokenDropdown
            tokens={feeTokens}
            selected={selectedFeeToken}
            onChange={setSelectedFeeToken}
            disabled={isLoading || dappRequiredFeeToken !== null}
          />
          {dappRequiredFeeToken && (
            <p className="text-[11px] text-zinc-500 px-1">
              {feeTokens.some((t) => t.symbol === dappRequiredFeeToken)
                ? `${dappRequiredFeeToken} is required by this dApp.`
                : `${dappRequiredFeeToken} is required by this dApp but isn't available on this chain.`}
            </p>
          )}
        </motion.div>
      )}

      <DismissibleError message={error} onDismiss={dismissError} />

      <motion.div className="flex gap-2 mt-auto" variants={fadeUp}>
        <PillButton
          variant="secondary"
          onClick={handleReject}
          disabled={isLoading}
          className="flex-1 py-3"
        >
          Reject
        </PillButton>
        <PillButton
          variant="primary"
          onClick={handleApprove}
          disabled={isLoading}
          className="flex-1 py-3"
        >
          {isLoading ? "Signing…" : "Approve"}
        </PillButton>
      </motion.div>
    </motion.div>
  );
}
