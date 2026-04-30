import { useCallback, useEffect, useState } from "react";
import { useWalletStore, syncStoreWithBackground } from "../../store";
import { popupPortoService } from "../../portoService";
import { errorToString } from "../../../utils/rpcError";
import { MessageType } from "../../../types/messages";
import type { ConnectedDapp } from "../../../types/account";

type DappsByAddress = Record<string, ConnectedDapp[]>;

export function useSettings() {
  const {
    accounts,
    accountOrder,
    activeAddress,
    isLoading,
    setLoading,
    setError,
    error,
    errorAt,
    showTestnets,
    setShowTestnets,
    unlock,
    autoLockMinutes,
    setAutoLockMinutes,
  } = useWalletStore();

  const [walletName, setWalletName] = useState("");
  const [accountCount, setAccountCount] = useState(0);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [dappsByAddress, setDappsByAddress] = useState<DappsByAddress>({});

  // Per-row dialog state — keyed by address so opening one row doesn't
  // accidentally show the dialog for a different row after a sync.
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [disconnectAllTarget, setDisconnectAllTarget] = useState<string | null>(
    null
  );

  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  useEffect(() => {
    async function getAccountCount() {
      try {
        const stateResponse = await chrome.runtime.sendMessage({
          type: "GET_STATE",
        });
        setAccountCount(stateResponse.data?.accountCount || 0);
      } catch (e) {
        console.error("Failed to get account count:", e);
      }
    }
    getAccountCount();
  }, []);

  const refreshDapps = useCallback(async () => {
    try {
      const next: DappsByAddress = {};
      await Promise.all(
        accountOrder.map(async (addr) => {
          try {
            const res = await chrome.runtime.sendMessage({
              type: MessageType.GET_ACCOUNT_DAPPS,
              payload: { address: addr },
            });
            const map = (res?.data?.dapps as Record<string, ConnectedDapp>) || {};
            next[addr] = Object.values(map).filter((d) => d.connected);
          } catch (err) {
            console.warn("[Settings] dApp lookup failed for", addr, err);
            next[addr] = [];
          }
        })
      );
      setDappsByAddress(next);
    } catch (err) {
      console.warn("[Settings] dApp refresh failed:", err);
    }
  }, [accountOrder]);

  useEffect(() => {
    refreshDapps();
  }, [refreshDapps]);

  const handleCreateAccount = async () => {
    setLoading(true);
    try {
      const keychainLabel = `Berth ${accountCount + 1}`;
      const displayName = walletName.trim() || `Account ${accountCount + 1}`;

      const result = await popupPortoService.createAccount({
        displayName,
        keychainLabel,
      });

      const response = await chrome.runtime.sendMessage({
        type: "CREATE_ACCOUNT",
        payload: { address: result.address, displayName },
      });

      if (response.success) {
        await syncStoreWithBackground();
        setWalletName("");
        setShowAddAccount(false);
        setAccountCount((c) => c + 1);
        unlock();
      } else {
        setError(errorToString(response.error) || "Failed to save account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccount = async () => {
    setLoading(true);
    try {
      const result = await popupPortoService.connectAccount();

      // The wallet-name field is shared with the Create button; honor
      // it on Connect too so a user who types "Trading" then taps
      // "Connect existing" gets that name applied. Empty/whitespace
      // falls through to the background's default naming.
      const displayName = walletName.trim() || undefined;

      const response = await chrome.runtime.sendMessage({
        type: "CONNECT_ACCOUNT",
        payload: { address: result.address, displayName },
      });

      if (response.success) {
        await syncStoreWithBackground();
        setWalletName("");
        setShowAddAccount(false);
        unlock();
      } else {
        setError(errorToString(response.error) || "Failed to save account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async (address: string) => {
    if (address === activeAddress) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.SWITCH_ACCOUNT,
        payload: { address },
      });
      if (response?.success) {
        await syncStoreWithBackground();
      } else {
        setError(errorToString(response?.error) || "Failed to switch account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch account");
    }
  };

  const handleRenameAccount = async (address: string, newName: string) => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_ACCOUNT,
        payload: { address, displayName: newName },
      });
      if (response.success) {
        await syncStoreWithBackground();
        setRenameTarget(null);
      } else {
        setError(errorToString(response.error) || "Failed to rename account");
        // Close the dialog so the error banner isn't hidden behind the
        // scrim; user can re-open and try again with the surfaced reason.
        setRenameTarget(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename account");
      setRenameTarget(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectDapp = async (address: string, origin: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.DISCONNECT_ACCOUNT_DAPP,
        payload: { address, origin },
      });
      if (response?.success) {
        await refreshDapps();
      } else {
        setError(errorToString(response?.error) || "Failed to disconnect dApp");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect dApp");
    }
  };

  const handleDisconnectAllDapps = async (address: string) => {
    const dapps = dappsByAddress[address] || [];
    setLoading(true);
    try {
      // Walk one-at-a-time so a mid-list failure surfaces as soon as it
      // happens; otherwise the modal would close on a partial success and
      // leave stragglers connected without telling the user.
      for (const dapp of dapps) {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.DISCONNECT_ACCOUNT_DAPP,
          payload: { address, origin: dapp.origin },
        });
        if (!response?.success) {
          setError(
            errorToString(response?.error) || "Failed to disconnect dApp"
          );
          // Close the modal so the error banner isn't hidden behind the
          // scrim; partial state is reflected in the refreshed row.
          setDisconnectAllTarget(null);
          await refreshDapps();
          return;
        }
      }
      await refreshDapps();
      setDisconnectAllTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect dApps");
      // Mirror the partial-failure path: close the modal so the error
      // banner isn't hidden behind the scrim on a thrown failure
      // (e.g. chrome.runtime.sendMessage rejecting).
      setDisconnectAllTarget(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (address: string) => {
    setLoading(true);
    try {
      // Only tear down the active provider session when deleting the
      // account it's bound to — calling disconnect for an arbitrary
      // address has no effect on the SDK's active connection.
      if (address === activeAddress) {
        try {
          await popupPortoService.disconnect();
        } catch (disconnectErr) {
          console.warn("[Settings] Porto disconnect failed:", disconnectErr);
        }
      }

      const response = await chrome.runtime.sendMessage({
        type: MessageType.DELETE_ACCOUNT,
        payload: { address },
      });

      if (response.success) {
        await syncStoreWithBackground();
        await refreshDapps();
        setDeleteTarget(null);
      } else {
        setError(errorToString(response.error) || "Failed to delete account");
        // Close the modal so the error banner isn't hidden behind the
        // scrim; consistent with rename and disconnect-all paths.
        setDeleteTarget(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleteTarget(null);
    } finally {
      setLoading(false);
    }
  };

  const openAddAccount = () => setShowAddAccount(true);
  const closeAddAccount = () => setShowAddAccount(false);

  return {
    accounts,
    accountOrder,
    activeAddress,
    activeAccount,
    walletName,
    setWalletName,
    accountCount,
    isLoading,
    error,
    errorAt,
    showAddAccount,
    showTestnets,
    setShowTestnets,
    autoLockMinutes,
    setAutoLockMinutes,
    dappsByAddress,
    renameTarget,
    setRenameTarget,
    deleteTarget,
    setDeleteTarget,
    disconnectAllTarget,
    setDisconnectAllTarget,
    handleCreateAccount,
    handleConnectAccount,
    handleSwitchAccount,
    handleRenameAccount,
    handleDisconnectDapp,
    handleDisconnectAllDapps,
    handleDeleteAccount,
    openAddAccount,
    closeAddAccount,
    dismissError: () => setError(null),
  };
}
