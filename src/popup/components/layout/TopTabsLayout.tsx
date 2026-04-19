import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useWalletStore } from "../../store";
import { CHAIN_CONFIGS } from "../../../utils/constants";
import { AccountPill, ChainPill } from "../ui";
import { SOFT_SHADOW, palette } from "../../styles/theme";

type TabId = "wallet" | "activity" | "tokens" | "settings";

const TABS: Array<{ id: TabId; label: string; path: string }> = [
  { id: "wallet", label: "Wallet", path: "/" },
  { id: "activity", label: "Activity", path: "/history" },
  { id: "tokens", label: "Tokens", path: "/tokens" },
  { id: "settings", label: "Settings", path: "/settings" },
];

function activeTabFromPath(pathname: string): TabId {
  if (pathname.startsWith("/history")) return "activity";
  if (pathname.startsWith("/tokens") || pathname.startsWith("/token"))
    return "tokens";
  if (pathname.startsWith("/settings") || pathname.startsWith("/permissions"))
    return "settings";
  return "wallet";
}

/**
 * TopTabsLayout — sticky header with account/chain pills and a
 * segmented-control tab row above the active tab's content. Used as
 * the outer layout for the 4 primary wallet surfaces (/, /history,
 * /tokens, /settings). Non-tab flow pages (Send, Receive, etc.) render
 * outside this layout via their own route-level header.
 */
export function TopTabsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts, activeAddress, chainId } = useWalletStore();
  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  const chainConfig = CHAIN_CONFIGS[chainId];
  const chainName = chainConfig?.name || "Unknown";

  const activeTab = activeTabFromPath(location.pathname);

  const handleAccountClick = () => navigate("/settings");
  const handleChainClick = () => navigate("/settings");

  const addressTruncated = activeAddress
    ? `${activeAddress.slice(0, 6)}\u2026${activeAddress.slice(-4)}`
    : "";

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ background: palette.backgroundGradient }}
    >
      <header
        className="sticky top-0 z-30 px-4 pt-3 pb-2"
        style={{
          background: palette.headerGradient,
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          {activeAccount ? (
            <AccountPill
              displayName={activeAccount.displayName || "Account"}
              addressTruncated={addressTruncated}
              onClick={handleAccountClick}
            />
          ) : (
            <div className="text-[12px] text-zinc-500">No account</div>
          )}
          <ChainPill chainName={chainName} onClick={handleChainClick} />
        </div>

        <div
          className="mt-3 p-1 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 grid grid-cols-4 gap-1"
          style={{ boxShadow: SOFT_SHADOW }}
          role="tablist"
        >
          {TABS.map((t) => {
            const isActive = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => navigate(t.path)}
                className={`text-[12px] font-semibold py-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-4">
        <Outlet />
      </main>
    </div>
  );
}
