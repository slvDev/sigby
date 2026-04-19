export type IconName =
  | "chevron-down"
  | "chevron-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "swap"
  | "home"
  | "assets"
  | "activity"
  | "settings"
  | "menu"
  | "copy"
  | "check"
  | "trend-up"
  | "send"
  | "receive"
  | "plus"
  | "x"
  | "qr"
  | "external"
  | "warning"
  | "lock";

type IconProps = {
  name: IconName;
  className?: string;
};

/**
 * Single source for every icon in the wallet UI. 1.5–1.75 stroke,
 * rounded caps, SF-Symbols-Light-adjacent.
 */
export function Icon({ name, className = "" }: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };
  switch (name) {
    case "chevron-down":
      return (
        <svg viewBox="0 0 16 16" strokeWidth={1.5} {...common}>
          <path d="m4 6.5 4 3.5 4-3.5" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg viewBox="0 0 16 16" strokeWidth={1.5} {...common}>
          <path d="M6 4l4 4-4 4" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="M16 10H4m0 0 5-5m-5 5 5 5" />
        </svg>
      );
    case "arrow-up":
    case "send":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="M10 16V4m0 0L5 9m5-5 5 5" />
        </svg>
      );
    case "arrow-down":
    case "receive":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="M10 4v12m0 0 5-5m-5 5-5-5" />
        </svg>
      );
    case "swap":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="M4 7h11m0 0-3.5-3.5M15 7l-3.5 3.5M16 13H5m0 0 3.5 3.5M5 13l3.5-3.5" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-4v-4H8v4H4a1 1 0 0 1-1-1V8.5Z" />
        </svg>
      );
    case "assets":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <circle cx="8" cy="8" r="4.5" />
          <circle cx="12" cy="12" r="4.5" />
        </svg>
      );
    case "activity":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <path d="M4 5h12M4 10h12M4 15h12" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 2v2m0 12v2M4.2 4.2l1.5 1.5m8.6 8.6 1.5 1.5M2 10h2m12 0h2M4.2 15.8l1.5-1.5m8.6-8.6 1.5-1.5" />
        </svg>
      );
    case "menu":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <rect x="7" y="7" width="9" height="9" rx="2" />
          <path d="M13 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="m4 10.5 3.5 3.5L16 6" />
        </svg>
      );
    case "trend-up":
      return (
        <svg
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={className}
          fill="currentColor"
        >
          <path d="M5 1.5 8.5 7h-7z" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="M10 4v12m-6-6h12" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="M5 5l10 10M15 5 5 15" />
        </svg>
      );
    case "qr":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <rect x="3" y="3" width="5" height="5" rx="1" />
          <rect x="12" y="3" width="5" height="5" rx="1" />
          <rect x="3" y="12" width="5" height="5" rx="1" />
          <path d="M12 12h2m0 0v2m0 0h2m-2 0v3m3-5v5" />
        </svg>
      );
    case "external":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <path d="M11 4h5v5m0-5L9 11M5 7v8h8" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.75} {...common}>
          <path d="M10 3.5 2.5 16.5h15L10 3.5Z" />
          <path d="M10 9v3.5M10 14.75v.01" />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 20 20" strokeWidth={1.5} {...common}>
          <rect x="4" y="9" width="12" height="8" rx="2" />
          <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
        </svg>
      );
  }
}
