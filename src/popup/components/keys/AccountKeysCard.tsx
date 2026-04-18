/**
 * Account Keys Card
 * Combined card showing session keys and authorized keys
 * Single "Connect" button when auth is needed
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { Skeleton } from "../common";

export function AccountKeysCard() {
  const navigate = useNavigate();
  const {
    permissions,
    permissionsLoading,
    permissionsNeedAuth,
    accountKeys,
    keysLoading,
    keysNeedAuth,
    fetchPermissions,
    fetchKeys,
    connectActiveAccount,
    activeAddress,
  } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (activeAddress) {
      fetchPermissions();
      fetchKeys();
    }
  }, [activeAddress, fetchPermissions, fetchKeys]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectActiveAccount();
    } finally {
      setConnecting(false);
    }
  };

  const needsAuth = permissionsNeedAuth || keysNeedAuth;
  const isLoading = (permissionsLoading || keysLoading) && !needsAuth;

  // Loading state
  if (isLoading && accountKeys.length === 0 && permissions.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl overflow-hidden">
        <Skeleton className="h-14 rounded-none" />
        <div className="border-t border-gray-200" />
        <Skeleton className="h-16 rounded-none" />
      </div>
    );
  }

  // Auth required state
  if (needsAuth) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl text-center">
        <p className="text-amber-600 text-sm font-medium">Authentication required</p>
        <p className="text-gray-400 text-xs mt-1">
          Connect to view account keys
        </p>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="mt-3 px-4 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
        >
          {connecting ? "Connecting..." : "Connect"}
        </button>
      </div>
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const activePermCount = permissions.filter((p) => (p.expiry ?? 0) > nowSec).length;

  const getKeyTypeLabel = (type: string) => {
    switch (type) {
      case "webauthn-p256":
        return "Passkey";
      case "secp256k1":
        return "Ethereum Key";
      case "p256":
        return "P256 Key";
      case "address":
        return "Address";
      default:
        return type;
    }
  };

  const getKeyIcon = (type: string) => {
    if (type === "webauthn-p256") {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    );
  };

  return (
    <div className="bg-gray-50 rounded-xl overflow-hidden">
      {/* Session Keys Row - Clickable */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
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
                {activePermCount > 0
                  ? `${activePermCount} active`
                  : "No active session keys"}
              </div>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Authorized Keys Section */}
      <div className="p-4">
        {accountKeys.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-gray-400 text-xs">No keys found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accountKeys.map((key) => (
              <div key={key.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                  {getKeyIcon(key.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {getKeyTypeLabel(key.type)}
                    </span>
                    {key.role === "admin" && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                    {key.role === "session" && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        Session
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 font-mono truncate mt-0.5">
                    {key.publicKey.slice(0, 10)}...{key.publicKey.slice(-8)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
