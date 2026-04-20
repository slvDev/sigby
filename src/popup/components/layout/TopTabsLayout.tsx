import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { AccountSwitcher } from "./AccountSwitcher";
import { ChainSwitcher } from "./ChainSwitcher";
import { SOFT_SHADOW, palette } from "../../styles/theme";
import { spring } from "../../styles/motion";

type TabId = "wallet" | "activity" | "settings";

const TABS: Array<{ id: TabId; label: string; path: string }> = [
  { id: "wallet", label: "Wallet", path: "/" },
  { id: "activity", label: "Activity", path: "/history" },
  { id: "settings", label: "Settings", path: "/settings" },
];

function activeTabFromPath(pathname: string): TabId {
  if (pathname.startsWith("/history")) return "activity";
  if (pathname.startsWith("/settings") || pathname.startsWith("/permissions"))
    return "settings";
  return "wallet";
}

/**
 * TopTabsLayout — sticky header with account switcher + chain switcher
 * and a 3-tab segmented control (Wallet / Activity / Settings). The
 * Wallet tab carries balance, quick actions, and the token list in one
 * view; Activity is the transaction log; Settings manages accounts,
 * network, keys. Non-tab flow pages (Send, Receive, Token detail,
 * Permissions) render outside this layout with their own FlowHeader.
 */
export function TopTabsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = activeTabFromPath(location.pathname);

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
          <AccountSwitcher />
          <ChainSwitcher />
        </div>

        <div
          className="relative mt-3 p-1 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 grid grid-cols-3 gap-1"
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
                className={`relative text-[12px] font-semibold py-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                  isActive ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-full bg-white shadow-sm"
                    transition={spring.soft}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-4">
        {/* No outer AnimatePresence / motion wrapper here.
         *
         * React Router's <Outlet/> re-renders with the new route the
         * moment the URL changes. If we wrap it in AnimatePresence with
         * mode="wait", the "exiting" branch's <Outlet/> re-renders with
         * the *new* route content, so the exit animation fades out the
         * very page we're trying to enter. Each page already owns its
         * own staggered entrance via `initial="hidden" animate="show"`
         * on its top-level motion.div, so the tab switch reads as
         * instant-container + page-stagger — which matches the Arc /
         * Linear reference better than a crossfade anyway. */}
        <Outlet />
      </main>
    </div>
  );
}
