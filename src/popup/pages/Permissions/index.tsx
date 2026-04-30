import { AnimatePresence, motion } from "motion/react";
import { Skeleton } from "../../components/common";
import { PermissionCard, GrantPermissionModal } from "../../components/permissions";
import { FlowHeader } from "../../components/layout/FlowHeader";
import { GlassCard, PillButton, Icon } from "../../components/ui";
import { palette, FONT_STACK } from "../../styles/theme";
import { fadeUp, stagger, tween } from "../../styles/motion";
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

      <motion.div
        className="flex flex-col gap-3 px-4 pt-3 pb-4 flex-1 overflow-y-auto"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger.base } },
        }}
      >
        <motion.div variants={fadeUp}>
          <GlassCard className="p-3 text-[12px] text-zinc-700 flex items-start gap-2.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
              <Icon name="lock" className="w-3.5 h-3.5" />
            </span>
            <p className="leading-snug">
              Session keys let dApps sign transactions without biometric
              confirmation each time. Useful for gaming, trading, and
              high-frequency flows.
            </p>
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <PillButton variant="secondary" onClick={openGrantModal}>
            <Icon name="plus" className="w-3.5 h-3.5" />
            How session keys work
          </PillButton>
        </motion.div>

        {permissionsLoading && permissions.length === 0 && (
          <motion.div variants={fadeUp} className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </motion.div>
        )}

        {!permissionsLoading && permissions.length === 0 && (
          <motion.div
            className="text-center py-8"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={tween.baseOut}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/70 border border-white/80 flex items-center justify-center text-zinc-400">
              <Icon name="lock" className="w-5 h-5" />
            </div>
            <div className="text-[14px] font-semibold text-zinc-800">
              No session keys yet
            </div>
            <p className="text-[12px] text-zinc-500 mt-1">
              Grant a key to enable seamless signing.
            </p>
          </motion.div>
        )}

        {activePermissions.length > 0 && (
          <motion.section variants={fadeUp} layout>
            <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
              Active ({activePermissions.length})
            </h3>
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {activePermissions.map((perm, i) => (
                  <motion.div
                    key={perm.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, scale: 0.98 }}
                    transition={{ ...tween.baseOut, delay: i * stagger.tight }}
                  >
                    <PermissionCard
                      permission={perm}
                      onRevoke={() => handleRevoke(perm.id)}
                      isRevoking={revoking === perm.id}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        )}

        {expiredPermissions.length > 0 && (
          <motion.section variants={fadeUp} layout>
            <h3 className="px-1 mb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
              Expired ({expiredPermissions.length})
            </h3>
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {expiredPermissions.map((perm, i) => (
                  <motion.div
                    key={perm.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, scale: 0.98 }}
                    transition={{ ...tween.baseOut, delay: i * stagger.tight }}
                  >
                    <PermissionCard
                      permission={perm}
                      onRevoke={() => handleRevoke(perm.id)}
                      isRevoking={revoking === perm.id}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </motion.div>

      <GrantPermissionModal
        isOpen={showGrantModal}
        onClose={closeGrantModal}
        onSuccess={onGrantSuccess}
      />
    </div>
  );
}
