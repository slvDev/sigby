import { AddTokenModal } from "../../components/token";
import { GlassCard, Icon, PillButton } from "../../components/ui";
import { useTokens } from "./useTokens";

export function Tokens() {
  const {
    activeAddress,
    chainId,
    chainName,
    tokens,
    assetsLoading,
    isAddModalOpen,
    handleTokenAdded,
    handleTokenClick,
    handleRemoveToken,
    openAddModal,
    closeAddModal,
    handleRefresh,
  } = useTokens();

  if (!activeAddress) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-[13px]">
        Select an account to view tokens.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
            Tokens
          </h1>
          <p className="text-[11px] text-zinc-500">{chainName}</p>
        </div>
        <PillButton variant="primary" onClick={openAddModal}>
          <Icon name="plus" className="w-3.5 h-3.5" />
          Add
        </PillButton>
      </div>

      {assetsLoading && tokens.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-[13px]">
          Loading tokens…
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-[14px] font-semibold text-zinc-800">
            No tokens found
          </div>
          <p className="text-[12px] text-zinc-500 mt-1">
            Tap "Add" to import a custom token.
          </p>
        </div>
      ) : (
        <GlassCard className="overflow-hidden flex-1 min-h-0">
          <ul className="divide-y divide-zinc-200/60 overflow-y-auto max-h-full">
            {tokens.map((token) => (
              <li key={token.address}>
                <button
                  type="button"
                  onClick={() => handleTokenClick(token)}
                  className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-2.5 hover:bg-white/70 focus:outline-none focus-visible:bg-white/70 text-left"
                >
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[11px] font-semibold"
                    aria-hidden="true"
                  >
                    {token.symbol.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-zinc-900 truncate">
                      {token.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 tabular-nums">
                      {token.formatted} {token.symbol}
                    </div>
                  </div>
                  <div className="text-right">
                    {token.usdValue && (
                      <div className="text-[13px] font-semibold text-zinc-900 tabular-nums">
                        $
                        {parseFloat(token.usdValue).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    )}
                    {token.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveToken(token);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-rose-600 mt-0.5"
                        aria-label={`Remove ${token.symbol}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {!assetsLoading && tokens.length > 0 && (
        <button
          onClick={handleRefresh}
          className="text-[11px] text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:underline"
        >
          Tap to refresh
        </button>
      )}

      <AddTokenModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onSuccess={handleTokenAdded}
        accountAddress={activeAddress}
        chainId={chainId}
        chainName={chainName}
      />
    </div>
  );
}
