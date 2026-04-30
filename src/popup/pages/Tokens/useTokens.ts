import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatUnits } from "viem";
import { useWalletStore } from "../../store";
import { CHAIN_CONFIGS } from "../../../utils/constants";
import { MessageType } from "../../../types/messages";
import type { TokenBalance } from "../../../types/account";
import type { PortoAsset } from "../../../types/porto";

// Wrap viem.formatUnits so a malformed `balance` (non-BigInt-parseable)
// degrades to "0" instead of throwing through the render path.
export function formatBalance(balance: string, decimals: number): string {
  try {
    return formatUnits(BigInt(balance), decimals);
  } catch {
    return "0";
  }
}

// Porto's `metadata.fiat.value` is the per-unit price, not the
// holding value. Multiply or you get "1 USDC + 1 USDT + ETH price"
// in the total.
export function computeHoldingUsdNumber(asset: PortoAsset): number | undefined {
  const price = parseFloat(asset.metadata.fiat?.value ?? "");
  if (!Number.isFinite(price)) return undefined;
  try {
    const amount = parseFloat(
      formatUnits(BigInt(asset.balance), asset.metadata.decimals)
    );
    if (!Number.isFinite(amount)) return undefined;
    const value = amount * price;
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

// Display-only formatter — sums must come from `computeHoldingUsdNumber`,
// not from rounded strings.
export function formatHoldingUsd(value: number): string {
  return value.toFixed(2);
}

function portoAssetToTokenBalance(asset: PortoAsset): TokenBalance {
  const { metadata } = asset;
  const isNative = asset.type === "native";
  const usd = computeHoldingUsdNumber(asset);
  return {
    address: isNative ? "native" : asset.address,
    symbol: metadata.symbol,
    name: metadata.name || metadata.symbol,
    decimals: metadata.decimals,
    balance: asset.balance,
    formatted: formatBalance(asset.balance, metadata.decimals),
    usdValue: usd === undefined ? undefined : formatHoldingUsd(usd),
    isNative,
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

  // Native first (ETH/MATIC/etc.), then ERC-20s. Folding native into
  // the same list so the hero can be just the total — having the
  // native amount as a stray secondary line read like "this is your
  // ETH balance" instead of a total.
  const portoTokens = useMemo(
    () =>
      assets
        .filter(
          (asset: PortoAsset) =>
            asset.type === "erc20" || asset.type === "native"
        )
        .map((asset: PortoAsset) => portoAssetToTokenBalance(asset))
        .sort((a, b) => {
          const aNative = a.address === "native" ? 0 : 1;
          const bNative = b.address === "native" ? 0 : 1;
          return aNative - bNative;
        }),
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
