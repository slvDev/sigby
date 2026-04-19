import { Header } from "../../components/layout/Header";
import { BottomNav } from "../../components/layout/BottomNav";
import { TokenList, AddTokenModal } from "../../components/token";
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
      <div className="flex flex-col flex-1">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6 text-gray-500">
          Select an account to view tokens
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header />

      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Tokens</h1>
            <p className="text-xs text-gray-400">{chainName}</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TokenList
            tokens={tokens}
            isLoading={assetsLoading}
            error={null}
            onTokenClick={handleTokenClick}
            showRemove={true}
            onRemove={handleRemoveToken}
            emptyMessage="No tokens found. Tap 'Add' to import a custom token."
          />
        </div>

        {!assetsLoading && tokens.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100">
            <button
              onClick={handleRefresh}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Tap to refresh
            </button>
          </div>
        )}
      </div>

      <BottomNav />

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
