/**
 * Permissions Summary
 * Summary of active permissions shown in Settings page
 * Clickable to navigate to full permissions page
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { Skeleton } from "../common";

export function PermissionsSummary() {
  const navigate = useNavigate();
  const {
    permissions,
    permissionsLoading,
    permissionsNeedAuth,
    fetchPermissions,
    connectActiveAccount,
    activeAddress,
  } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (activeAddress) {
      fetchPermissions();
    }
  }, [activeAddress, fetchPermissions]);

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't navigate when clicking connect
    setConnecting(true);
    try {
      await connectActiveAccount();
    } finally {
      setConnecting(false);
    }
  };

  if (permissionsLoading && permissions.length === 0) {
    return <Skeleton className="h-16 rounded-xl" />;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const activeCount = permissions.filter((p) => (p.expiry ?? 0) > nowSec).length;
  const expiredCount = permissions.filter((p) => (p.expiry ?? 0) <= nowSec).length;

  return (
    <div
      className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => navigate("/permissions")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Session Keys</div>
            <div className="text-xs text-gray-400">
              {permissionsNeedAuth ? (
                <span className="text-amber-600">Connect to view</span>
              ) : activeCount > 0 ? (
                <>
                  {activeCount} active{activeCount !== 1 ? "" : ""}
                  {expiredCount > 0 && ` (${expiredCount} expired)`}
                </>
              ) : (
                "No active session keys"
              )}
            </div>
          </div>
        </div>
        {permissionsNeedAuth ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-3 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
          >
            {connecting ? "..." : "Connect"}
          </button>
        ) : (
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </div>
  );
}
