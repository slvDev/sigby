import { useState } from "react";
import { Icon } from "./Icon";

type AddressTextProps = {
  address: string;
  /** Pre-truncated form; otherwise the component truncates */
  truncated?: string;
  className?: string;
};

/**
 * Truncated address with a copy affordance. Copies to clipboard on
 * click; swaps to a check icon for 1.2 s for confirmation.
 */
export function AddressText({
  address,
  truncated,
  className = "",
}: AddressTextProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!address) return;
    try {
      navigator.clipboard.writeText(address);
    } catch {
      // Clipboard not available — swallow; we still flash the affordance.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const display =
    truncated ?? `${address.slice(0, 6)}\u2026${address.slice(-4)}`;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Address copied" : "Copy address"}
      className={`inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-800 tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded px-1 -mx-1 ${className}`}
    >
      <span>{display}</span>
      <Icon
        name={copied ? "check" : "copy"}
        className={`w-3.5 h-3.5 ${copied ? "text-emerald-600" : ""}`}
      />
    </button>
  );
}
