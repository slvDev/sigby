import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { CHAIN_CONFIGS } from "../../../utils/constants";
import { MessageType } from "../../../types/messages";
import type { TokenBalance } from "../../../types/account";
import type { PortoAsset } from "../../../types/porto";

function formatBalance(balance: string, decimals: number): string {
  try {
    const raw = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const intPart = raw / divisor;
    const fracPart = raw % divisor;
    const fracStr = fracPart.toString().padStart(decimals, "0");
    const trimmedFrac = fracStr.slice(0, 6).replace(/0+$/, "");
    return trimmedFrac.length === 0
      ? intPart.toString()
      : `${intPart}.${trimmedFrac}`;
  } catch {
    return "0";
  }
}

function portoAssetToTokenBalance(asset: PortoAsset): TokenBalance {
  const { metadata } = asset;
  return {
    address: asset.address,
    symbol: metadata.symbol,
    name: metadata.name || metadata.symbol,
    decimals: metadata.decimals,
    balance: asset.balance,
    formatted: formatBalance(asset.balance, metadata.decimals),
    usdValue: metadata.fiat?.value,
    isCustom: false,
  };
}

export function useTokens() {
  const navigate = useNavigate();
  const { activeAddress, chainId, assets, assetsLoading, refreshAssets } =
    useWalletStore();

  const [customTokens, setCustomTokens] = useState<TokenBalance[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const chainConfig = CHAIN_CONFIGS[chainId];
  const chainName = chainConfig?.name || "Unknown Network";

  const portoTokens = useMemo(
    () =>
      assets
        .filter((asset: PortoAsset) => asset.type === "erc20")
        .map((asset: PortoAsset) => portoAssetToTokenBalance(asset)),
    [assets]
  );

  const tokens = useMemo(() => {
    const portoAddresses = new Set(
      portoTokens.map((t) => t.address.toLowerCase())
    );
    const uniqueCustomTokens = customTokens
      .filter((t) => !portoAddresses.has(t.address.toLowerCase()))
      .map((t) => ({ ...t, isCustom: true }));
    return [...portoTokens, ...uniqueCustomTokens];
  }, [portoTokens, customTokens]);

  useEffect(() => {
    if (activeAddress) refreshAssets();
  }, [activeAddress, chainId]);

  const fetchCustomTokens = useCallback(async () => {
    if (!activeAddress) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_TOKEN_BALANCES,
        payload: { address: activeAddress, chainId },
      });
      if (response.success && response.data) setCustomTokens(response.data);
    } catch (err) {
      console.error("[Tokens] Error fetching custom tokens:", err);
    }
  }, [activeAddress, chainId]);

  useEffect(() => {
    fetchCustomTokens();
  }, [fetchCustomTokens]);

  // Auto-remove custom tokens that Porto has started returning natively.
  useEffect(() => {
    if (portoTokens.length === 0 || customTokens.length === 0) return;
    const portoAddresses = new Set(
      portoTokens.map((t) => t.address.toLowerCase())
    );
    for (const customToken of customTokens) {
      if (portoAddresses.has(customToken.address.toLowerCase())) {
        chrome.runtime
          .sendMessage({
            type: MessageType.REMOVE_CUSTOM_TOKEN,
            payload: {
              accountAddress: activeAddress,
              tokenAddress: customToken.address,
              chainId,
            },
          })
          .then(() => {
            setCustomTokens((prev) =>
              prev.filter((t) => t.address !== customToken.address)
            );
          })
          .catch((e) => {
            console.warn("[Tokens] Failed to auto-remove custom token:", e);
          });
      }
    }
  }, [portoTokens, customTokens, activeAddress, chainId]);

  const handleTokenAdded = (token: TokenBalance) => {
    setCustomTokens((prev) => [...prev, { ...token, isCustom: true }]);
  };

  const handleTokenClick = (token: TokenBalance) => {
    navigate(`/token/${token.address}`, { state: { token } });
  };

  const handleRemoveToken = async (token: TokenBalance) => {
    if (!activeAddress) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.REMOVE_CUSTOM_TOKEN,
        payload: {
          accountAddress: activeAddress,
          tokenAddress: token.address,
          chainId,
        },
      });
      if (response.success) {
        setCustomTokens((prev) =>
          prev.filter((t) => t.address !== token.address)
        );
      } else {
        console.error("[Tokens] Failed to remove token:", response.error);
      }
    } catch (err) {
      console.error("[Tokens] Error removing token:", err);
    }
  };

  const openAddModal = () => setIsAddModalOpen(true);
  const closeAddModal = () => setIsAddModalOpen(false);
  const handleRefresh = () => refreshAssets(true);

  return {
    activeAddress,
    chainId,
    chainName,
    tokens,
    assetsLoading,
    isAddModalOpen,
    handleTokenAdded,
    handleTokenClick,
    handleRemoveToken,
    openAddModal,
    closeAddModal,
    handleRefresh,
  };
}
