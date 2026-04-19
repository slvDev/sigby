import { OriginSecurityBanner } from "../../../components/approvals/OriginSecurityBanner";
import { GlassCard, PillButton } from "../../../components/ui";
import { palette, FONT_STACK } from "../../../styles/theme";
import { useConnectionApproval } from "./useConnectionApproval";

export function ConnectionApproval() {
  const {
    favicon,
    title,
    shortAddress,
    displayOrigin,
    originAnalysis,
    isKnownOrigin,
    isLoading,
    error,
    handleApprove,
    handleReject,
  } = useConnectionApproval();

  return (
    <div
      className="flex flex-col min-h-[600px] px-6 pt-6 pb-5 gap-5"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <div className="text-center pb-3 border-b border-zinc-200/60">
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900">
          Connection request
        </h2>
      </div>

      <GlassCard className="flex items-center gap-3.5 p-4">
        {favicon && (
          <img
            src={favicon}
            alt=""
            className="w-12 h-12 rounded-xl object-contain bg-white/90 p-1 shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-zinc-900 truncate">
            {title}
          </div>
          <div className="text-[12px] text-zinc-500 truncate">
            {displayOrigin}
          </div>
        </div>
      </GlassCard>

      <OriginSecurityBanner
        analysis={originAnalysis}
        isKnownOrigin={isKnownOrigin}
      />

      <div className="text-center text-[14px] text-zinc-700">
        This site wants to connect to your wallet
      </div>

      <GlassCard className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
          Account to connect
        </div>
        <div className="mt-1.5 text-[14px] font-mono font-semibold text-zinc-900">
          {shortAddress}
        </div>
      </GlassCard>

      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="text-[12px] font-semibold text-amber-900 mb-2">
          This site will be able to:
        </div>
        <ul className="space-y-1 text-[12px] text-amber-800">
          <li className="flex items-center gap-2">
            <span className="text-amber-500">•</span>
            View your wallet address
          </li>
          <li className="flex items-center gap-2">
            <span className="text-amber-500">•</span>
            Request transaction signatures
          </li>
        </ul>
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
          {isLoading ? "Connecting…" : "Connect"}
        </PillButton>
      </div>
    </div>
  );
}
