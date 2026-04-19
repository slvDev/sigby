import { Skeleton } from "../../components/common";
import { PermissionCard, GrantPermissionModal } from "../../components/permissions";
import { FlowHeader } from "../../components/layout/FlowHeader";
import { GlassCard, PillButton, Icon } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { usePermissions } from "./usePermissions";

export function Permissions() {
  const {
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
  } = usePermissions();

  return (
    <div
      className="flex flex-col flex-1 min-h-[600px]"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <FlowHeader title="Session keys" onBack={handleBack} />

      <div className="flex flex-col gap-3 px-4 pt-3 pb-4 flex-1 overflow-y-auto">
        <GlassCard className="p-3 text-[12px] text-zinc-700 flex items-start gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
            <Icon name="lock" className="w-3.5 h-3.5" />
          </span>
          <p className="leading-snug">
            Session keys let dApps sign transactions without biometric
            confirmation each time — useful for gaming, trading, and
            high-frequency flows.
          </p>
        </GlassCard>

        <PillButton variant="secondary" onClick={openGrantModal}>
          <Icon name="plus" className="w-3.5 h-3.5" />
          How session keys work
        </PillButton>

        {permissionsLoading && permissions.length === 0 && (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        )}

        {!permissionsLoading && permissions.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/70 border border-white/80 flex items-center justify-center text-zinc-400">
              <Icon name="lock" className="w-5 h-5" />
            </div>
            <div className="text-[14px] font-semibold text-zinc-800">
              No session keys yet
            </div>
            <p className="text-[12px] text-zinc-500 mt-1">
              Grant a key to enable seamless signing.
            </p>
          </div>
        )}

        {activePermissions.length > 0 && (
          <section>
            <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
              Active ({activePermissions.length})
            </h3>
            <div className="space-y-2.5">
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

        {expiredPermissions.length > 0 && (
          <section>
            <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
              Expired ({expiredPermissions.length})
            </h3>
            <div className="space-y-2.5">
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

      <GrantPermissionModal
        isOpen={showGrantModal}
        onClose={closeGrantModal}
        onSuccess={onGrantSuccess}
      />
    </div>
  );
}
