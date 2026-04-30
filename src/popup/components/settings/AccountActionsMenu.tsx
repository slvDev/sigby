import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Icon, type IconName } from "../ui";
import { SOFT_SHADOW } from "../../styles/theme";
import { scaleFade, spring } from "../../styles/motion";

const MENU_WIDTH = 200;
const MENU_GAP = 6;
const VIEWPORT_PAD = 8;

export interface AccountActionsMenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onRename: () => void;
  onDisconnectAllDapps: () => void;
  onRemove: () => void;
  dappCount: number;
}

interface Action {
  key: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface MenuPosition {
  top: number;
  left: number;
  origin: "top right" | "bottom right";
}

function computePosition(rect: DOMRect, menuHeight: number): MenuPosition {
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  // Right-anchor: align menu's right edge to the trigger's right edge.
  const left = Math.max(
    VIEWPORT_PAD,
    Math.min(rect.right - MENU_WIDTH, viewportW - MENU_WIDTH - VIEWPORT_PAD)
  );
  const spaceBelow = viewportH - rect.bottom - VIEWPORT_PAD;
  const spaceAbove = rect.top - VIEWPORT_PAD;
  if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
    return { top: rect.bottom + MENU_GAP, left, origin: "top right" };
  }
  return {
    top: Math.max(VIEWPORT_PAD, rect.top - menuHeight - MENU_GAP),
    left,
    origin: "bottom right",
  };
}

export function AccountActionsMenu({
  open,
  anchorRef,
  onClose,
  onRename,
  onDisconnectAllDapps,
  onRemove,
  dappCount,
}: AccountActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  // Initial anchor position before the menu has mounted; refined on
  // first layout once we know the rendered menu height. Using
  // useLayoutEffect avoids a one-frame flash at the wrong coordinates.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    // Estimate height before mount; refined after first layout.
    setPosition(computePosition(rect, 132));
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open || !position) return;
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    const refined = computePosition(rect, menu.offsetHeight);
    if (
      refined.top !== position.top ||
      refined.left !== position.left ||
      refined.origin !== position.origin
    ) {
      setPosition(refined);
    }
  }, [open, position, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      const menu = menuRef.current;
      const anchor = anchorRef.current;
      const target = e.target as Node;
      if (menu?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Scroll inside the popup leaves a fixed-position menu stranded
    // away from its trigger; closing on scroll is simpler than tracking
    // the anchor every frame.
    function onScroll() {
      onClose();
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, onClose, anchorRef]);

  const actions: Action[] = [
    {
      key: "rename",
      label: "Rename",
      icon: "settings",
      onClick: () => {
        onClose();
        onRename();
      },
    },
    {
      key: "disconnect",
      label:
        dappCount > 0
          ? `Disconnect ${dappCount} dApp${dappCount === 1 ? "" : "s"}`
          : "No connected dApps",
      icon: "external",
      disabled: dappCount === 0,
      onClick: () => {
        onClose();
        onDisconnectAllDapps();
      },
    },
    {
      key: "remove",
      label: "Remove account",
      icon: "x",
      danger: true,
      onClick: () => {
        onClose();
        onRemove();
      },
    },
  ];

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && position && (
        <motion.div
          ref={menuRef}
          initial={scaleFade.initial}
          animate={scaleFade.animate}
          exit={scaleFade.exit}
          transition={spring.snap}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: MENU_WIDTH,
            transformOrigin: position.origin,
            boxShadow: SOFT_SHADOW,
            zIndex: 60,
          }}
          className="rounded-xl bg-white/95 backdrop-blur-xl border border-white/80 overflow-hidden"
          role="menu"
        >
          <ul className="divide-y divide-zinc-200/60">
            {actions.map((action) => (
              <li key={action.key}>
                <button
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  role="menuitem"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors focus:outline-none focus-visible:bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
                    action.danger
                      ? "text-rose-600 hover:bg-rose-50/60"
                      : "text-zinc-700 hover:bg-white"
                  }`}
                >
                  <Icon name={action.icon} className="w-3.5 h-3.5" />
                  <span className="flex-1 truncate">{action.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
