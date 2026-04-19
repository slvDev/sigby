import { Icon, type IconName } from "./Icon";
import { SOFT_SHADOW } from "../../styles/theme";

type QuickActionButtonProps = {
  label: string;
  icon: IconName;
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * Send / Receive / Swap square glass tile. Vertical icon + label.
 */
export function QuickActionButton({
  label,
  icon,
  onClick,
  disabled = false,
}: QuickActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/80 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ boxShadow: SOFT_SHADOW }}
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-b from-white to-zinc-100 text-blue-600 border border-zinc-200/80 group-hover:text-blue-700">
        <Icon name={icon} className="w-[18px] h-[18px]" />
      </span>
      <span className="text-[12px] font-medium text-zinc-700">{label}</span>
    </button>
  );
}
