import { useState } from "react";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";

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
      await popupPortoService.signCanary(activeAddress);
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
