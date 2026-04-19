import { BottomNav } from "../../components/layout/BottomNav";
import { useHistory } from "./useHistory";

function getStatusClasses(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function truncateHash(hash?: string) {
  if (!hash) return "Pending...";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function History() {
  const {
    transactions,
    isLoading,
    error,
    pendingCount,
    getChainName,
    getExplorerUrl,
  } = useHistory();

  return (
    <div className="flex flex-col flex-1">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          Transaction History
        </h2>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 mt-2 text-sm text-yellow-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
            Watching {pendingCount} pending transaction
            {pendingCount > 1 ? "s" : ""}...
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">
            Loading transactions...
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 font-medium">{error}</p>
            <p className="text-sm text-gray-400 mt-1">Please try again later</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 font-medium">No transactions yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Your transaction history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900">Transaction</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {truncateHash(tx.hash)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {getChainName(tx.chainId)}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${getStatusClasses(tx.status)}`}
                    >
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </span>
                  </div>
                </div>
                {tx.hash && (
                  <a
                    href={getExplorerUrl(tx.chainId, tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline"
                  >
                    View on Explorer
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
