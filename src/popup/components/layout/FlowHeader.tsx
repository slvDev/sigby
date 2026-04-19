import type { ReactNode } from "react";
import { Icon } from "../ui";
import { palette } from "../../styles/theme";

type FlowHeaderProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Optional trailing slot (e.g. a Copy button). */
  trailing?: ReactNode;
};

/**
 * Sticky header for non-tab pages — back button, title, optional
 * subtitle, optional trailing slot. Same glassy backdrop as
 * TopTabsLayout's header so the aesthetic is continuous when
 * navigating between tab views and flow views.
 */
export function FlowHeader({
  title,
  subtitle,
  onBack,
  trailing,
}: FlowHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 px-4 py-3"
      style={{
        background: palette.headerGradient,
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/70 border border-white/80 text-zinc-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <Icon name="arrow-left" className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[14px] font-semibold text-zinc-900 tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-zinc-500 truncate">{subtitle}</p>
          )}
        </div>
        {trailing}
      </div>
    </header>
  );
}
