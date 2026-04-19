import { FlowHeader } from "../../components/layout/FlowHeader";
import { GlassCard, DismissibleError } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { useSend } from "./useSend";

export function Send() {
  const {
    activeAccount,
    currencySymbol,
    chainName,
    recipient,
    setRecipient,
    amount,
    setAmount,
    isLoading,
    error,
    userBalance,
    handleSend,
    handleBack,
    dismissError,
  } = useSend();

  if (!activeAccount) {
    return (
      <div
        className="flex flex-col flex-1 min-h-[600px]"
        style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
      >
        <FlowHeader title="Send" onBack={handleBack} />
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
      <FlowHeader
        title={`Send ${currencySymbol}`}
        subtitle={chainName}
        onBack={handleBack}
      />

      <div className="flex flex-col gap-4 px-4 pt-3 pb-4 flex-1">
        <GlassCard className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="recipient"
              className="block text-[12px] font-medium text-zinc-700"
            >
              Recipient address
            </label>
            <input
              id="recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x…"
              disabled={isLoading}
              className="w-full px-3 py-2.5 text-[13px] font-mono bg-white/70 border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="amount"
                className="text-[12px] font-medium text-zinc-700"
              >
                Amount
              </label>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                Available: {userBalance.toFixed(7)} {currencySymbol}
              </span>
            </div>
            <div className="relative">
              <input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                step="0.0001"
                min="0"
                disabled={isLoading}
                className="w-full px-3 py-2.5 pr-16 text-[14px] font-semibold tabular-nums bg-white/70 border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-zinc-500">
                {currencySymbol}
              </span>
            </div>
          </div>
        </GlassCard>

        <DismissibleError message={error} onDismiss={dismissError} />

        <div className="flex-1" />

        <div className="flex gap-2">
          <button
            onClick={handleBack}
            disabled={isLoading}
            className="flex-1 py-3 text-[13px] font-semibold bg-white/80 border border-white/80 text-zinc-800 rounded-xl hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !recipient || !amount}
            className="flex-1 py-3 text-[13px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
