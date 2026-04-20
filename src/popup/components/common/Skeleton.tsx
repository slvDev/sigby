/**
 * Skeleton Component
 * Horizontal sheen over a muted rectangle — feels closer to
 * Linear/Vercel than the default Material pulse. Single-direction,
 * linear ease, no bounce (research §6.8).
 */

export interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className = "",
}: SkeletonProps) {
  const baseStyles =
    "relative overflow-hidden bg-zinc-200/70 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent before:animate-[sheen_1.4s_linear_infinite]";

  const variantStyles = {
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Pre-composed skeleton patterns
 */
export function TokenListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton variant="circular" width={32} height={32} />
          <div className="flex-1">
            <Skeleton width={64} className="mb-1" />
            <Skeleton width={96} height={12} />
          </div>
          <Skeleton width={48} />
        </div>
      ))}
    </div>
  );
}

export function BalanceSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Skeleton width={120} height={32} />
      <Skeleton width={80} height={16} />
    </div>
  );
}
