import { motion } from "motion/react";
import { OriginSecurityBanner } from "../../../components/approvals/OriginSecurityBanner";
import { GlassCard, PillButton, DismissibleError } from "../../../components/ui";
import { palette, FONT_STACK } from "../../../styles/theme";
import { fadeUp, stagger } from "../../../styles/motion";
import { docking } from "../../../styles/signatureMotion";
import {
  useGrantPermissionsApproval,
  formatAddress,
  formatExpiry,
} from "./useGrantPermissionsApproval";

export function GrantPermissionsApproval() {
  const {
    request,
    permissionRequest,
    isFetching,
    isLoading,
    error,
    originAnalysis,
    displayOrigin,
    handleApprove,
    handleReject,
    handleClose,
    dismissError,
  } = useGrantPermissionsApproval();

  if (isFetching) {
    return (
      <div
        className="w-[400px] min-h-[600px] flex items-center justify-center text-zinc-500 text-[13px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        Loading permission request…
      </div>
    );
  }

  if (!request || !permissionRequest) {
    return (
      <div
        className="flex flex-col min-h-[600px] px-6 pt-6 pb-5 gap-4"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900">
          Permission request
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

  const calls = permissionRequest.permissions.calls ?? [];
  const spendLimits = permissionRequest.permissions.spend ?? [];

  return (
    <motion.div
      className="flex flex-col min-h-[600px] px-6 pt-6 pb-5 gap-4"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      initial="hidden"
      animate="show"
      variants={{
        hidden: docking.initial,
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            ...docking.transition,
            staggerChildren: stagger.base,
          },
        },
      }}
    >
      <motion.div
        className="text-center pb-3 border-b border-zinc-200/60"
        variants={fadeUp}
      >
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900">
          Grant session key
        </h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          The dApp will sign within these limits without prompting you each
          time.
        </p>
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

      <motion.div variants={fadeUp}>
        <GlassCard className="p-3.5">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
            Expires
          </div>
          <div className="mt-1 text-[13px] text-zinc-900">
            {formatExpiry(permissionRequest.expiry)}
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <GlassCard className="p-3.5">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">
            Allowed calls ({calls.length})
          </div>
          <motion.div
            className="space-y-1.5"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: stagger.tight } },
            }}
          >
            {calls.map((call, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                className="px-3 py-2 bg-white/60 rounded-lg text-[11px] font-mono text-zinc-700 break-all"
              >
                {call.to && <div>to {formatAddress(call.to)}</div>}
                {call.signature && (
                  <div className="text-zinc-500">{call.signature}</div>
                )}
                {call.selector && (
                  <div className="text-zinc-500">selector {call.selector}</div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </GlassCard>
      </motion.div>

      {spendLimits.length > 0 && (
        <motion.div variants={fadeUp}>
          <GlassCard className="p-3.5">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">
              Spend limits
            </div>
            <div className="space-y-1.5">
              {spendLimits.map((limit, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 bg-white/60 rounded-lg text-[12px] text-zinc-700"
                >
                  <span className="font-mono tabular-nums">{limit.limit}</span>{" "}
                  per {limit.period} on{" "}
                  <span className="font-mono">{formatAddress(limit.token)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <GlassCard className="p-3.5">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
            Fee token
          </div>
          <div className="mt-1 text-[12px] text-zinc-700">
            {permissionRequest.feeToken ? (
              <>
                Up to{" "}
                <span className="font-mono tabular-nums">
                  {permissionRequest.feeToken.limit}
                </span>{" "}
                {permissionRequest.feeToken.symbol ?? "native"}
              </>
            ) : (
              <span className="text-zinc-500">
                No fee allowance — session key cannot pay gas.
              </span>
            )}
          </div>
        </GlassCard>
      </motion.div>

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
          {isLoading ? "Approving…" : "Approve"}
        </PillButton>
      </motion.div>
    </motion.div>
  );
}
