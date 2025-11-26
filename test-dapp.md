# Wallet Test dApp

A React + Viem test application for testing wallet extension functionality.

## Quick Start

```bash
# Create new project
pnpm create vite wallet-test-dapp --template react-ts
cd wallet-test-dapp

# Install dependencies
pnpm add viem
pnpm install

# Replace src/ contents with code below
# Then run:
pnpm dev
```

## Project Structure

```
wallet-test-dapp/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── hooks/
│   │   └── useWallet.ts
│   ├── components/
│   │   ├── ConnectionStatus.tsx
│   │   ├── SendTransaction.tsx
│   │   ├── SignMessage.tsx
│   │   ├── SignTypedData.tsx
│   │   ├── ChainSwitcher.tsx
│   │   └── EventLog.tsx
│   └── main.tsx
├── index.html
└── package.json
```

---

## Source Files

### `src/hooks/useWallet.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  formatEther,
  parseEther,
  type WalletClient,
  type PublicClient,
  type Chain,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { mainnet, base, sepolia, arbitrum, optimism } from "viem/chains";

// Supported chains
export const CHAINS: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  11155111: sepolia,
  42161: arbitrum,
  10: optimism,
};

// Log entry type
export interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error";
}

// Hook return type
export interface UseWalletReturn {
  // State
  address: Address | null;
  chainId: number | null;
  balance: string | null;
  isConnecting: boolean;
  walletClient: WalletClient | null;
  publicClient: PublicClient | null;
  logs: LogEntry[];

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  sendTransaction: (to: Address, value: string, data?: Hex) => Promise<Hash>;
  signMessage: (message: string) => Promise<Hex>;
  signTypedData: (typedData: any) => Promise<Hex>;
  estimateGas: (to: Address, value: string, data?: Hex) => Promise<bigint>;
  log: (message: string, type?: LogEntry["type"]) => void;
  clearLogs: () => void;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  // Logger
  const log = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      setLogs((prev) => [
        {
          id: logIdRef.current++,
          timestamp: new Date(),
          message,
          type,
        },
        ...prev,
      ]);
    },
    []
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  // Get provider
  const getProvider = useCallback(() => {
    if (typeof window === "undefined" || !window.ethereum) return null;

    // Check for wallet specifically
    if ((window.ethereum as any).isPorto) {
      return window.ethereum;
    }

    // Check providers array (EIP-6963)
    if ((window.ethereum as any).providers) {
      const porto = (window.ethereum as any).providers.find(
        (p: any) => p.isPorto
      );
      if (porto) return porto;
    }

    return window.ethereum;
  }, []);

  // Create clients
  const createClients = useCallback(
    (chain: Chain) => {
      const provider = getProvider();
      if (!provider) return { walletClient: null, publicClient: null };

      const walletClient = createWalletClient({
        chain,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        chain,
        transport: custom(provider),
      });

      return { walletClient, publicClient };
    },
    [getProvider]
  );

  // Connect wallet
  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      log("No wallet found. Please install Porto Wallet.", "error");
      return;
    }

    setIsConnecting(true);
    try {
      log("Requesting accounts...");
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];
      const chainIdHex = (await provider.request({
        method: "eth_chainId",
      })) as string;
      const currentChainId = parseInt(chainIdHex, 16);

      setAddress(accounts[0]);
      setChainId(currentChainId);

      const chain = CHAINS[currentChainId] || base;
      const { walletClient, publicClient } = createClients(chain);
      setWalletClient(walletClient);
      setPublicClient(publicClient);

      log(`Connected: ${accounts[0]}`, "success");
      log(`Chain ID: ${currentChainId}`);
    } catch (error: any) {
      log(`Connection failed: ${error.message}`, "error");
    } finally {
      setIsConnecting(false);
    }
  }, [getProvider, createClients, log]);

  // Disconnect
  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setBalance(null);
    setWalletClient(null);
    setPublicClient(null);
    log("Disconnected");
  }, [log]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!publicClient || !address) return;

    try {
      const bal = await publicClient.getBalance({ address });
      setBalance(formatEther(bal));
      log(`Balance: ${formatEther(bal)} ETH`);
    } catch (error: any) {
      log(`Failed to get balance: ${error.message}`, "error");
    }
  }, [publicClient, address, log]);

  // Switch chain
  const switchChain = useCallback(
    async (newChainId: number) => {
      const provider = getProvider();
      if (!provider) return;

      try {
        log(`Switching to chain ${newChainId}...`);
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${newChainId.toString(16)}` }],
        });
        log(`Switched to chain ${newChainId}`, "success");
      } catch (error: any) {
        log(`Chain switch failed: ${error.message}`, "error");
        throw error;
      }
    },
    [getProvider, log]
  );

  // Send transaction
  const sendTransaction = useCallback(
    async (to: Address, value: string, data?: Hex): Promise<Hash> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }

      log(`Sending ${value} ETH to ${to}...`);
      const hash = await walletClient.sendTransaction({
        account: address,
        to,
        value: parseEther(value),
        data: data || "0x",
      });

      log(`Transaction sent: ${hash}`, "success");
      return hash;
    },
    [walletClient, address, log]
  );

  // Sign message
  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }

      log(
        `Signing message: "${message.substring(0, 50)}${
          message.length > 50 ? "..." : ""
        }"`
      );
      const signature = await walletClient.signMessage({
        account: address,
        message,
      });

      log(`Signature: ${signature.substring(0, 20)}...`, "success");
      return signature;
    },
    [walletClient, address, log]
  );

  // Sign typed data
  const signTypedData = useCallback(
    async (typedData: any): Promise<Hex> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }

      log("Signing typed data...");
      const signature = await walletClient.signTypedData({
        account: address,
        ...typedData,
      });

      log(`Typed data signature: ${signature.substring(0, 20)}...`, "success");
      return signature;
    },
    [walletClient, address, log]
  );

  // Estimate gas
  const estimateGas = useCallback(
    async (to: Address, value: string, data?: Hex): Promise<bigint> => {
      if (!publicClient || !address) {
        throw new Error("Wallet not connected");
      }

      const gas = await publicClient.estimateGas({
        account: address,
        to,
        value: parseEther(value),
        data: data || "0x",
      });

      log(`Estimated gas: ${gas.toString()}`);
      return gas;
    },
    [publicClient, address, log]
  );

  // Setup event listeners
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: Address[]) => {
      log(`Event: accountsChanged - ${accounts[0] || "disconnected"}`);
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      log(`Event: chainChanged - ${newChainId}`);
      setChainId(newChainId);

      const chain = CHAINS[newChainId] || base;
      const { walletClient, publicClient } = createClients(chain);
      setWalletClient(walletClient);
      setPublicClient(publicClient);
    };

    const handleConnect = (info: { chainId: string }) => {
      log(`Event: connect - chainId: ${info.chainId}`);
    };

    const handleDisconnect = (error: any) => {
      log(`Event: disconnect - ${error?.message || "disconnected"}`, "error");
      disconnect();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("connect", handleConnect);
    provider.on("disconnect", handleDisconnect);

    log("Event listeners registered");

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
      provider.removeListener("connect", handleConnect);
      provider.removeListener("disconnect", handleDisconnect);
    };
  }, [getProvider, createClients, disconnect, log]);

  // Fetch balance when address/chain changes
  useEffect(() => {
    if (address && publicClient) {
      refreshBalance();
    }
  }, [address, publicClient, refreshBalance]);

  return {
    address,
    chainId,
    balance,
    isConnecting,
    walletClient,
    publicClient,
    logs,
    connect,
    disconnect,
    refreshBalance,
    switchChain,
    sendTransaction,
    signMessage,
    signTypedData,
    estimateGas,
    log,
    clearLogs,
  };
}
```

---

### `src/components/ConnectionStatus.tsx`

```typescript
import { type Address } from "viem";

interface Props {
  address: Address | null;
  chainId: number | null;
  balance: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onRefreshBalance: () => void;
}

export function ConnectionStatus({
  address,
  chainId,
  balance,
  isConnecting,
  onConnect,
  onRefreshBalance,
}: Props) {
  return (
    <div className="card">
      <h2>Connection Status</h2>
      <div className="status-grid">
        <div className="status-item">
          <span className="label">Status:</span>
          <span className={`badge ${address ? "connected" : "disconnected"}`}>
            {address ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="status-item">
          <span className="label">Account:</span>
          <code>
            {address
              ? `${address.slice(0, 6)}...${address.slice(-4)}`
              : "Not connected"}
          </code>
        </div>
        <div className="status-item">
          <span className="label">Chain ID:</span>
          <code>{chainId ?? "-"}</code>
        </div>
        <div className="status-item">
          <span className="label">Balance:</span>
          <code>{balance ? `${parseFloat(balance).toFixed(6)} ETH` : "-"}</code>
        </div>
      </div>
      <div className="button-row">
        <button onClick={onConnect} disabled={isConnecting || !!address}>
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
        <button
          onClick={onRefreshBalance}
          disabled={!address}
          className="secondary"
        >
          Refresh Balance
        </button>
      </div>
    </div>
  );
}
```

---

### `src/components/SendTransaction.tsx`

```typescript
import { useState } from "react";
import { type Address, type Hash, type Hex, isAddress } from "viem";

interface Props {
  isConnected: boolean;
  onSendTransaction: (to: Address, value: string, data?: Hex) => Promise<Hash>;
  onEstimateGas: (to: Address, value: string, data?: Hex) => Promise<bigint>;
}

export function SendTransaction({
  isConnected,
  onSendTransaction,
  onEstimateGas,
}: Props) {
  const [to, setTo] = useState("0x0000000000000000000000000000000000000000");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");
  const [result, setResult] = useState<{
    hash?: Hash;
    gas?: string;
    error?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!isAddress(to)) {
      setResult({ error: "Invalid address" });
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const hash = await onSendTransaction(to as Address, value, data as Hex);
      setResult({ hash });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEstimate = async () => {
    if (!isAddress(to)) {
      setResult({ error: "Invalid address" });
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const gas = await onEstimateGas(to as Address, value, data as Hex);
      setResult({ gas: gas.toString() });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Send Transaction</h2>
      <div className="form-group">
        <label>To Address:</label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x..."
        />
      </div>
      <div className="form-group">
        <label>Value (ETH):</label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.001"
        />
      </div>
      <div className="form-group">
        <label>Data (hex):</label>
        <input
          type="text"
          value={data}
          onChange={(e) => setData(e.target.value)}
          placeholder="0x"
        />
      </div>
      <div className="button-row">
        <button onClick={handleSend} disabled={!isConnected || isLoading}>
          {isLoading ? "Sending..." : "Send Transaction"}
        </button>
        <button
          onClick={handleEstimate}
          disabled={!isConnected || isLoading}
          className="secondary"
        >
          Estimate Gas
        </button>
      </div>
      {result && (
        <div className={`result ${result.error ? "error" : "success"}`}>
          {result.hash && (
            <p>
              TX Hash: <code>{result.hash}</code>
            </p>
          )}
          {result.gas && (
            <p>
              Estimated Gas: <code>{result.gas}</code>
            </p>
          )}
          {result.error && <p>Error: {result.error}</p>}
        </div>
      )}
    </div>
  );
}
```

---

### `src/components/SignMessage.tsx`

```typescript
import { useState } from "react";
import { type Hex } from "viem";

interface Props {
  isConnected: boolean;
  onSignMessage: (message: string) => Promise<Hex>;
}

export function SignMessage({ isConnected, onSignMessage }: Props) {
  const [message, setMessage] = useState("Hello, Wallet!");
  const [signature, setSignature] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSign = async () => {
    setIsLoading(true);
    setError(null);
    setSignature(null);
    try {
      const sig = await onSignMessage(message);
      setSignature(sig);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Sign Message</h2>
      <div className="form-group">
        <label>Message:</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message to sign..."
          rows={3}
        />
      </div>
      <div className="button-row">
        <button onClick={handleSign} disabled={!isConnected || isLoading}>
          {isLoading ? "Signing..." : "Sign Message"}
        </button>
      </div>
      {signature && (
        <div className="result success">
          <p>Signature:</p>
          <code className="break-all">{signature}</code>
        </div>
      )}
      {error && (
        <div className="result error">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
```

---

### `src/components/SignTypedData.tsx`

```typescript
import { useState } from "react";
import { type Hex } from "viem";

interface Props {
  isConnected: boolean;
  chainId: number | null;
  onSignTypedData: (typedData: any) => Promise<Hex>;
}

const getDefaultTypedData = (chainId: number) => ({
  domain: {
    name: "wallet Test",
    version: "1",
    chainId,
  },
  types: {
    Message: [
      { name: "content", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  primaryType: "Message" as const,
  message: {
    content: "Hello from wallet!",
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
  },
});

export function SignTypedData({
  isConnected,
  chainId,
  onSignTypedData,
}: Props) {
  const [typedDataJson, setTypedDataJson] = useState(() =>
    JSON.stringify(
      getDefaultTypedData(chainId || 8453),
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2
    )
  );
  const [signature, setSignature] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSign = async () => {
    setIsLoading(true);
    setError(null);
    setSignature(null);
    try {
      const parsed = JSON.parse(typedDataJson);
      // Convert timestamp back to bigint if needed
      if (parsed.message?.timestamp) {
        parsed.message.timestamp = BigInt(parsed.message.timestamp);
      }
      const sig = await onSignTypedData(parsed);
      setSignature(sig);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setTypedDataJson(
      JSON.stringify(
        getDefaultTypedData(chainId || 8453),
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )
    );
    setSignature(null);
    setError(null);
  };

  return (
    <div className="card">
      <h2>Sign Typed Data (EIP-712)</h2>
      <div className="form-group">
        <label>Typed Data JSON:</label>
        <textarea
          value={typedDataJson}
          onChange={(e) => setTypedDataJson(e.target.value)}
          rows={12}
          className="mono"
        />
      </div>
      <div className="button-row">
        <button onClick={handleSign} disabled={!isConnected || isLoading}>
          {isLoading ? "Signing..." : "Sign Typed Data"}
        </button>
        <button onClick={handleReset} className="secondary">
          Reset
        </button>
      </div>
      {signature && (
        <div className="result success">
          <p>Signature:</p>
          <code className="break-all">{signature}</code>
        </div>
      )}
      {error && (
        <div className="result error">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
```

---

### `src/components/ChainSwitcher.tsx`

```typescript
import { useState } from "react";
import { CHAINS } from "../hooks/useWallet";

interface Props {
  currentChainId: number | null;
  onSwitchChain: (chainId: number) => Promise<void>;
}

const CHAIN_LIST = [
  { id: 1, name: "Ethereum", color: "#627EEA" },
  { id: 8453, name: "Base", color: "#0052FF" },
  { id: 11155111, name: "Sepolia", color: "#CFB5F0" },
  { id: 42161, name: "Arbitrum", color: "#28A0F0" },
  { id: 10, name: "Optimism", color: "#FF0420" },
];

export function ChainSwitcher({ currentChainId, onSwitchChain }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSwitch = async (chainId: number) => {
    if (chainId === currentChainId) return;

    setIsLoading(true);
    setError(null);
    try {
      await onSwitchChain(chainId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Switch Chain</h2>
      <div className="chain-buttons">
        {CHAIN_LIST.map((chain) => (
          <button
            key={chain.id}
            onClick={() => handleSwitch(chain.id)}
            disabled={isLoading}
            className={currentChainId === chain.id ? "active" : ""}
            style={
              {
                "--chain-color": chain.color,
                borderColor:
                  currentChainId === chain.id ? chain.color : undefined,
              } as React.CSSProperties
            }
          >
            {chain.name}
            <span className="chain-id">({chain.id})</span>
          </button>
        ))}
      </div>
      {error && (
        <div className="result error">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
```

---

### `src/components/EventLog.tsx`

```typescript
import { type LogEntry } from "../hooks/useWallet";

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

export function EventLog({ logs, onClear }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Event Log</h2>
        <button onClick={onClear} className="secondary small">
          Clear
        </button>
      </div>
      <div className="log-container">
        {logs.length === 0 ? (
          <p className="empty">No events yet</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <span className="time">{log.timestamp.toLocaleTimeString()}</span>
              <span className="message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

### `src/App.tsx`

```typescript
import { useWallet } from "./hooks/useWallet";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { SendTransaction } from "./components/SendTransaction";
import { SignMessage } from "./components/SignMessage";
import { SignTypedData } from "./components/SignTypedData";
import { ChainSwitcher } from "./components/ChainSwitcher";
import { EventLog } from "./components/EventLog";
import "./App.css";

function App() {
  const {
    address,
    chainId,
    balance,
    isConnecting,
    logs,
    connect,
    refreshBalance,
    switchChain,
    sendTransaction,
    signMessage,
    signTypedData,
    estimateGas,
    clearLogs,
  } = useWallet();

  const isConnected = !!address;

  return (
    <div className="app">
      <header>
        <h1>Wallet Test dApp</h1>
      </header>

      <main>
        <ConnectionStatus
          address={address}
          chainId={chainId}
          balance={balance}
          isConnecting={isConnecting}
          onConnect={connect}
          onRefreshBalance={refreshBalance}
        />

        <SendTransaction
          isConnected={isConnected}
          onSendTransaction={sendTransaction}
          onEstimateGas={estimateGas}
        />

        <SignMessage isConnected={isConnected} onSignMessage={signMessage} />

        <SignTypedData
          isConnected={isConnected}
          chainId={chainId}
          onSignTypedData={signTypedData}
        />

        <ChainSwitcher currentChainId={chainId} onSwitchChain={switchChain} />

        <EventLog logs={logs} onClear={clearLogs} />
      </main>

      <footer>
        <p>Wallet Extension Test Tool</p>
      </footer>
    </div>
  );
}

export default App;
```

---

### `src/App.css`

```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f172a;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --accent: #7c3aed;
  --accent-hover: #6d28d9;
  --success: #10b981;
  --error: #ef4444;
  --border: #334155;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

header h1 {
  color: var(--accent);
  margin-bottom: 8px;
}

header p {
  color: var(--text-secondary);
}

footer {
  text-align: center;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 14px;
}

/* Card */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.card h2 {
  color: var(--accent);
  font-size: 18px;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h2 {
  margin-bottom: 0;
}

/* Status Grid */
.status-grid {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-item .label {
  color: var(--text-secondary);
  min-width: 80px;
}

.badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.badge.connected {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success);
}

.badge.disconnected {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error);
}

/* Forms */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 6px;
}

input,
textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.2s;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: var(--accent);
}

textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

textarea.mono {
  font-family: "Monaco", "Menlo", monospace;
  font-size: 12px;
}

code {
  font-family: "Monaco", "Menlo", monospace;
  font-size: 13px;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}

.break-all {
  word-break: break-all;
  display: block;
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  margin-top: 8px;
}

/* Buttons */
button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

button:hover:not(:disabled) {
  background: var(--accent-hover);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.secondary {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
}

button.secondary:hover:not(:disabled) {
  background: var(--border);
}

button.small {
  padding: 6px 12px;
  font-size: 12px;
}

.button-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* Chain Switcher */
.chain-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chain-buttons button {
  background: var(--bg-tertiary);
  border: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
}

.chain-buttons button:hover:not(:disabled) {
  border-color: var(--chain-color, var(--accent));
}

.chain-buttons button.active {
  border-color: var(--chain-color, var(--accent));
  background: rgba(124, 58, 237, 0.1);
}

.chain-id {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Results */
.result {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.result.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.result.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--error);
}

/* Event Log */
.log-container {
  background: var(--bg-tertiary);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 12px;
}

.log-container .empty {
  color: var(--text-secondary);
  text-align: center;
  padding: 20px;
}

.log-entry {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-family: "Monaco", "Menlo", monospace;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry .time {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.log-entry .message {
  word-break: break-word;
}

.log-entry.success .message {
  color: var(--success);
}

.log-entry.error .message {
  color: var(--error);
}

/* Responsive */
@media (max-width: 600px) {
  .app {
    padding: 16px;
  }

  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .button-row {
    flex-direction: column;
  }

  button {
    width: 100%;
  }
}
```

---

### `src/main.tsx`

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Testing Scenarios

### 1. Connection Flow

1. Click "Connect Wallet"
2. Approve in wallet popup
3. Verify address, chain ID, and balance display

### 2. Transaction Testing

1. Connect wallet
2. Enter test address and value
3. Click "Send Transaction"
4. Approve in wallet popup
5. Verify TX hash returned

### 3. Message Signing

1. Connect wallet
2. Enter message
3. Click "Sign Message"
4. Approve in wallet popup
5. Verify signature returned

### 4. Typed Data (EIP-712)

1. Connect wallet
2. Modify or use default typed data
3. Click "Sign Typed Data"
4. Approve in wallet popup
5. Verify signature returned

### 5. Chain Switching

1. Connect wallet
2. Click different chain buttons
3. Verify chain ID updates
4. Check Event Log for `chainChanged`

---

## Test Checklist

```
Connection:
[ ] Connect wallet shows popup
[ ] Account displays correctly
[ ] Chain ID displays correctly
[ ] Balance fetches correctly
[ ] Events logged on connect

Transactions:
[ ] Send TX opens popup
[ ] Approve returns hash
[ ] Reject shows error
[ ] Gas estimation works

Signing:
[ ] Personal sign works
[ ] Typed data sign works
[ ] Reject shows error

Chain Switching:
[ ] Switch updates UI
[ ] chainChanged event fires
[ ] Balance refreshes

Events:
[ ] accountsChanged logged
[ ] chainChanged logged
[ ] connect/disconnect logged
```
