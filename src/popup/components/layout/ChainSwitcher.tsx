import { useEffect, useRef, useState } from "react";
import { useWalletStore, syncStoreWithBackground } from "../../store";
import { MessageType } from "../../../types/messages";
import {
  CHAIN_CONFIGS,
  MAINNET_CHAIN_IDS,
  TESTNET_CHAIN_IDS,
} from "../../../utils/constants";
import { ChainPill, Icon } from "../ui";
import { SOFT_SHADOW } from "../../styles/theme";

/**
 * ChainSwitcher — ChainPill + popover listing supported chains. Honors
 * the `showTestnets` setting to hide/show the testnet group.
 */
export function ChainSwitcher() {
  const { chainId, showTestnets } = useWalletStore();

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

  async function handleSwitch(nextChainId: number) {
    setOpen(false);
    if (nextChainId === chainId) return;
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.SWITCH_CHAIN,
        payload: { chainId: nextChainId },
      });
      await syncStoreWithBackground();
    } catch (err) {
      console.error("[ChainSwitcher] failed to switch:", err);
    }
  }

  const active = CHAIN_CONFIGS[chainId];
  const chainName = active?.name || "Unknown";

  return (
    <div ref={rootRef} className="relative">
      <ChainPill chainName={chainName} onClick={() => setOpen((v) => !v)} />

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-[220px] rounded-2xl bg-white/90 backdrop-blur-xl border border-white/80 overflow-hidden z-40"
          style={{ boxShadow: SOFT_SHADOW }}
          role="menu"
        >
          <ChainGroup
            label="Mainnets"
            chainIds={MAINNET_CHAIN_IDS}
            activeChainId={chainId}
            onSelect={handleSwitch}
          />
          {showTestnets && (
            <ChainGroup
              label="Testnets"
              chainIds={TESTNET_CHAIN_IDS}
              activeChainId={chainId}
              onSelect={handleSwitch}
            />
          )}
        </div>
      )}
    </div>
  );
}

type ChainGroupProps = {
  label: string;
  chainIds: readonly number[];
  activeChainId: number;
  onSelect: (chainId: number) => void;
};

function ChainGroup({
  label,
  chainIds,
  activeChainId,
  onSelect,
}: ChainGroupProps) {
  return (
    <div className="border-t border-zinc-200/60 first:border-t-0">
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </div>
      <ul>
        {chainIds.map((id) => {
          const cfg = CHAIN_CONFIGS[id];
          if (!cfg) return null;
          const isActive = id === activeChainId;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={`w-full grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3 py-2 text-left hover:bg-white focus:outline-none focus-visible:bg-white ${
                  isActive ? "bg-blue-50/60" : ""
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-zinc-900 truncate">
                    {cfg.name}
                  </div>
                </div>
                {isActive && (
                  <Icon name="check" className="w-3.5 h-3.5 text-blue-600" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
