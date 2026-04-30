import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../common/Button";
import { fade, scaleFade, spring, tween } from "../../styles/motion";

interface RenameAccountDialogProps {
  isOpen: boolean;
  initialName: string;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (newName: string) => void;
}

const MAX_LEN = 32;

export function RenameAccountDialog({
  isOpen,
  initialName,
  isLoading = false,
  onClose,
  onSave,
}: RenameAccountDialogProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialName);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, initialName]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isLoading) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isLoading, onClose]);

  const trimmed = value.trim();
  const unchanged = trimmed === initialName.trim();
  const empty = trimmed.length === 0;
  const tooLong = trimmed.length > MAX_LEN;
  const canSave = !empty && !tooLong && !unchanged && !isLoading;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave(trimmed);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="rename-scrim"
          initial={fade.initial}
          animate={fade.animate}
          exit={fade.exit}
          transition={tween.shortInQuiet}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-dialog-title"
        >
          <motion.form
            initial={scaleFade.initial}
            animate={scaleFade.animate}
            exit={scaleFade.exit}
            transition={spring.soft}
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-[320px] overflow-hidden"
          >
            <div className="px-5 pt-5 pb-2">
              <h2
                id="rename-dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                Rename account
              </h2>
              <p className="text-[12px] text-zinc-500 mt-1">
                Wallet display name only. The browser passkey label is permanent.
              </p>
            </div>

            <div className="px-5 pb-1">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
                disabled={isLoading}
                placeholder="Account name"
                maxLength={MAX_LEN}
                className="w-full px-3 py-2.5 text-[13px] bg-white border border-zinc-200 rounded-xl placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                <span>{empty ? "Required" : ""}</span>
                <span className="tabular-nums">
                  {trimmed.length}/{MAX_LEN}
                </span>
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5 pt-3">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={!canSave}
                loading={isLoading}
              >
                Save
              </Button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
