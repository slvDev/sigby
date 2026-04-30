import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useWalletStore, syncStoreWithBackground } from "../../store";
import { MessageType } from "../../../types/messages";
import { AccountPill, Icon } from "../ui";
import { SOFT_SHADOW } from "../../styles/theme";
import { scaleFade, spring } from "../../styles/motion";

/**
 * AccountSwitcher — AccountPill + popover listing all accounts. Tap an
 * account to switch; tap outside (or ESC) to close. The pill renders
 * the active account's display name and truncated address.
 */
export function AccountSwitcher() {
  const navigate = useNavigate();
  const { accounts, accountOrder, activeAddress } = useWalletStore();
  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSwitch(address: string) {
    setOpen(false);
    if (address === activeAddress) return;
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.SWITCH_ACCOUNT,
        payload: { address },
      });
      await syncStoreWithBackground();
    } catch (err) {
      console.error("[AccountSwitcher] failed to switch:", err);
    }
  }

  function handleManage() {
    setOpen(false);
    navigate("/settings");
  }

  if (!activeAccount) {
    return <div className="text-[12px] text-zinc-500">No account</div>;
  }

  return (
    <div ref={rootRef} className="relative">
      <AccountPill
        displayName={activeAccount.displayName || "Account"}
        onClick={() => setOpen((v) => !v)}
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={scaleFade.initial}
            animate={scaleFade.animate}
            exit={scaleFade.exit}
            transition={spring.snap}
            className="absolute top-full left-0 mt-2 w-[240px] rounded-2xl bg-white/90 backdrop-blur-xl border border-white/80 overflow-hidden z-40 origin-top-left"
            style={{ boxShadow: SOFT_SHADOW }}
            role="menu"
          >
          <ul className="divide-y divide-zinc-200/60 max-h-[280px] overflow-y-auto">
            {accountOrder.map((addr) => {
              const acc = accounts[addr];
              if (!acc) return null;
              const isActive = addr === activeAddress;
              return (
                <li key={addr}>
                  <button
                    type="button"
                    onClick={() => handleSwitch(addr)}
                    className={`w-full grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white focus:outline-none focus-visible:bg-white ${
                      isActive ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[11px] font-semibold">
                      {acc.displayName?.charAt(0).toUpperCase() || "A"}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-zinc-900 truncate">
                        {acc.displayName}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono tabular-nums">
                        {`${addr.slice(0, 6)}…${addr.slice(-4)}`}
                      </div>
                    </div>
                    {isActive && (
                      <Icon
                        name="check"
                        className="w-3.5 h-3.5 text-blue-600"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
            <button
              type="button"
              onClick={handleManage}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[12px] font-medium text-zinc-700 hover:bg-white focus:outline-none focus-visible:bg-white border-t border-zinc-200/60 transition-colors"
            >
              <Icon name="plus" className="w-3.5 h-3.5" />
              Manage accounts
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
