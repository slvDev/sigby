import { Header } from "../../components/layout/Header";
import { BottomNav } from "../../components/layout/BottomNav";
import { PendingApprovalsCard } from "../../components/approvals/PendingApprovalsCard";
import { useHome } from "./useHome";

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
    handleCopyAddress,
    handleGoSend,
    handleGoReceive,
  } = useHome();

  if (!hasAccounts) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Berth</h1>
        <p className="text-sm text-gray-500 mb-8">
          Sign with a passkey. Same account on every chain.
        </p>

        {error && (
          <div className="w-full max-w-xs mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="w-full max-w-xs space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="wallet-name"
              className="block text-sm font-medium text-gray-700 text-left"
            >
              Name your wallet:
            </label>
            <input
              id="wallet-name"
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g. Main Wallet, Trading, Savings"
              disabled={isLoading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 text-left">
              In Touch ID prompts, you'll see: "Berth {accountCount + 1}"
              <br />
              <span className="text-gray-300">
                (Keychain names can't be changed)
              </span>
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleCreateAccount}
              disabled={isLoading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create New Wallet"}
            </button>

            <button
              onClick={handleConnectAccount}
              disabled={isLoading}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Connecting..." : "I Have a Wallet"}
            </button>
          </div>
        </div>

        <div className="mt-10 space-y-2 text-sm text-gray-400">
          <div>No passwords or seed phrases</div>
          <div>Sign in with Face ID / Touch ID</div>
          <div>Multi-chain support</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header />

      {activeAccount ? (
        <div className="flex-1 flex flex-col">
          <div className="p-6 flex flex-col gap-6 flex-1">
            <PendingApprovalsCard />

            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-sm text-gray-500">
                {activeAccount.address.slice(0, 6)}...
                {activeAccount.address.slice(-4)}
              </span>
              <button
                className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                onClick={handleCopyAddress}
                title="Copy address"
                aria-label="Copy wallet address to clipboard"
              >
                Copy
              </button>
            </div>

            <div className="text-center py-6">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Balance
              </div>
              <div className="text-4xl font-bold text-gray-900">
                {assetsLoading ? "..." : balance} {nativeSymbol}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                onClick={handleGoSend}
              >
                Send
              </button>
              <button
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                onClick={handleGoReceive}
              >
                Receive
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          <BottomNav />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 text-gray-500">
          Select an account from the dropdown above
        </div>
      )}
    </div>
  );
}
