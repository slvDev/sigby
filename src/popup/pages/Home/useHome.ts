import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore, syncStoreWithBackground } from "../../store";
import { popupPortoService } from "../../portoService";
import { errorToString } from "../../../utils/rpcError";
import { CHAIN_CONFIGS } from "../../../utils/constants";

export function useHome() {
  const navigate = useNavigate();
  const {
    accounts,
    accountOrder,
    activeAddress,
    chainId,
    assets,
    assetsLoading,
    refreshAssets,
    isLoading,
    error,
    errorAt,
    setLoading,
    setError,
    celebrate,
    unlock,
  } = useWalletStore();

  const [walletName, setWalletName] = useState("");
  const [accountCount, setAccountCount] = useState(0);

  const nativeAsset = assets.find((a) => a.type === "native");
  const balance = nativeAsset
    ? (Number(BigInt(nativeAsset.balance)) / 1e18).toFixed(7)
    : "0";
  const nativeSymbol = CHAIN_CONFIGS[chainId]?.nativeCurrency.symbol || "ETH";

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

  useEffect(() => {
    if (activeAddress) refreshAssets();
  }, [activeAddress, chainId]);

  const handleCreateAccount = async () => {
    setLoading(true);
    setError(null);
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
        setAccountCount((c) => c + 1);
        // Passkey just touched — no need to re-prompt on the lock gate.
        unlock();
        // Biometric gate cleared — fire the beat. HeroCard orbs pulse.
        celebrate("passkey-success");
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
    setError(null);
    try {
      const result = await popupPortoService.connectAccount();

      // The wallet-name field is shared with the Create button; honor
      // it on Connect too so a user who types "Trading" then taps
      // "Restore existing passkey account" gets that name applied.
      // Empty/whitespace falls through to the background's default naming.
      const displayName = walletName.trim() || undefined;

      const response = await chrome.runtime.sendMessage({
        type: "CONNECT_ACCOUNT",
        payload: { address: result.address, displayName },
      });

      if (response.success) {
        await syncStoreWithBackground();
        setWalletName("");
        unlock();
        celebrate("passkey-success");
      } else {
        setError(errorToString(response.error) || "Failed to save account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setLoading(false);
    }
  };

  const hasAccounts = accountOrder.length > 0;
  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  const handleCopyAddress = () => {
    if (activeAccount) navigator.clipboard.writeText(activeAccount.address);
  };
  const handleGoSend = () => navigate("/send");
  const handleGoReceive = () => navigate("/receive");

  return {
    walletName,
    setWalletName,
    accountCount,
    activeAccount,
    hasAccounts,
    balance,
    nativeSymbol,
    assetsLoading,
    isLoading,
    error,
    errorAt,
    handleCreateAccount,
    handleConnectAccount,
    handleCopyAddress,
    handleGoSend,
    handleGoReceive,
    dismissError: () => setError(null),
  };
}
