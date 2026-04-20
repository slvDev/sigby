/**
 * ConfirmModal Component
 * Accessible confirmation dialog to replace native confirm(). Backdrop
 * fades, card scale+fades. Exit runs via AnimatePresence so the modal
 * doesn't blink out — compositor-only transitions.
 */

import { useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "./Button";
import { fade, scaleFade, spring, tween } from "../../styles/motion";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and keyboard handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape" && !isLoading) {
        e.preventDefault();
        onClose();
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [isOpen, isLoading, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auto-focus confirm button after mount animation lands
  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="confirm-modal-scrim"
          initial={fade.initial}
          animate={fade.animate}
          exit={fade.exit}
          transition={tween.shortInQuiet}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) {
              onClose();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <motion.div
            ref={modalRef}
            initial={scaleFade.initial}
            animate={scaleFade.animate}
            exit={scaleFade.exit}
            transition={spring.soft}
            className="bg-white rounded-2xl shadow-xl w-[320px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-2">
              <h2
                id="confirm-modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
            </div>

            {/* Content */}
            <div className="px-5 pb-5">
              <p className="text-sm text-gray-600 whitespace-pre-line">{message}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 pb-5">
              <Button
                variant="secondary"
                fullWidth
                onClick={onClose}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <Button
                ref={confirmButtonRef}
                variant={variant === "danger" ? "danger" : "primary"}
                fullWidth
                onClick={onConfirm}
                loading={isLoading}
              >
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
