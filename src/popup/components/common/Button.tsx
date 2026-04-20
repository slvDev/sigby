/**
 * Button Component
 * Reusable button with variants, sizes, and loading state.
 *
 * Motion: subtle press scale via motion whileTap + hover translate via
 * whileHover. MotionConfig on the app root disables transform on
 * reduced-motion users, so no manual substitution needed here.
 */

import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { LoadingSpinner } from "./LoadingSpinner";
import { spring } from "../../styles/motion";

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

const variantStyles = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-300",
  secondary:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400",
  danger:
    "bg-red-50 text-red-600 hover:bg-red-100 disabled:bg-red-25 disabled:text-red-300",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-5 py-3 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        whileHover={isDisabled ? undefined : { y: -1 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        transition={spring.snap}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-xl
          transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
          disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <LoadingSpinner
            size="sm"
            color={variant === "primary" ? "white" : "gray"}
          />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
