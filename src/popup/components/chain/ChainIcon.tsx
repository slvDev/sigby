/**
 * ChainIcon Component
 * Colored circle indicator for blockchain networks
 */

import { CHAIN_CONFIGS } from "../../../utils/constants";

/**
 * Chain-specific background colors
 */
const CHAIN_COLORS: Record<number, string> = {
  // Mainnets
  1: "bg-blue-500", // Ethereum
  8453: "bg-blue-600", // Base
  42161: "bg-sky-500", // Arbitrum
  10: "bg-red-500", // Optimism
  137: "bg-purple-500", // Polygon

  // Testnets (lighter variants)
  11155111: "bg-blue-400", // Sepolia
  84532: "bg-blue-400", // Base Sepolia
  421614: "bg-sky-400", // Arbitrum Sepolia
  11155420: "bg-red-400", // Optimism Sepolia
  80002: "bg-purple-400", // Polygon Amoy
  17000: "bg-gray-400", // Holesky
};

/**
 * Size variants for chain icon
 */
const SIZE_CLASSES = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-6 h-6 text-xs",
  lg: "w-8 h-8 text-sm",
};

interface ChainIconProps {
  chainId: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ChainIcon({ chainId, size = "md", className = "" }: ChainIconProps) {
  const config = CHAIN_CONFIGS[chainId];
  const colorClass = CHAIN_COLORS[chainId] || "bg-gray-500";
  const letter = config?.shortName?.charAt(0) || "?";

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
