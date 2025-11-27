/**
 * ChainList Component
 * Grouped list of chains with section header
 */

import { ChainItem } from "./ChainItem";

interface ChainListProps {
  chainIds: number[];
  selectedChainId: number;
  onSelect: (chainId: number) => void;
  title?: string;
}

export function ChainList({ chainIds, selectedChainId, onSelect, title }: ChainListProps) {
  if (chainIds.length === 0) return null;

  return (
    <div className="py-1">
      {title && (
        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className="space-y-0.5">
        {chainIds.map((chainId) => (
          <ChainItem
            key={chainId}
            chainId={chainId}
            isSelected={chainId === selectedChainId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
