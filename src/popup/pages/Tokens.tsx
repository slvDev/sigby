/**
 * Tokens Page
 * Display and manage ERC-20 tokens using Porto SDK's wallet_getAssets
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../store";
import { Header } from "../components/layout/Header";
import { BottomNav } from "../components/layout/BottomNav";
import { TokenList, AddTokenModal } from "../components/token";
import { CHAIN_CONFIGS } from "../../utils/constants";
import { MessageType } from "../../types/messages";
import type { TokenBalance } from "../../types/account";
import type { PortoAsset } from "../../types/porto";

/**
 * Format a raw balance to human-readable string
 */
function formatBalance(balance: string, decimals: number): string {
  try {
    const raw = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const intPart = raw / divisor;
    const fracPart = raw % divisor;

    // Pad fractional part with leading zeros
    const fracStr = fracPart.toString().padStart(decimals, '0');
    // Take first 6 decimal places
    const trimmedFrac = fracStr.slice(0, 6).replace(/0+$/, '');

    if (trimmedFrac.length === 0) {
      return intPart.toString();
    }
    return `${intPart}.${trimmedFrac}`;
  } catch {
    return "0";
  }
}

/**
 * Convert Porto asset to TokenBalance
 * Porto returns nested metadata structure
 */
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

export function Tokens() {
  const navigate = useNavigate();
  const { activeAddress, chainId, assets, assetsLoading, refreshAssets } = useWalletStore();

  const [customTokens, setCustomTokens] = useState<TokenBalance[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const chainConfig = CHAIN_CONFIGS[chainId];
  const chainName = chainConfig?.name || "Unknown Network";

  // Convert Porto assets to TokenBalance format
  const portoTokens = useMemo(() => {
    return assets
      .filter((asset: PortoAsset) => asset.type === 'erc20')
      .map((asset: PortoAsset) => portoAssetToTokenBalance(asset));
  }, [assets]);

  // Merge Porto tokens with custom tokens (excluding duplicates)
  const tokens = useMemo(() => {
    const portoAddresses = new Set(portoTokens.map(t => t.address.toLowerCase()));
    const uniqueCustomTokens = customTokens
      .filter(t => !portoAddresses.has(t.address.toLowerCase()))
      .map(t => ({ ...t, isCustom: true }));
    return [...portoTokens, ...uniqueCustomTokens];
  }, [portoTokens, customTokens]);

  // Refresh assets on mount and when dependencies change
  useEffect(() => {
    if (activeAddress) {
      refreshAssets();
    }
  }, [activeAddress, chainId]);

  // Fetch custom tokens from storage
  const fetchCustomTokens = useCallback(async () => {
    if (!activeAddress) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_TOKEN_BALANCES,
        payload: { address: activeAddress, chainId },
      });
      if (response.success && response.data) {
        setCustomTokens(response.data);
      }
    } catch (err) {
      console.error("[Tokens] Error fetching custom tokens:", err);
    }
  }, [activeAddress, chainId]);

  useEffect(() => {
    fetchCustomTokens();
  }, [fetchCustomTokens]);

  // Auto-remove custom tokens that Porto now returns
  useEffect(() => {
    if (portoTokens.length === 0 || customTokens.length === 0) return;

    const portoAddresses = new Set(portoTokens.map(t => t.address.toLowerCase()));

    for (const customToken of customTokens) {
      if (portoAddresses.has(customToken.address.toLowerCase())) {
        chrome.runtime.sendMessage({
          type: MessageType.REMOVE_CUSTOM_TOKEN,
          payload: {
            accountAddress: activeAddress,
            tokenAddress: customToken.address,
            chainId,
          },
        }).then(() => {
          console.log(`[Tokens] Auto-removed custom token ${customToken.symbol} - Porto now provides it`);
          setCustomTokens(prev => prev.filter(t => t.address !== customToken.address));
        }).catch(e => {
          console.warn(`[Tokens] Failed to auto-remove custom token:`, e);
        });
      }
    }
  }, [portoTokens, customTokens, activeAddress, chainId]);

  // Handle token added
  const handleTokenAdded = (token: TokenBalance) => {
    setCustomTokens((prev) => [...prev, { ...token, isCustom: true }]);
  };

  // Handle token click - navigate to detail page
  const handleTokenClick = (token: TokenBalance) => {
    navigate(`/token/${token.address}`, { state: { token } });
  };

  // Handle token removal (only for custom tokens)
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
        setCustomTokens((prev) => prev.filter((t) => t.address !== token.address));
      } else {
        console.error("[Tokens] Failed to remove token:", response.error);
      }
    } catch (err) {
      console.error("[Tokens] Error removing token:", err);
    }
  };

  // No account selected
  if (!activeAddress) {
    return (
      <div className="flex flex-col flex-1">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6 text-gray-500">
          Select an account to view tokens
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header />

      {/* Page Content */}
      <div className="flex flex-col flex-1">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Tokens</h1>
            <p className="text-xs text-gray-400">{chainName}</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add
          </button>
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto">
          <TokenList
            tokens={tokens}
            isLoading={assetsLoading}
            error={null}
            onTokenClick={handleTokenClick}
            showRemove={true}
            onRemove={handleRemoveToken}
            emptyMessage="No tokens found. Tap 'Add' to import a custom token."
          />
        </div>

        {/* Refresh hint */}
        {!assetsLoading && tokens.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100">
            <button
              onClick={() => refreshAssets(true)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Tap to refresh
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Add Token Modal */}
      <AddTokenModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleTokenAdded}
        accountAddress={activeAddress}
        chainId={chainId}
        chainName={chainName}
      />
    </div>
  );
}
