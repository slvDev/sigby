/**
 * Authorized Keys List
 * Displays list of authorized keys on the account
 */

import { useEffect, useState } from "react";
import { useWalletStore } from "../../store";
import { Skeleton } from "../common";

export function AuthorizedKeysList() {
  const {
    accountKeys,
    keysLoading,
    keysNeedAuth,
    fetchKeys,
    connectActiveAccount,
    activeAddress,
  } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (activeAddress) {
      fetchKeys();
    }
  }, [activeAddress, fetchKeys]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectActiveAccount();
    } finally {
      setConnecting(false);
    }
  };

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
    switch (type) {
      case "webauthn-p256":
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        );
    }
  };

  if (keysLoading && accountKeys.length === 0) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (keysNeedAuth) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl text-center">
        <p className="text-amber-600 text-sm font-medium">Authentication required</p>
        <p className="text-gray-400 text-xs mt-1">
          Connect to view authorized keys
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

  if (accountKeys.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl text-center">
        <p className="text-gray-500 text-sm">No keys loaded</p>
        <p className="text-gray-400 text-xs mt-1">
          Keys will appear after account authorization
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accountKeys.map((key) => (
        <div key={key.id} className="p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
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
        </div>
      ))}
    </div>
  );
}
