import type { ReactNode } from "react";
import { SOFT_SHADOW, HERO_SHADOW } from "../../styles/theme";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  /** Radius in pixels; defaults to 16 */
  radius?: number;
  /** Use heavier hero shadow */
  hero?: boolean;
  /** Inline style escape hatch for layout-specific needs */
  style?: React.CSSProperties;
};

/**
 * The elevated glass surface — 78% white + hairline + soft multi-stop
 * shadow + backdrop-blur. Workhorse primitive for cards and lists.
 */
export function GlassCard({
  children,
  className = "",
  radius = 16,
  hero = false,
  style,
}: GlassCardProps) {
  return (
    <div
      className={`bg-white/[0.78] backdrop-blur-xl border border-white/80 ${className}`}
      style={{
        borderRadius: radius,
        boxShadow: hero ? HERO_SHADOW : SOFT_SHADOW,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
