/**
 * Alert Component
 * Inline alert messages with variants. Wrapped in `AnimatePresence` by
 * call sites that mount/unmount it; the exit animation runs cleanly.
 */

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fadeUp, tween } from "../../styles/motion";

export interface AlertProps {
  variant: "error" | "success" | "warning" | "info";
  message: string;
  onClose?: () => void;
  icon?: ReactNode;
  className?: string;
}

const variantStyles = {
  error: "bg-red-50 border-red-200 text-red-600",
  success: "bg-green-50 border-green-200 text-green-600",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  info: "bg-primary-50 border-primary-200 text-primary-700",
};

const defaultIcons = {
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function Alert({
  variant,
  message,
  onClose,
  icon,
  className = "",
}: AlertProps) {
  return (
    <motion.div
      layout
      initial={fadeUp.hidden}
      animate={fadeUp.show}
      exit={fadeUp.exit}
      transition={tween.baseOut}
      className={`
        flex items-start gap-2 p-3
        border rounded-xl text-sm
        ${variantStyles[variant]}
        ${className}
      `}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        {icon || defaultIcons[variant]}
      </div>
      <p className="flex-1">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss alert"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </motion.div>
  );
}
