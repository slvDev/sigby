/**
 * TokenIcon Component
 * Colored circle indicator for tokens with symbol letter
 */

/**
 * Generate a deterministic color based on token address
 */
function getTokenColor(address: string): string {
  // Color palette - pleasing, distinct colors
  const colors = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-violet-500",
    "bg-lime-500",
  ];

  // Simple hash based on address
  const hash = address
    .toLowerCase()
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return colors[hash % colors.length];
}

/**
 * Size variants for token icon
 */
const SIZE_CLASSES = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

interface TokenIconProps {
  /** Token symbol (e.g., "USDC") */
  symbol: string;
  /** Token contract address (used for color generation) */
  address: string;
  /** Optional logo URL */
  logoUrl?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

export function TokenIcon({
  symbol,
  address,
  logoUrl,
  size = "md",
  className = "",
}: TokenIconProps) {
  const colorClass = getTokenColor(address);
  const letter = symbol.charAt(0).toUpperCase();

  // If logo URL provided, try to use it
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={(e) => {
          // Hide image on error, fallback will be shown via parent
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  // Default: colored circle with first letter
  return (
    <span
      className={`
        ${SIZE_CLASSES[size]}
        ${colorClass}
        rounded-full
        flex items-center justify-center
        text-white font-semibold
        flex-shrink-0
        ${className}
      `}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}
