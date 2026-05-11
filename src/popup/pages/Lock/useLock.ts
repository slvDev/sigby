import { useState } from "react";
import { MessageType } from "../../../types/messages";
import { errorToString } from "../../../utils/rpcError";
import { popupPortoService } from "../../portoService";
import { syncStoreWithBackground, useWalletStore } from "../../store";

export interface LockView {
  isUnlocking: boolean;
  hasActiveAddress: boolean;
  error: string | null;
  errorAt: number | null;
  handleUnlock: () => Promise<void>;
  dismissError: () => void;
}

export function useLock(): LockView {
  const activeAddress = useWalletStore((s) => s.activeAddress);
  const unlock = useWalletStore((s) => s.unlock);
  const celebrate = useWalletStore((s) => s.celebrate);

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAt, setErrorAt] = useState<number | null>(null);

  async function handleUnlock() {
    if (!activeAddress) return;
    setIsUnlocking(true);
    setError(null);
    setErrorAt(null);
    try {
      if (!popupPortoService.isReady()) {
        await popupPortoService.initialize();
      }

      const selectedAddress = await popupPortoService.unlockAdoptive(activeAddress);

      if (selectedAddress.toLowerCase() !== activeAddress.toLowerCase()) {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.CONNECT_ACCOUNT,
          payload: { address: selectedAddress },
        });

        if (!response?.success) {
          throw new Error(errorToString(response?.error) || "Failed to activate account");
        }

        await syncStoreWithBackground();
      }

      unlock();
      celebrate("passkey-success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unlock failed";
      setError(msg);
      setErrorAt(Date.now());
    } finally {
      setIsUnlocking(false);
    }
  }

  function dismissError() {
    setError(null);
    setErrorAt(null);
  }

  return {
    isUnlocking,
    hasActiveAddress: !!activeAddress,
    error,
    errorAt,
    handleUnlock,
    dismissError,
  };
}
