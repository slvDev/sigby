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
  } = useSend();

  if (!activeAccount) {
    return (
      <div className="flex flex-col min-h-[600px] w-[400px] bg-white p-6">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <button
            onClick={handleBack}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Send</h2>
        </div>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          No active account
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
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Send {currencySymbol}
          </h2>
          <p className="text-xs text-gray-400">{chainName}</p>
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
            Amount ({currencySymbol})
          </label>
          <input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.0001"
            min="0"
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl
                       placeholder:text-gray-400
                       focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                       disabled:bg-gray-100 disabled:cursor-not-allowed
                       transition-colors"
          />
          <p className="text-xs text-gray-500">
            Available: {userBalance.toFixed(7)} {currencySymbol}
          </p>
        </div>

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
