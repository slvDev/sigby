import { OriginSecurityBanner } from "../../../components/approvals/OriginSecurityBanner";
import { GlassCard, PillButton, Icon } from "../../../components/ui";
import { palette, FONT_STACK } from "../../../styles/theme";
import { useSigningApproval } from "./useSigningApproval";

export function SigningApproval() {
  const {
    request,
    isFetching,
    isLoading,
    error,
    isPersonalSign,
    messageContent,
    typedDataDomain,
    displayOrigin,
    originAnalysis,
    hasInvisibleChars,
    handleApprove,
    handleReject,
    handleClose,
  } = useSigningApproval();

  if (isFetching) {
    return (
      <div
        className="w-[400px] min-h-[600px] flex items-center justify-center text-zinc-500 text-[13px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        Loading request…
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
          Signature request
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
    <div
      className="flex flex-col min-h-[600px] px-6 pt-6 pb-5 gap-4"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <div className="text-center pb-3 border-b border-zinc-200/60">
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900">
          {isPersonalSign ? "Signature request" : "Typed data signature"}
        </h2>
      </div>

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

      <OriginSecurityBanner analysis={originAnalysis} />

      {typedDataDomain && (
        <GlassCard className="p-3.5 space-y-1 text-[12px] text-zinc-700">
          {typedDataDomain.name && (
            <div>
              <span className="text-zinc-500">Domain:</span>{" "}
              <span className="font-semibold">{typedDataDomain.name}</span>
            </div>
          )}
          {typedDataDomain.chainId !== undefined && (
            <div>
              <span className="text-zinc-500">Chain ID:</span>{" "}
              <span className="font-mono tabular-nums">
                {typeof typedDataDomain.chainId === "string"
                  ? typedDataDomain.chainId
                  : String(typedDataDomain.chainId)}
              </span>
            </div>
          )}
          {typedDataDomain.verifyingContract && (
            <div className="break-all">
              <span className="text-zinc-500">Verifying contract:</span>{" "}
              <span className="font-mono">
                {typedDataDomain.verifyingContract}
              </span>
            </div>
          )}
        </GlassCard>
      )}

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] px-1">
          {isPersonalSign ? "Message to sign" : "Typed data to sign"}
        </div>
        {hasInvisibleChars && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-900 flex items-start gap-2">
            <Icon name="warning" className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              This message contains invisible or directional characters that
              can disguise its true content. Review carefully before signing.
            </span>
          </div>
        )}
        <GlassCard className="flex-1 p-4 overflow-auto max-h-[300px]">
          <pre className="font-mono text-[12px] leading-relaxed text-zinc-700 whitespace-pre-wrap break-words m-0">
            {messageContent}
          </pre>
        </GlassCard>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
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
          {isLoading ? "Signing…" : "Sign"}
        </PillButton>
      </div>
    </div>
  );
}
