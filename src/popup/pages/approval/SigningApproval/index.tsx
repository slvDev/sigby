import { OriginSecurityBanner } from "../../../components/approvals/OriginSecurityBanner";
import { useSigningApproval } from "./useSigningApproval";

export function SigningApproval() {
  const {
    request,
    isFetching,
    isLoading,
    error,
    isPersonalSign,
    messageContent,
    typedDataDomain,
    displayOrigin,
    originAnalysis,
    hasInvisibleChars,
    handleApprove,
    handleReject,
    handleClose,
  } = useSigningApproval();

  if (isFetching) {
    return (
      <div className="w-[400px] min-h-[600px] bg-white flex items-center justify-center text-gray-500">
        Loading request...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col min-h-[600px] p-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Signature Request</h2>
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
          {isPersonalSign ? "Signature Request" : "Typed Data Signature"}
        </h2>
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

      {typedDataDomain && (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-xl text-xs text-gray-700 space-y-1">
          {typedDataDomain.name && (
            <div>
              <span className="text-gray-500">Domain:</span>{" "}
              <span className="font-medium">{typedDataDomain.name}</span>
            </div>
          )}
          {typedDataDomain.chainId !== undefined && (
            <div>
              <span className="text-gray-500">Chain ID:</span>{" "}
              <span className="font-mono">
                {typeof typedDataDomain.chainId === "string"
                  ? typedDataDomain.chainId
                  : String(typedDataDomain.chainId)}
              </span>
            </div>
          )}
          {typedDataDomain.verifyingContract && (
            <div className="break-all">
              <span className="text-gray-500">Verifying contract:</span>{" "}
              <span className="font-mono">
                {typedDataDomain.verifyingContract}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          {isPersonalSign ? "Message to sign:" : "Typed data to sign:"}
        </div>
        {hasInvisibleChars && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            This message contains invisible or directional characters that can
            disguise its true content. Review carefully before signing.
          </div>
        )}
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-[300px]">
          <pre className="font-mono text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words m-0">
            {messageContent}
          </pre>
        </div>
      </div>

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
          {isLoading ? "Signing..." : "Sign"}
        </button>
      </div>
    </div>
  );
}
