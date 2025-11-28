/**
 * Relay Status Card
 * Displays Porto relay connection status with latency
 */

import { useEffect } from "react";
import { useWalletStore } from "../../store";
import { Skeleton } from "../common";

export function RelayStatusCard() {
  const { relayHealth, relayHealthLoading, fetchRelayHealth } = useWalletStore();

  useEffect(() => {
    fetchRelayHealth();
  }, [fetchRelayHealth]);

  const statusConfig = {
    online: {
      color: "bg-green-500",
      text: "Online",
      textColor: "text-green-600",
    },
    offline: {
      color: "bg-red-500",
      text: "Offline",
      textColor: "text-red-600",
    },
    degraded: {
      color: "bg-yellow-500",
      text: "Degraded",
      textColor: "text-yellow-600",
    },
  };

  if (relayHealthLoading && !relayHealth) {
    return <Skeleton className="h-16 rounded-xl" />;
  }

  const status = relayHealth?.status || "offline";
  // Ensure we always have a valid config by falling back to offline
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline;

  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
            {status === "online" && (
              <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${config.color} animate-ping opacity-75`} />
            )}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-900">Porto Relay</span>
            <span className={`ml-2 text-xs ${config.textColor}`}>{config.text}</span>
          </div>
        </div>
        {relayHealth?.latency !== null && relayHealth?.latency !== undefined && (
          <span className="text-xs text-gray-400">{relayHealth.latency}ms</span>
        )}
      </div>
      {status === "offline" && relayHealth?.error && (
        <p className="text-xs text-red-500 mt-2">{relayHealth.error}</p>
      )}
      {relayHealth?.version && (
        <p className="text-xs text-gray-400 mt-1">v{relayHealth.version}</p>
      )}
    </div>
  );
}
