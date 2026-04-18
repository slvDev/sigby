/**
 * Security indicators for approval screens — HTTPS lock, Punycode / mixed-
 * script warning, and (optionally) "first time you connect here" banner.
 *
 * Rendered above the request body on ConnectionApproval /
 * GrantPermissionsApproval / TransactionApproval / SigningApproval so the
 * user sees the trust signals before reading the request.
 */

import type { OriginAnalysis } from "../../utils/originCheck";

interface OriginSecurityBannerProps {
  analysis: OriginAnalysis;
  /** `null` while we're still checking, `true` / `false` once the background replies. */
  isKnownOrigin?: boolean | null;
}

export function OriginSecurityBanner({ analysis, isKnownOrigin }: OriginSecurityBannerProps) {
  const { scheme, isHttps, isPunycode, mixedScripts, hostname } = analysis;

  const showInsecure = scheme !== null && !isHttps;
  const showNewOrigin = isKnownOrigin === false;

  if (!showInsecure && !isPunycode && !mixedScripts && !showNewOrigin) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <LockIcon />
        <span>Secure connection to {hostname}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {showInsecure && (
        <Banner
          tone="danger"
          title="Insecure connection"
          body={`This site is served over ${scheme ?? "an unknown protocol"} — its traffic is not encrypted. Do not sign here unless you trust the network.`}
        />
      )}
      {isPunycode && (
        <Banner
          tone="warn"
          title="Internationalized domain"
          body={`Hostname "${hostname}" is an IDN (contains an xn-- label). Confirm it matches the site you meant to visit — Punycode can disguise Unicode lookalikes.`}
        />
      )}
      {mixedScripts && (
        <Banner
          tone="warn"
          title="Mixed-script hostname"
          body={`Hostname "${hostname}" mixes character sets — this is a common homograph trick used to impersonate legitimate sites.`}
        />
      )}
      {showNewOrigin && (
        <Banner
          tone="info"
          title="First time connecting"
          body="You haven't connected to this site with any of your accounts before. Double-check the URL and favicon match what you expect."
        />
      )}
    </div>
  );
}

function Banner({ tone, title, body }: { tone: "danger" | "warn" | "info"; title: string; body: string }) {
  const classes =
    tone === "danger"
      ? "bg-red-50 border-red-200 text-red-700"
      : tone === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-primary-50 border-primary-200 text-primary-800";
  return (
    <div className={`p-3 border rounded-xl text-xs ${classes}`}>
      <div className="font-semibold mb-0.5">{title}</div>
      <div>{body}</div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
