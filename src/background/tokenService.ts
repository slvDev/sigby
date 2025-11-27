/**
 * Token Service
 * Handles ERC-20 token balance fetching, metadata retrieval, and custom token management
 */

import { rpcHandler } from "./rpcHandler";
import { storageManager } from "../utils/storage";
import type { TokenBalance } from "../types/account";
import {
  encodeBalanceOf,
  encodeDecimals,
  encodeSymbol,
  encodeName,
  decodeUint256,
  decodeUint8,
  decodeString,
  formatTokenBalance,
} from "../utils/erc20Abi";
import type { Address, Hex } from "viem";

/**
 * Token Service class
 * Manages ERC-20 token operations
 */
class TokenService {
  constructor() {
    console.log("[TokenService] Initialized");
  }

  /**
   * Get token metadata (symbol, name, decimals)
   * Uses cache if available, otherwise fetches from chain
   * @param tokenAddress - Token contract address
   * @param chainId - Chain ID
   * @returns Token metadata
   */
  async getTokenMetadata(
    tokenAddress: string,
    chainId: number
  ): Promise<{ symbol: string; name: string; decimals: number }> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Check cache first
    const cached = await storageManager.getTokenMetadataCache(normalizedAddress, chainId);
    if (cached) {
      console.log(`[TokenService] Using cached metadata for ${normalizedAddress}`);
      return {
        symbol: cached.symbol,
        name: cached.name,
        decimals: cached.decimals,
      };
    }

    console.log(`[TokenService] Fetching metadata for ${normalizedAddress} on chain ${chainId}`);

    // Fetch from chain (parallel requests)
    const [symbolResult, nameResult, decimalsResult] = await Promise.all([
      this.callContract(normalizedAddress, encodeSymbol(), chainId),
      this.callContract(normalizedAddress, encodeName(), chainId),
      this.callContract(normalizedAddress, encodeDecimals(), chainId),
    ]);

    const symbol = decodeString(symbolResult) || "UNKNOWN";
    const name = decodeString(nameResult) || "Unknown Token";
    const decimals = decodeUint8(decimalsResult) || 18;

    // Cache the metadata
    await storageManager.setTokenMetadataCache(normalizedAddress, chainId, {
      address: normalizedAddress,
      symbol,
      name,
      decimals,
      chainId,
    });

    console.log(`[TokenService] Cached metadata for ${symbol} (${normalizedAddress})`);

    return { symbol, name, decimals };
  }

  /**
   * Get balance for a specific token
   * @param ownerAddress - Address to check balance for
   * @param tokenAddress - Token contract address
   * @param chainId - Chain ID
   * @returns TokenBalance object
   */
  async getTokenBalance(
    ownerAddress: string,
    tokenAddress: string,
    chainId: number
  ): Promise<TokenBalance> {
    const normalizedToken = tokenAddress.toLowerCase();
    const normalizedOwner = ownerAddress.toLowerCase();

    console.log(`[TokenService] Getting balance for ${normalizedToken} on chain ${chainId}`);

    // Fetch metadata and balance in parallel
    const [metadata, balanceResult] = await Promise.all([
      this.getTokenMetadata(normalizedToken, chainId),
      this.callContract(normalizedToken, encodeBalanceOf(normalizedOwner), chainId),
    ]);

    const balance = decodeUint256(balanceResult);
    const formatted = formatTokenBalance(balance, metadata.decimals);

    return {
      address: normalizedToken,
      symbol: metadata.symbol,
      name: metadata.name,
      decimals: metadata.decimals,
      balance: balance.toString(),
      formatted,
      // valueUSD deferred to Phase 7.5
    };
  }

  /**
   * Get balances for all custom tokens for an account on a chain
   * @param ownerAddress - Address to check balances for
   * @param chainId - Chain ID
   * @returns Array of TokenBalance objects
   */
  async getTokenBalances(
    ownerAddress: string,
    chainId: number
  ): Promise<TokenBalance[]> {
    console.log(`[TokenService] Getting all token balances for ${ownerAddress} on chain ${chainId}`);

    // Get custom token addresses for this account/chain
    const tokenAddresses = await storageManager.getCustomTokens(ownerAddress, chainId);

    if (tokenAddresses.length === 0) {
      console.log("[TokenService] No custom tokens found");
      return [];
    }

    console.log(`[TokenService] Fetching balances for ${tokenAddresses.length} tokens`);

    // Fetch all balances in parallel
    const balances = await Promise.all(
      tokenAddresses.map((tokenAddr) =>
        this.getTokenBalance(ownerAddress, tokenAddr, chainId).catch((error) => {
          console.error(`[TokenService] Failed to get balance for ${tokenAddr}:`, error);
          return null;
        })
      )
    );

    // Filter out failed fetches and zero balances
    const validBalances = balances.filter(
      (b): b is TokenBalance => b !== null && BigInt(b.balance) > 0n
    );

    console.log(`[TokenService] Got ${validBalances.length} non-zero balances`);
    return validBalances;
  }

  /**
   * Add a custom token for an account
   * Validates the token contract exists and returns the token info
   * @param accountAddress - Account address
   * @param tokenAddress - Token contract address
   * @param chainId - Chain ID
   * @returns TokenBalance for the added token
   */
  async addCustomToken(
    accountAddress: string,
    tokenAddress: string,
    chainId: number
  ): Promise<TokenBalance> {
    const normalizedToken = tokenAddress.toLowerCase();

    console.log(`[TokenService] Adding custom token ${normalizedToken} for ${accountAddress}`);

    // Validate token contract by fetching metadata
    // This will throw if the contract doesn't exist or isn't an ERC-20
    const metadata = await this.getTokenMetadata(normalizedToken, chainId);

    // Add to storage
    await storageManager.addCustomToken(accountAddress, chainId, normalizedToken);

    // Get the current balance
    const balance = await this.getTokenBalance(accountAddress, normalizedToken, chainId);

    console.log(`[TokenService] Added ${metadata.symbol} token`);
    return balance;
  }

  /**
   * Remove a custom token for an account
   * @param accountAddress - Account address
   * @param tokenAddress - Token contract address
   * @param chainId - Chain ID
   */
  async removeCustomToken(
    accountAddress: string,
    tokenAddress: string,
    chainId: number
  ): Promise<void> {
    const normalizedToken = tokenAddress.toLowerCase();

    console.log(`[TokenService] Removing custom token ${normalizedToken} for ${accountAddress}`);

    await storageManager.removeCustomToken(accountAddress, chainId, normalizedToken);

    console.log("[TokenService] Token removed");
  }

  /**
   * Get custom token addresses for an account
   * @param accountAddress - Account address
   * @param chainId - Chain ID (optional, if omitted returns all chains)
   * @returns Token addresses or Record<chainId, addresses[]>
   */
  async getCustomTokenAddresses(
    accountAddress: string,
    chainId?: number
  ): Promise<string[] | Record<number, string[]>> {
    if (chainId !== undefined) {
      return storageManager.getCustomTokens(accountAddress, chainId);
    }
    return storageManager.getAllCustomTokensForAccount(accountAddress);
  }

  /**
   * Helper: Make a contract call via RpcHandler
   * @param to - Contract address
   * @param data - Encoded call data
   * @param chainId - Chain ID
   * @returns Hex result from contract
   */
  private async callContract(to: string, data: string, chainId: number): Promise<Hex> {
    try {
      return await rpcHandler.call(
        {
          to: to as Address,
          data: data as Hex,
        },
        chainId
      );
    } catch (error) {
      console.error(`[TokenService] Contract call failed for ${to}:`, error);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
export const tokenService = new TokenService();
