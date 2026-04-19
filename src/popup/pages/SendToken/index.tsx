import { TokenIcon, FeeTokenSelector } from "../../components/token";
import { useSendToken } from "./useSendToken";

export function SendToken() {
  const {
    token,
    tokenAddress,
    recipient,
    setRecipient,
    amount,
    setAmount,
    isLoading,
    error,
    feeTokens,
    selectedFeeToken,
    setSelectedFeeToken,
    handleSetMax,
    handleSend,
    handleBack,
    handleGoToTokens,
  } = useSendToken();

  if (!token || !tokenAddress) {
    return (
      <div className="flex flex-col min-h-[600px] w-[400px] bg-white p-6">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <button
            onClick={handleGoToTokens}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Send Token</h2>
        </div>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Token not found. Please go back and select a token.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[600px] w-[400px] bg-white p-6">
      <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
        <button
          onClick={handleBack}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-2">
          <TokenIcon
            symbol={token.symbol}
            address={token.address}
            logoUrl={token.logoUrl}
            size="sm"
          />
          <h2 className="text-lg font-semibold text-gray-900">
            Send {token.symbol}
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-5 mt-6 flex-1">
        <div className="flex flex-col gap-2">
          <label htmlFor="recipient" className="text-sm font-medium text-gray-700">
            Recipient Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl
                       placeholder:text-gray-400
                       focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                       disabled:bg-gray-100 disabled:cursor-not-allowed
                       transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="amount" className="text-sm font-medium text-gray-700">
            Amount ({token.symbol})
          </label>
          <div className="relative">
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="any"
              min="0"
              disabled={isLoading}
              className="w-full px-4 py-3 pr-16 text-sm border-2 border-gray-200 rounded-xl
                         placeholder:text-gray-400
                         focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                         disabled:bg-gray-100 disabled:cursor-not-allowed
                         transition-colors"
            />
            <button
              type="button"
              onClick={handleSetMax}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100 disabled:opacity-50 transition-colors"
            >
              MAX
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Available: {token.formatted} {token.symbol}
          </p>
        </div>

        {feeTokens.length > 0 && (
          <FeeTokenSelector
            tokens={feeTokens}
            selected={selectedFeeToken}
            onChange={setSelectedFeeToken}
            disabled={isLoading}
          />
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleBack}
            disabled={isLoading}
            className="flex-1 px-4 py-3.5 text-sm font-semibold text-gray-900 bg-gray-100
                       rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !recipient || !amount}
            className="flex-1 px-4 py-3.5 text-sm font-semibold text-white bg-primary-600
                       rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
