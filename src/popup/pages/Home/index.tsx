import { PendingApprovalsCard } from "../../components/approvals/PendingApprovalsCard";
import {
  HeroCard,
  GlassCard,
  AddressText,
  BalanceDisplay,
  QuickActionButton,
  ActivityRow,
} from "../../components/ui";
import { useHome } from "./useHome";
import { useHistory } from "../History/useHistory";

export function Home() {
  const {
    walletName,
    setWalletName,
    accountCount,
    activeAccount,
    hasAccounts,
    balance,
    nativeSymbol,
    assetsLoading,
    isLoading,
    error,
    handleCreateAccount,
    handleConnectAccount,
    handleGoSend,
    handleGoReceive,
  } = useHome();

  // Show a preview of the most recent transactions inline on Home —
  // full list lives on the Activity tab. Watcher polling in the
  // background keeps this fresh on status changes.
  const { transactions, getChainName } = useHistory();
  const recent = transactions.slice(0, 3);

  if (!hasAccounts) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 mb-2">
          Berth
        </h1>
        <p className="text-[13px] text-zinc-500 mb-8">
          Sign with a passkey. Same account on every chain.
        </p>

        {error && (
          <div className="w-full max-w-xs mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
            {error}
          </div>
        )}

        <div className="w-full max-w-xs space-y-4">
          <div className="space-y-2 text-left">
            <label
              htmlFor="wallet-name"
              className="block text-[13px] font-medium text-zinc-700"
            >
              Name your wallet
            </label>
            <input
              id="wallet-name"
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. Main, Trading, Savings"
              disabled={isLoading}
              className="w-full px-4 py-3 text-[14px] bg-white/80 backdrop-blur border border-white/80 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
            />
            <p className="text-[11px] text-zinc-400">
              Touch ID prompt will show "Berth {accountCount + 1}"
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={handleCreateAccount}
              disabled={isLoading}
              className="w-full py-3 text-[14px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating…" : "Create new wallet"}
            </button>

            <button
              onClick={handleConnectAccount}
              disabled={isLoading}
              className="w-full py-3 text-[14px] font-semibold bg-white/80 backdrop-blur border border-white/80 text-zinc-800 rounded-xl hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Connecting…" : "I have a wallet"}
            </button>
          </div>
        </div>

        <div className="mt-10 space-y-1 text-[12px] text-zinc-400">
          <div>No passwords or seed phrases</div>
          <div>Sign in with Face ID / Touch ID</div>
          <div>Multi-chain support</div>
        </div>
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-[13px]">
        Select an account from the header.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PendingApprovalsCard />

      <HeroCard className="p-5">
        <BalanceDisplay
          balance={assetsLoading ? "…" : balance}
          symbol={nativeSymbol}
        />
        <div className="mt-3">
          <AddressText address={activeAccount.address} />
        </div>
      </HeroCard>

      <div className="grid grid-cols-3 gap-2.5">
        <QuickActionButton label="Send" icon="send" onClick={handleGoSend} />
        <QuickActionButton
          label="Receive"
          icon="receive"
          onClick={handleGoReceive}
        />
        <QuickActionButton label="Swap" icon="swap" disabled />
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
          {error}
        </div>
      )}

      {recent.length > 0 && (
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-[13px] font-semibold text-zinc-900 tracking-tight">
              Recent activity
            </h2>
          </div>
          <GlassCard className="overflow-hidden">
            <ul className="divide-y divide-zinc-200/60">
              {recent.map((tx) => (
                <li key={tx.id}>
                  <ActivityRow
                    direction="other"
                    title="Transaction"
                    subtitle={`${getChainName(tx.chainId)} · ${
                      tx.hash
                        ? `${tx.hash.slice(0, 6)}…${tx.hash.slice(-4)}`
                        : "pending"
                    }`}
                    status={tx.status}
                  />
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
