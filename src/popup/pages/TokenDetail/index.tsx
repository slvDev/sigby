import { TokenIcon } from "../../components/token";
import { useTokenDetail } from "./useTokenDetail";

export function TokenDetail() {
  const { token, address, handleBack, handleGoToTokens, handleSend } =
    useTokenDetail();

  if (!token || !address) {
    return (
      <div className="flex flex-col min-h-[600px] w-[400px] bg-white p-6">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <button
            onClick={handleGoToTokens}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Token</h2>
        </div>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Token not found. Please go back and select a token.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[600px] w-[400px] bg-white">
      <div className="flex items-center gap-4 p-4 border-b border-gray-200">
        <button
          onClick={handleBack}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          &larr; Back
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Token Details</h2>
      </div>

      <div className="flex-1 p-6">
        <div className="flex flex-col items-center text-center">
          <TokenIcon
            symbol={token.symbol}
            address={token.address}
            logoUrl={token.logoUrl}
            size="lg"
            className="w-16 h-16 text-2xl mb-4"
          />

          <h1 className="text-2xl font-bold text-gray-900">{token.symbol}</h1>
          <p className="text-sm text-gray-500 mt-1">{token.name}</p>

          <div className="mt-8">
            <p className="text-3xl font-semibold text-gray-900">
              {token.formatted} <span className="text-xl">{token.symbol}</span>
            </p>
            {token.usdValue && (
              <p className="text-lg text-gray-500 mt-1">
                ≈ $
                {parseFloat(token.usdValue).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>

          <div className="mt-8 w-full">
            <p className="text-xs text-gray-400 mb-1">Contract Address</p>
            <p className="text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded-lg break-all">
              {token.address}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleSend}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
        >
          Send {token.symbol}
        </button>
      </div>
    </div>
  );
}
