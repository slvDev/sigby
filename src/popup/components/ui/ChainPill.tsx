import type { MouseEvent } from "react";
import { Icon } from "./Icon";
import { SOFT_SHADOW } from "../../styles/theme";

type ChainPillProps = {
  chainName: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * Network selector pill. Dot + chain name + chevron.
 */
export function ChainPill({ chainName, onClick }: ChainPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Switch chain"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 text-[12px] font-medium text-zinc-700 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      style={{ boxShadow: SOFT_SHADOW }}
    >
      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
      {chainName}
      <Icon name="chevron-down" className="w-3 h-3 text-zinc-400" />
    </button>
  );
}
