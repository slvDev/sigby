/**
 * ChainItem Component
 * Individual selectable chain row in dropdown
 */

import { CHAIN_CONFIGS } from "../../../utils/constants";
import { ChainIcon } from "./ChainIcon";

interface ChainItemProps {
  chainId: number;
  isSelected: boolean;
  onSelect: (chainId: number) => void;
}

export function ChainItem({ chainId, isSelected, onSelect }: ChainItemProps) {
  const config = CHAIN_CONFIGS[chainId];

  if (!config) return null;

  return (
    <button
      onClick={() => onSelect(chainId)}
      className={`
        w-full
        flex items-center gap-2.5
        px-3 py-2.5
        text-left
        transition-colors
        ${isSelected ? "bg-primary-50 text-primary-700" : "hover:bg-gray-50 text-gray-700"}
      `}
      role="option"
      aria-selected={isSelected}
    >
      <ChainIcon chainId={chainId} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{config.name}</div>
        {config.isTestnet && <span className="text-[10px] text-gray-400">Testnet</span>}
      </div>
      {isSelected && <span className="text-primary-600 text-sm">●</span>}
    </button>
  );
}
