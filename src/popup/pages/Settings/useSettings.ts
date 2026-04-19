import { useState, useEffect } from "react";
import { useWalletStore, syncStoreWithBackground } from "../../store";
import { popupPortoService } from "../../portoService";
import { errorToString } from "../../../utils/rpcError";

export function useSettings() {
  const {
    accounts,
    accountOrder,
    activeAddress,
    isLoading,
    setLoading,
    setError,
    error,
    showTestnets,
    setShowTestnets,
  } = useWalletStore();

  const [walletName, setWalletName] = useState("");
  const [accountCount, setAccountCount] = useState(0);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

      const response = await chrome.runtime.sendMessage({
        type: "CONNECT_ACCOUNT",
        payload: { address: result.address },
      });

      if (response.success) {
        await syncStoreWithBackground();
        setShowAddAccount(false);
      } else {
        setError(errorToString(response.error) || "Failed to save account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!activeAddress) return;
    setShowDeleteConfirm(false);
    setLoading(true);
    try {
      try {
        await popupPortoService.disconnect();
      } catch (disconnectErr) {
        console.warn("[Settings] Porto disconnect failed:", disconnectErr);
      }

      const response = await chrome.runtime.sendMessage({
        type: "DELETE_ACCOUNT",
        payload: { address: activeAddress },
      });

      if (response.success) {
        await syncStoreWithBackground();
      }
    } catch (err) {
      console.error("Failed to delete account:", err);
    } finally {
      setLoading(false);
    }
  };

  const openAddAccount = () => setShowAddAccount(true);
  const closeAddAccount = () => setShowAddAccount(false);
  const openDeleteConfirm = () => setShowDeleteConfirm(true);
  const closeDeleteConfirm = () => setShowDeleteConfirm(false);

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
    showAddAccount,
    showDeleteConfirm,
    showTestnets,
    setShowTestnets,
    handleCreateAccount,
    handleConnectAccount,
    handleDeleteAccount,
    openAddAccount,
    closeAddAccount,
    openDeleteConfirm,
    closeDeleteConfirm,
    dismissError: () => setError(null),
  };
}
