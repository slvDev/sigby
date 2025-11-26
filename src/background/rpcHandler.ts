/**
 * RPC Handler
 * Handles blockchain RPC calls using viem public clients
 * Supports multiple chains with automatic client management
 */

import {
  createPublicClient,
  http,
  type Address,
  type Hex,
} from "viem";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonMumbai,
} from "viem/chains";
import { CHAIN_IDS } from "../utils/constants";

/**
 * Chain configuration with RPC URLs
 */
const CHAIN_CONFIG: Record<number, { chain: any; rpcUrl?: string }> = {
  [CHAIN_IDS.ETHEREUM]: { chain: mainnet },
  [CHAIN_IDS.BASE]: { chain: base },
  [CHAIN_IDS.ARBITRUM]: { chain: arbitrum },
  [CHAIN_IDS.OPTIMISM]: { chain: optimism },
  [CHAIN_IDS.POLYGON]: { chain: polygon },
  [CHAIN_IDS.SEPOLIA]: { chain: sepolia },
  [CHAIN_IDS.BASE_GOERLI]: { chain: baseSepolia }, // Using Sepolia as Goerli is deprecated
  [CHAIN_IDS.ARBITRUM_GOERLI]: { chain: arbitrumSepolia },
  [CHAIN_IDS.OPTIMISM_GOERLI]: { chain: optimismSepolia },
  [CHAIN_IDS.POLYGON_MUMBAI]: { chain: polygonMumbai },
};

/**
 * Transaction call parameters
 */
export interface CallParams {
  from?: Address;
  to: Address;
  data?: Hex;
  value?: bigint;
  gas?: bigint;
  gasPrice?: bigint;
}

/**
 * Gas estimation parameters
 */
export interface EstimateGasParams {
  from?: Address;
  to?: Address;
  data?: Hex;
  value?: bigint;
}

/**
 * RPC Handler class
 * Manages viem public clients and handles RPC method calls
 */
export class RpcHandler {
  // Use any to avoid complex viem generic type issues across different viem versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clients: Map<number, any> = new Map();

  constructor() {
    console.log("[RpcHandler] Initialized");
  }

  /**
   * Get or create a public client for the specified chain
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getClient(chainId: number): any {
    let client = this.clients.get(chainId);

    if (!client) {
      const config = CHAIN_CONFIG[chainId];
      if (!config) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      });

      this.clients.set(chainId, client);
      console.log(`[RpcHandler] Created client for chain ${chainId}`);
    }

    return client;
  }

  /**
   * Get account balance
   * @param address - Account address
   * @param chainId - Chain ID
   * @returns Balance in wei as hex string
   */
  async getBalance(address: string, chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const balance = await client.getBalance({
        address: address as Address,
      });
      return `0x${balance.toString(16)}` as Hex;
    } catch (error) {
      console.error("[RpcHandler] getBalance error:", error);
      throw error;
    }
  }

  /**
   * Execute eth_call
   * @param params - Call parameters
   * @param chainId - Chain ID
   * @returns Call result as hex string
   */
  async call(params: CallParams, chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const result = await client.call({
        account: params.from,
        to: params.to,
        data: params.data,
        value: params.value,
        gas: params.gas,
        gasPrice: params.gasPrice,
      });
      return (result.data || "0x") as Hex;
    } catch (error) {
      console.error("[RpcHandler] call error:", error);
      throw error;
    }
  }

  /**
   * Estimate gas for a transaction
   * @param params - Transaction parameters
   * @param chainId - Chain ID
   * @returns Estimated gas as hex string
   */
  async estimateGas(params: EstimateGasParams, chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const gas = await client.estimateGas({
        account: params.from,
        to: params.to,
        data: params.data,
        value: params.value,
      });
      return `0x${gas.toString(16)}` as Hex;
    } catch (error) {
      console.error("[RpcHandler] estimateGas error:", error);
      throw error;
    }
  }

  /**
   * Get current block number
   * @param chainId - Chain ID
   * @returns Block number as hex string
   */
  async getBlockNumber(chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const blockNumber = await client.getBlockNumber();
      return `0x${blockNumber.toString(16)}` as Hex;
    } catch (error) {
      console.error("[RpcHandler] getBlockNumber error:", error);
      throw error;
    }
  }

  /**
   * Get transaction count (nonce) for address
   * @param address - Account address
   * @param chainId - Chain ID
   * @returns Transaction count as hex string
   */
  async getTransactionCount(address: string, chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const count = await client.getTransactionCount({
        address: address as Address,
      });
      return `0x${count.toString(16)}` as Hex;
    } catch (error) {
      console.error("[RpcHandler] getTransactionCount error:", error);
      throw error;
    }
  }

  /**
   * Get contract code at address
   * @param address - Contract address
   * @param chainId - Chain ID
   * @returns Contract bytecode as hex string
   */
  async getCode(address: string, chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const code = await client.getCode({
        address: address as Address,
      });
      return (code || "0x") as Hex;
    } catch (error) {
      console.error("[RpcHandler] getCode error:", error);
      throw error;
    }
  }

  /**
   * Get transaction receipt
   * @param hash - Transaction hash
   * @param chainId - Chain ID
   * @returns Transaction receipt or null
   */
  async getTransactionReceipt(hash: string, chainId: number): Promise<any> {
    try {
      const client = this.getClient(chainId);
      const receipt = await client.getTransactionReceipt({
        hash: hash as Hex,
      });
      return receipt;
    } catch (error) {
      console.error("[RpcHandler] getTransactionReceipt error:", error);
      throw error;
    }
  }

  /**
   * Get transaction by hash
   * @param hash - Transaction hash
   * @param chainId - Chain ID
   * @returns Transaction or null
   */
  async getTransactionByHash(hash: string, chainId: number): Promise<any> {
    try {
      const client = this.getClient(chainId);
      const tx = await client.getTransaction({
        hash: hash as Hex,
      });
      return tx;
    } catch (error) {
      console.error("[RpcHandler] getTransactionByHash error:", error);
      throw error;
    }
  }

  /**
   * Get gas price
   * @param chainId - Chain ID
   * @returns Gas price as hex string
   */
  async getGasPrice(chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const gasPrice = await client.getGasPrice();
      return `0x${gasPrice.toString(16)}` as Hex;
    } catch (error) {
      console.error("[RpcHandler] getGasPrice error:", error);
      throw error;
    }
  }

  /**
   * Get chain ID from the network
   * @param chainId - Expected chain ID (used to select client)
   * @returns Chain ID as hex string
   */
  async getChainId(chainId: number): Promise<Hex> {
    try {
      const client = this.getClient(chainId);
      const id = await client.getChainId();
      return `0x${id.toString(16)}` as Hex;
    } catch (error) {
      console.error("[RpcHandler] getChainId error:", error);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
export const rpcHandler = new RpcHandler();
