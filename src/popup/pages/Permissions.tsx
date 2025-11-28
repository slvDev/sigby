/**
 * Permissions Page
 * Full permissions management for session keys
 * - View all permissions
 * - Grant new permissions (session keys)
 * - Revoke permissions
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../store";
import { popupPortoService } from "../portoService";
import { Button, Skeleton } from "../components/common";
import { useToast } from "../components/common";
import { PermissionCard, GrantPermissionModal } from "../components/permissions";

export function Permissions() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    activeAddress,
    permissions,
    permissionsLoading,
    fetchPermissions,
  } = useWalletStore();

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (activeAddress) {
      fetchPermissions();
    }
  }, [activeAddress, fetchPermissions]);

  const handleRevoke = async (permissionId: string) => {
    setRevoking(permissionId);
    try {
      // Ensure Porto is initialized
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }

      await popupPortoService.revokePermissions(permissionId);
      await fetchPermissions();
      showToast({ type: "success", message: "Permission revoked" });
    } catch (error) {
      console.error("[Permissions] Revoke failed:", error);
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to revoke permission",
      });
    } finally {
      setRevoking(null);
    }
  };

  const activePermissions = permissions.filter(
    (p) => p.isActive && p.expiry >= Date.now() / 1000
  );
  const expiredPermissions = permissions.filter(
    (p) => !p.isActive || p.expiry < Date.now() / 1000
  );

  return (
    <div className="flex flex-col min-h-[600px] w-[400px] bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Session Keys</h2>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Info Button */}
        <Button variant="secondary" fullWidth onClick={() => setShowGrantModal(true)}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How Session Keys Work
        </Button>

        {/* Info Box */}
        <div className="p-3 bg-blue-50 rounded-xl">
          <p className="text-xs text-blue-800">
            Session keys allow dApps to sign transactions without biometric confirmation each time.
            Useful for gaming, trading, and other high-frequency interactions.
          </p>
        </div>

        {/* Loading State */}
        {permissionsLoading && permissions.length === 0 && (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        )}

        {/* Empty State */}
        {!permissionsLoading && permissions.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No session keys yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Create a session key to enable seamless signing
            </p>
          </div>
        )}

        {/* Active Permissions */}
        {activePermissions.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Active ({activePermissions.length})
            </h3>
            <div className="space-y-3">
              {activePermissions.map((perm) => (
                <PermissionCard
                  key={perm.id}
                  permission={perm}
                  onRevoke={() => handleRevoke(perm.id)}
                  isRevoking={revoking === perm.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Expired Permissions */}
        {expiredPermissions.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Expired ({expiredPermissions.length})
            </h3>
            <div className="space-y-3">
              {expiredPermissions.map((perm) => (
                <PermissionCard
                  key={perm.id}
                  permission={perm}
                  onRevoke={() => handleRevoke(perm.id)}
                  isRevoking={revoking === perm.id}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Grant Modal */}
      <GrantPermissionModal
        isOpen={showGrantModal}
        onClose={() => setShowGrantModal(false)}
        onSuccess={() => {
          setShowGrantModal(false);
          fetchPermissions();
        }}
      />
    </div>
  );
}
