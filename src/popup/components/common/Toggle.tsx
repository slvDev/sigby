/**
 * Toggle Component
 * Reusable toggle switch with label and description
 */

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
          relative inline-flex h-6 w-11
          items-center rounded-full
          transition-colors duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
          ${checked ? "bg-primary-600" : "bg-gray-200"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        disabled={disabled}
      >
        <span
          className={`
            inline-block h-4 w-4
            transform rounded-full
            bg-white shadow-sm
            transition-transform duration-200
            ${checked ? "translate-x-6" : "translate-x-1"}
          `}
        />
      </button>
    </label>
  );
}
