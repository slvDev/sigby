/**
 * Toggle Component
 * iOS-style switch. Thumb travel is a spring so the motion conveys
 * commitment; the track color is a CSS transition (color is not a
 * property worth springing).
 */

import { motion } from "motion/react";
import { spring } from "../../styles/motion";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex-1 min-w-0 mr-4">
        <span className="font-medium text-gray-900">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 p-0.5
          items-center rounded-full
          transition-colors duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
          ${checked ? "bg-primary-600" : "bg-gray-200"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        disabled={disabled}
      >
        <motion.span
          layout
          transition={spring.snap}
          className={`
            inline-block h-5 w-5
            rounded-full
            bg-white shadow-sm
          `}
          style={{ marginLeft: checked ? "auto" : 0 }}
        />
      </button>
    </label>
  );
}
