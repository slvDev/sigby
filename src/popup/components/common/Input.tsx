/**
 * Input Component
 * Standardized text input with label, error, and help text
 */

import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, id, className = "", ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-3
            border-2 rounded-xl
            text-gray-900 placeholder-gray-400
            transition-colors
            focus:outline-none focus:ring-1
            disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500
            ${
              hasError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-200 focus:border-primary-500 focus:ring-primary-500"
            }
            ${className}
          `}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={`${inputId}-help`} className="mt-1.5 text-xs text-gray-400">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
