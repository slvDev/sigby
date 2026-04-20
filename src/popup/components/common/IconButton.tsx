/**
 * IconButton Component
 * Icon-only button; spring press state.
 */

import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { spring } from "../../styles/motion";

export interface IconButtonProps extends HTMLMotionProps<"button"> {
  icon: ReactNode;
  "aria-label": string; // Required for accessibility
  variant?: "default" | "danger";
  size?: "sm" | "md";
}

const variantStyles = {
  default: "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
  danger: "text-gray-400 hover:text-red-600 hover:bg-red-50",
};

const sizeStyles = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = "default",
      size = "sm",
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.9 }}
        transition={spring.snap}
        className={`
          inline-flex items-center justify-center
          rounded-lg
          transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {icon}
      </motion.button>
    );
  }
);

IconButton.displayName = "IconButton";
