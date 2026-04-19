import type { ReactNode } from "react";
import { HERO_SHADOW, HERO_SURFACE } from "../../styles/theme";

type HeroCardProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Balance hero card surface. Same geometry as GlassCard but with the
 * signature warm-to-cool gradient and two decorative color orbs.
 */
export function HeroCard({ children, className = "", style }: HeroCardProps) {
  return (
    <div
      className={`relative overflow-hidden border border-white/70 ${className}`}
      style={{
        borderRadius: 22,
        background: HERO_SURFACE,
        boxShadow: HERO_SHADOW,
        backdropFilter: "blur(24px)",
        ...style,
      }}
    >
      <div
        className="absolute -top-10 -right-8 w-40 h-40 rounded-full opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(99,102,241,0.55), rgba(99,102,241,0) 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-12 -left-6 w-36 h-36 rounded-full opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(236,72,153,0.45), rgba(236,72,153,0) 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
