import { FeeTokenDropdown } from "../../../components/token/FeeTokenDropdown";
import { OriginSecurityBanner } from "../../../components/approvals/OriginSecurityBanner";
import { useTransactionApproval } from "./useTransactionApproval";

export function TransactionApproval() {
  const {
    request,
    isFetching,
    isLoading,
    error,
    isWalletSendCalls,
    calls,
    displayOrigin,
    originAnalysis,
    nativeSymbol,
    gasDecimal,
    feeTokens,
    selectedFeeToken,
    setSelectedFeeToken,
    dappRequiredFeeToken,
    formatCall,
    handleApprove,
    handleReject,
    handleClose,
  } = useTransactionApproval();

  if (isFetching) {
    return (
      <div className="w-[400px] min-h-[600px] bg-white flex items-center justify-center text-gray-500">
        Loading transaction...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col min-h-[600px] p-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Transaction Request
        </h2>
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error || "Request not found or expired"}
        </div>
        <button
          onClick={handleClose}
          className="py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[600px] p-6 gap-4">
      <div className="text-center pb-3 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">
          {isWalletSendCalls && calls.length > 1
            ? "Batch Transaction"
            : "Transaction Request"}
        </h2>
        {isWalletSendCalls && calls.length > 1 && (
          <p className="text-sm text-gray-500 mt-1">
            {calls.length} transactions
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
        {request.metadata?.favicon && (
          <img
            src={request.metadata.favicon}
            alt=""
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="font-medium text-gray-700 truncate">{displayOrigin}</div>
      </div>
      <OriginSecurityBanner analysis={originAnalysis} />

      <div className="flex-1 overflow-auto space-y-3">
        {calls.map((call: any, index: number) => {
          const { to, valueInEth, data } = formatCall(call);
          return (
            <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
              {calls.length > 1 && (
                <div className="text-xs font-medium text-gray-400 uppercase">
                  Transaction {index + 1}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-sm text-gray-500">To:</span>
                <span className="font-medium text-gray-900 font-mono text-xs break-all">
                  {to || "Contract creation"}
                </span>
              </div>
              <div className="flex justify-between items-start gap-3">
                <span className="text-sm text-gray-500">Value:</span>
                <span className="font-medium text-gray-900">
                  {valueInEth} {nativeSymbol}
                </span>
              </div>
              {data && data !== "0x" && (
                <div className="flex justify-between items-start gap-3">
                  <span className="text-sm text-gray-500">Data:</span>
                  <span className="font-mono text-xs text-gray-600 text-right max-w-[200px] truncate">
                    {data.length > 20 ? `${data.slice(0, 20)}...` : data}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {!isWalletSendCalls && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex justify-between items-start gap-3">
              <span className="text-sm text-gray-500">Est. Gas:</span>
              <span className="font-medium text-gray-900">{gasDecimal}</span>
            </div>
          </div>
        )}
      </div>

      {feeTokens.length > 0 && (
        <div className="space-y-1">
          <FeeTokenDropdown
            tokens={feeTokens}
            selected={selectedFeeToken}
            onChange={setSelectedFeeToken}
            disabled={isLoading || dappRequiredFeeToken !== null}
          />
          {dappRequiredFeeToken && (
            <p className="text-xs text-gray-500 px-1">
              {feeTokens.some((t) => t.symbol === dappRequiredFeeToken)
                ? `${dappRequiredFeeToken} is required by this dApp.`
                : `${dappRequiredFeeToken} is required by this dApp but isn't available on this chain.`}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-auto pt-4 border-t border-gray-100">
        <button
          onClick={handleReject}
          disabled={isLoading}
          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Signing..." : "Approve"}
        </button>
      </div>
    </div>
  );
}
