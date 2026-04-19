import { QRCodeSVG } from "qrcode.react";
import { FlowHeader } from "../../components/layout/FlowHeader";
import { GlassCard, Icon } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { useReceive } from "./useReceive";

export function Receive() {
  const {
    activeAccount,
    activeAddress,
    nativeSymbol,
    chainName,
    copied,
    handleCopy,
    handleBack,
  } = useReceive();

  if (!activeAccount) {
    return (
      <div
        className="flex flex-col flex-1 min-h-[600px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <FlowHeader title="Receive" onBack={handleBack} />
        <div className="px-4 pt-3">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
            No active account
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-[600px]"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <FlowHeader title="Receive" subtitle={chainName} onBack={handleBack} />

      <div className="flex flex-col items-center px-4 pt-4 pb-6 flex-1 gap-5">
        <GlassCard className="p-4" radius={22}>
          <QRCodeSVG
            value={activeAddress || ""}
            size={200}
            level="H"
            includeMargin
          />
        </GlassCard>

        <div className="text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500 mb-2">
            Your address
          </div>
          <div className="font-mono text-[12px] text-zinc-900 break-all max-w-xs">
            {activeAddress}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-3 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors"
          aria-label={copied ? "Address copied" : "Copy address"}
        >
          <Icon name={copied ? "check" : "copy"} className="w-4 h-4" />
          {copied ? "Copied" : "Copy address"}
        </button>

        <div className="text-center text-[12px] text-zinc-500 max-w-xs mt-auto">
          Only send {nativeSymbol} and ERC-20 tokens on{" "}
          <strong className="text-zinc-700">{chainName}</strong> to this
          address.
        </div>
      </div>
    </div>
  );
}
