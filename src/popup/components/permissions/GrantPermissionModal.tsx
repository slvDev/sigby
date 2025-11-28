/**
 * Grant Permission Modal
 * Informational modal explaining how session keys work
 *
 * Note: Session keys are typically requested by dApps, not created manually.
 * This modal explains the feature and shows how to grant permissions when dApps request them.
 */

import { useEffect, useRef, useCallback } from "react";
import { Button } from "../common";

export interface GrantPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GrantPermissionModal({ isOpen, onClose }: GrantPermissionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and keyboard handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="grant-permission-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl w-[340px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-2">
          <h2 id="grant-permission-title" className="text-lg font-semibold text-gray-900">
            About Session Keys
          </h2>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-4">
          <p className="text-sm text-gray-600">
            Session keys allow dApps to sign transactions without requiring biometric approval
            each time - great for gaming, trading, and other frequent interactions.
          </p>

          {/* How it works */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">How it works:</h3>
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                  1
                </div>
                <p className="text-sm text-gray-600">
                  A dApp requests session key access
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                  2
                </div>
                <p className="text-sm text-gray-600">
                  You approve with biometrics (one time)
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                  3
                </div>
                <p className="text-sm text-gray-600">
                  The dApp can sign within the approved limits
                </p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-800">
              Session keys are created when dApps request them. Visit a dApp that supports
              session keys (like games or DEXs) to grant permissions.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5">
          <Button variant="primary" fullWidth onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
