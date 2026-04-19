import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { CHAIN_CONFIGS } from "../../../utils/constants";

export function useReceive() {
  const navigate = useNavigate();
  const { activeAddress, accounts, chainId } = useWalletStore();
  const activeAccount = activeAddress ? accounts[activeAddress] : null;
  const chainConfig = CHAIN_CONFIGS[chainId];
  const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
  const chainName = chainConfig?.name || "current";

  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = () => {
    if (!activeAddress) return;
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 2000);
  };

  const handleBack = () => navigate(-1);

  return {
    activeAccount,
    activeAddress,
    nativeSymbol,
    chainName,
    copied,
    handleCopy,
    handleBack,
  };
}
