import { OriginSecurityBanner } from "../../../components/approvals/OriginSecurityBanner";
import {
  useGrantPermissionsApproval,
  formatAddress,
  formatExpiry,
} from "./useGrantPermissionsApproval";

export function GrantPermissionsApproval() {
  const {
    request,
    permissionRequest,
    isFetching,
    isLoading,
    error,
    originAnalysis,
    displayOrigin,
    handleApprove,
    handleReject,
    handleClose,
  } = useGrantPermissionsApproval();

  if (isFetching) {
    return (
      <div className="w-[400px] min-h-[600px] bg-white flex items-center justify-center text-gray-500">
        Loading permission request...
      </div>
    );
  }

  if (!request || !permissionRequest) {
    return (
      <div className="flex flex-col min-h-[600px] p-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Permission Request
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

  const calls = permissionRequest.permissions.calls ?? [];
  const spendLimits = permissionRequest.permissions.spend ?? [];

  return (
    <div className="flex flex-col min-h-[600px] p-6 gap-4">
      <div className="text-center pb-3 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Grant Session Key</h2>
        <p className="text-xs text-gray-500 mt-1">
          The dApp will be able to sign within these limits without prompting
          you each time.
        </p>
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

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Expires
        </h3>
        <p className="text-sm text-gray-800">
          {formatExpiry(permissionRequest.expiry)}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Allowed calls ({calls.length})
        </h3>
        <div className="flex flex-col gap-1">
          {calls.map((call, idx) => (
            <div
              key={idx}
              className="px-3 py-2 bg-gray-50 rounded-lg text-xs font-mono text-gray-700 break-all"
            >
              {call.to && <div>to {formatAddress(call.to)}</div>}
              {call.signature && (
                <div className="text-gray-500">{call.signature}</div>
              )}
              {call.selector && (
                <div className="text-gray-500">selector {call.selector}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {spendLimits.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Spend limits
          </h3>
          <div className="flex flex-col gap-1">
            {spendLimits.map((limit, idx) => (
              <div
                key={idx}
                className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-700"
              >
                <span className="font-mono">{limit.limit}</span> per{" "}
                {limit.period} on{" "}
                <span className="font-mono">{formatAddress(limit.token)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Fee token
        </h3>
        <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-700">
          {permissionRequest.feeToken ? (
            <>
              Up to{" "}
              <span className="font-mono">
                {permissionRequest.feeToken.limit}
              </span>{" "}
              {permissionRequest.feeToken.symbol ?? "native"}
            </>
          ) : (
            <span className="text-gray-500">
              No fee allowance — session key cannot pay gas.
            </span>
          )}
        </div>
      </section>

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
          {isLoading ? "Approving..." : "Approve"}
        </button>
      </div>
    </div>
  );
}
