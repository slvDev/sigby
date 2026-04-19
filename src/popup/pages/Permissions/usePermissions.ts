import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";
import { useToast } from "../../components/common";

export function usePermissions() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeAddress, permissions, permissionsLoading, fetchPermissions } =
    useWalletStore();

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (activeAddress) fetchPermissions();
  }, [activeAddress, fetchPermissions]);

  const handleRevoke = async (permissionId: string) => {
    setRevoking(permissionId);
    try {
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
        message:
          error instanceof Error ? error.message : "Failed to revoke permission",
      });
    } finally {
      setRevoking(null);
    }
  };

  const openGrantModal = () => setShowGrantModal(true);
  const closeGrantModal = () => setShowGrantModal(false);
  const onGrantSuccess = () => {
    setShowGrantModal(false);
    fetchPermissions();
  };
  const handleBack = () => navigate(-1);

  const nowSec = Math.floor(Date.now() / 1000);
  const activePermissions = permissions.filter((p) => (p.expiry ?? 0) > nowSec);
  const expiredPermissions = permissions.filter(
    (p) => (p.expiry ?? 0) <= nowSec
  );

  return {
    permissions,
    permissionsLoading,
    activePermissions,
    expiredPermissions,
    showGrantModal,
    revoking,
    handleRevoke,
    openGrantModal,
    closeGrantModal,
    onGrantSuccess,
    handleBack,
  };
}
