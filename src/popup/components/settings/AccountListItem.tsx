import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ConnectedDapp } from "../../../types/account";
import { Icon } from "../ui";
import { spring, tween } from "../../styles/motion";
import { AccountActionsMenu } from "./AccountActionsMenu";

interface AccountListItemProps {
  address: string;
  displayName: string;
  isActive: boolean;
  dapps: ConnectedDapp[];
  isBusy?: boolean;
  onSwitch: () => void;
  onRename: () => void;
  onDisconnectAllDapps: () => void;
  onDisconnectDapp: (origin: string) => void;
  onRemove: () => void;
}

function originHostname(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

/**
 * Local-only fallback for dApp icons. Hitting an external favicon
 * service (e.g. google.com/s2/favicons) from the wallet settings
 * screen leaks the user's connected-dApp list to a third party — so
 * if a dApp didn't send its icon during connection approval, we
 * render a generated letter tile instead.
 */
function DappTile({ origin, host }: { origin: string; host: string }) {
  const seed = host || origin;
  const letter = seed.replace(/^www\./, "").charAt(0).toUpperCase() || "?";
  // Stable hue per host so tiles read as different "brands" without
  // hitting the network. 360 buckets is overkill but cheap.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-5 h-5 rounded-md text-white text-[10px] font-semibold"
      style={{ background: `hsl(${hue}, 55%, 55%)` }}
    >
      {letter}
    </span>
  );
}

export function AccountListItem({
  address,
  displayName,
  isActive,
  dapps,
  isBusy,
  onSwitch,
  onRename,
  onDisconnectAllDapps,
  onDisconnectDapp,
  onRemove,
}: AccountListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dappCount = dapps.length;
  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const hasDapps = dappCount > 0;

  return (
    <motion.li layout transition={spring.soft}>
      <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-2.5">
        {isActive && (
          <motion.div
            layoutId="settings-active-row"
            className="absolute inset-0 bg-blue-50/60"
            transition={spring.soft}
          />
        )}

        <button
          type="button"
          onClick={onSwitch}
          disabled={isActive || isBusy}
          aria-label={isActive ? "Active account" : `Switch to ${displayName}`}
          className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[12px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:cursor-default"
        >
          {displayName?.charAt(0).toUpperCase() || "A"}
        </button>

        <button
          type="button"
          onClick={onSwitch}
          disabled={isActive || isBusy}
          className="relative min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-md disabled:cursor-default"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-zinc-900 truncate">
              {displayName}
            </span>
            {isActive && (
              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-[0.08em]">
                Active
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono tabular-nums truncate">
            {truncated}
          </div>
        </button>

        <div className="relative flex items-center gap-1">
          {hasDapps && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Hide ${dappCount} connected dApps`
                  : `Show ${dappCount} connected dApps`
              }
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors"
            >
              {dappCount} dApp{dappCount === 1 ? "" : "s"}
              <motion.span
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={tween.shortOut}
                className="inline-flex"
              >
                <Icon name="chevron-right" className="w-3 h-3" />
              </motion.span>
            </button>
          )}
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${displayName}`}
            className="relative inline-flex items-center justify-center w-7 h-7 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors"
          >
            <Icon name="menu" className="w-4 h-4" />
          </button>
          <AccountActionsMenu
            open={menuOpen}
            anchorRef={menuTriggerRef}
            onClose={() => setMenuOpen(false)}
            onRename={onRename}
            onDisconnectAllDapps={onDisconnectAllDapps}
            onRemove={onRemove}
            dappCount={dappCount}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasDapps && (
          <motion.div
            key="dapps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={tween.baseOut}
            className="overflow-hidden border-t border-zinc-200/60 bg-white/30"
          >
            <ul className="divide-y divide-zinc-200/40">
              {dapps.map((dapp) => {
                const host = originHostname(dapp.origin);
                const label = dapp.metadata?.name || host;
                const storedIcon = dapp.metadata?.icon;
                // Only render <img> for explicit data: URIs or icons whose
                // URL.origin actually matches the dApp's origin. A textual
                // prefix match would let `https://example.com.evil.test/...`
                // pass the gate for origin `https://example.com`.
                const useStored = (() => {
                  if (typeof storedIcon !== "string") return false;
                  if (storedIcon.startsWith("data:")) return true;
                  try {
                    return (
                      new URL(storedIcon).origin ===
                      new URL(dapp.origin).origin
                    );
                  } catch {
                    return false;
                  }
                })();
                return (
                  <li
                    key={dapp.origin}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3.5 py-2"
                  >
                    {useStored ? (
                      <img
                        src={storedIcon}
                        alt=""
                        width={20}
                        height={20}
                        className="w-5 h-5 rounded-md bg-white/80"
                      />
                    ) : (
                      <DappTile origin={dapp.origin} host={host} />
                    )}
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-zinc-800 truncate">
                        {label}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {host}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDisconnectDapp(dapp.origin)}
                      disabled={isBusy}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-md hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 disabled:opacity-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
