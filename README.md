# Porto.sh - Complete Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Core Technology & Architecture](#core-technology--architecture)
3. [Account System (EIP-7702)](#account-system-eip-7702)
4. [Authentication (WebAuthn/Passkeys)](#authentication-webauthpasskeys)
5. [Porto Relay System](#porto-relay-system)
6. [JSON-RPC Methods](#json-rpc-methods)
7. [SDK Integration](#sdk-integration)
8. [Smart Contract Capabilities](#smart-contract-capabilities)
9. [Cross-Chain Support](#cross-chain-support)
10. [Security Model](#security-model)
11. [Technical Specifications](#technical-specifications)

---

## Overview

### What is Porto?

Porto is a next-generation authentication and payment system for Ethereum that eliminates:

- Passwords
- Browser extensions
- Seed phrases
- Manual key management

**Core Value Proposition:**

- Sign in with Face ID/Touch ID/Windows Hello
- Same account address across ALL chains
- No installation required
- Programmable accounts with advanced features
- Self-custody with biometric security

**Built By:** Ithaca team (creators of Foundry, Reth, Wagmi, Viem)

**License:** MIT / Apache-2.0 dual license

**Repository:** https://github.com/ithacaxyz/porto

**Documentation:** https://porto.sh

**Production RPC:** https://rpc.porto.sh

---

## Core Technology & Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                   User Application                       │
│              (Web App / dApp / Wallet)                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Porto SDK                             │
│  - TypeScript/JavaScript Library                         │
│  - EIP-1193 Compatible Provider                          │
│  - Wagmi Connector                                       │
│  - WebAuthn Integration                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Porto Relay (Rust)                      │
│  - JSON-RPC 2.0 Server                                   │
│  - Intent Builder & Simulator                            │
│  - Fee Estimation                                        │
│  - Transaction Submission                                │
│  - Multi-chain Orchestration                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Multiple Blockchains                        │
│  Ethereum | Base | Arbitrum | Optimism | Polygon        │
│  BNB Chain | Celo | and more...                          │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **Porto SDK** - Frontend TypeScript library
2. **Porto Relay** - Backend Rust service
3. **Smart Contracts** - EIP-7702 account contracts
4. **WebAuthn Integration** - Biometric authentication
5. **id.porto.sh** - Authentication iframe/dialog

---

## Account System (EIP-7702)

### What is EIP-7702?

EIP-7702 (Set EOA Account Code) allows Externally Owned Accounts (EOAs) to temporarily act as smart contracts during a transaction.

**Key Benefits:**

- Batch multiple transactions atomically
- Gas sponsorship (pay fees in any token)
- Session keys (delegated permissions)
- Access control policies
- Multi-signature support

### Porto's Account Creation Process

**Traditional Approach (REJECTED by Porto):**

- Used PREP (Predictable Resource Exhaustion Protection)
- Complex cross-chain deployment
- Chicken-egg problem with passkey naming

**Porto's Current Approach (IMPLEMENTED):**

1. **Generate Ephemeral Private Key**

   - Created on sign-up
   - Exists only in iframe context
   - Never exposed to application

2. **Sign EIP-7702 Authorization**

   - Uses chainid=0 (universal, cross-chain replayable)
   - Designates account contract code
   - Enables smart account features

3. **Sign Passkey Addition**

   - Modified EIP-712 signature (cross-chain compatible)
   - Adds WebAuthn credential as account owner
   - Binds biometric to account

4. **Optional: Sign Session Key Creation**

   - If application needs delegated permissions
   - Signs in same flow (1-click everything)

5. **Forget Ephemeral Key**
   - Private key immediately discarded
   - Only passkey remains as authentication
   - Account exists on-chain

**Result:**

- Same address on every chain
- No frontrunning vulnerability
- Instant cross-chain availability
- Secure (ephemeral key never stored)

### Account Features

**Batch Transactions:**

```javascript
// Execute multiple operations atomically
await wallet.sendCalls([
  { to: tokenAddress, data: approveCalldata },
  { to: swapAddress, data: swapCalldata },
  { to: nftAddress, data: mintCalldata },
]);
```

**Gas Sponsorship:**

- Pay fees in USDC, USDT, or any supported token
- No need for native chain token (ETH, etc.)
- Paymaster handles gas payment

**Session Keys:**

- Delegate specific permissions to applications
- Time-limited and amount-limited
- Revocable at any time

**Access Control:**

- Whitelist specific contracts
- Whitelist specific functions
- Whitelist specific parameters

---

## Authentication (WebAuthn/Passkeys)

### WebAuthn Technology

**What is WebAuthn?**

- W3C and FIDO Alliance specification
- Uses public-key cryptography
- No shared secrets (no passwords)
- Phishing-resistant

**How Porto Uses WebAuthn:**

1. **Registration (Account Creation):**

   ```javascript
   // Browser calls WebAuthn API
   navigator.credentials.create({
     publicKey: {
       challenge: randomChallenge,
       rp: { name: "Porto", id: "porto.sh" },
       user: {
         id: userHandle,
         name: userIdentifier,
         displayName: displayName,
       },
       pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
       authenticatorSelection: {
         authenticatorAttachment: "platform",
         userVerification: "required",
       },
     },
   });
   ```

2. **Authentication (Signing):**
   ```javascript
   // Browser calls WebAuthn API for signing
   navigator.credentials.get({
     publicKey: {
       challenge: transactionHash,
       rpId: "porto.sh",
       allowCredentials: [{ id: credentialId, type: "public-key" }],
       userVerification: "required",
     },
   });
   ```

### Passkey Types

**Platform Authenticators (Built-in):**

- Touch ID (macOS, iOS)
- Face ID (iOS, iPadOS)
- Windows Hello (Windows)
- Android Biometric (Android)

**Synced Passkeys (Multi-device):**

- iCloud Keychain (Apple ecosystem)
- Google Password Manager (Google ecosystem)
- 1Password
- Bitwarden

**Benefits:**

- User creates passkey once
- Automatically syncs to all devices
- Same account accessible everywhere
- End-to-end encrypted in cloud

### Supported Platforms

**Browsers:**

- Safari
- Chrome
- Firefox
- Brave

**Operating Systems:**

- iOS
- iPadOS
- macOS
- Android
- Linux
- Windows

**Password Managers:**

- iCloud Keychain
- Google Password Manager
- 1Password
- Bitwarden

---

## Porto Relay System

### Overview

The Porto Relay is a production-grade Rust service that:

- Builds and simulates transactions
- Estimates fees
- Quotes fee prices
- Submits transactions to blockchains
- Manages cross-chain operations

**Production Endpoint:** https://rpc.porto.sh

**Local Development:** http://localhost:9200

### Relay Architecture

```
┌────────────────────────────────────────────────┐
│              Porto Relay (Rust)                 │
│                                                 │
│  ┌──────────────────────────────────────────┐ │
│  │       Intent Builder                      │ │
│  │  - Parses user calls                      │ │
│  │  - Builds EIP-7702 intent                 │ │
│  │  - Adds fee payment logic                 │ │
│  └──────────────────────────────────────────┘ │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐ │
│  │       Simulator                           │ │
│  │  - Simulates transaction execution        │ │
│  │  - Estimates gas usage                    │ │
│  │  - Validates operations                   │ │
│  └──────────────────────────────────────────┘ │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐ │
│  │       Fee Quoter                          │ │
│  │  - Calculates total fees                  │ │
│  │  - Converts to user's preferred token     │ │
│  │  - Signs quote with expiry                │ │
│  └──────────────────────────────────────────┘ │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐ │
│  │       Transaction Submitter               │ │
│  │  - Validates signed intent                │ │
│  │  - Validates quote not expired            │ │
│  │  - Submits to blockchain                  │ │
│  │  - Returns transaction ID                 │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Intent Execution Flow

**Step 1: Prepare Calls**

```javascript
// Application requests preparation
const prepared = await provider.request({
  method: "wallet_prepareCalls",
  params: [
    {
      calls: [{ to: "0x...", data: "0x...", value: "0x0" }],
      chainId: "0x1", // Ethereum
      capabilities: {
        paymasterService: {
          url: "https://paymaster.example.com",
        },
      },
    },
  ],
});

// Returns:
// {
//   digest: '0xabc...', // Hash to sign
//   context: {...},     // Relay-specific data
//   capabilities: {...},
//   chainId: '0x1',
//   version: '1.0'
// }
```

**Step 2: Sign Intent**

```javascript
// User signs with WebAuthn
const signature = await signWithPasskey(prepared.digest);
```

**Step 3: Send Prepared Calls**

```javascript
// Submit signed intent to Relay
const result = await provider.request({
  method: "wallet_sendPreparedCalls",
  params: [
    {
      ...prepared,
      signature: signature,
    },
  ],
});

// Returns:
// { id: '0xdef...' } // Intent identifier
```

**Step 4: Check Status**

```javascript
// Poll for transaction status
const status = await provider.request({
  method: "wallet_getCallsStatus",
  params: [result.id],
});

// Returns:
// {
//   status: 'CONFIRMED',
//   receipts: [{
//     logs: [...],
//     status: '0x1',
//     transactionHash: '0x...'
//   }]
// }
```

### Quote System

**Purpose:** Prevent MEV and ensure fee stability

**How it works:**

1. Relay simulates transaction and estimates fees
2. Relay signs a quote with current fee price
3. Quote includes expiration timestamp (typically 30-60 seconds)
4. User signs intent referencing the quote
5. Relay validates quote hasn't expired before submission
6. If expired, user must request new quote

**Quote Structure:**

```javascript
{
  feeAmount: '1000000000000000', // wei
  feeToken: '0x...', // USDC address
  expiresAt: 1735689600, // Unix timestamp
  signature: '0x...', // Relay's signature
  nonce: '12345'
}
```

### Running Relay Locally

**Using Docker:**

```bash
# Pull and run Relay
curl -sSL s.porto.sh/docker | docker compose -f - up -d

# Relay available at:
# http://localhost:9200

# Test with cast:
cast rpc --rpc-url http://localhost:9200 wallet_getCapabilities "[31337]"
```

**Using OrbStack:**

```bash
# If OrbStack installed:
# https://relay.local
```

---

## JSON-RPC Methods

### Standard Ethereum Methods

Porto implements standard EIP-1193 methods:

**eth_requestAccounts**

```javascript
// Request user's accounts
const accounts = await provider.request({
  method: "eth_requestAccounts",
});
// Returns: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb']
```

**eth_sendTransaction**

```javascript
// Send standard transaction
const hash = await provider.request({
  method: "eth_sendTransaction",
  params: [
    {
      from: "0x...",
      to: "0x...",
      value: "0x0",
      data: "0x...",
    },
  ],
});
```

**eth_sign, eth_signTypedData_v4**

- Standard signing methods
- Trigger WebAuthn authentication

### Porto-Specific Methods

**wallet_connect**

```javascript
// Connect and authenticate user
const result = await provider.request({
  method: "wallet_connect",
});
// Returns: { accounts: ['0x...'], chainId: '0x1' }
```

**wallet_getCapabilities**

```javascript
// Get supported chains and features
const capabilities = await provider.request({
  method: "wallet_getCapabilities",
  params: [chainIds], // Optional filter
});

// Returns:
// {
//   "8453": { // Base
//     "feeTokens": ["ETH", "USDC", "USDT"],
//     "interopTokens": ["ETH", "USDC", "USDT"],
//     "paymasterService": true
//   }
// }
```

**wallet_prepareUpgradeAccount**

```javascript
// Prepare EOA upgrade to EIP-7702 account
const prepared = await provider.request({
  method: "wallet_prepareUpgradeAccount",
  params: [
    {
      address: "0x...",
      chainId: "0x1",
    },
  ],
});
```

**wallet_upgradeAccount**

```javascript
// Execute account upgrade on-chain
const result = await provider.request({
  method: "wallet_upgradeAccount",
  params: [preparedUpgrade],
});
```

**wallet_getKeys**

```javascript
// Get all keys attached to account
const keys = await provider.request({
  method: "wallet_getKeys",
  params: ["0x..."], // account address
});

// Returns:
// [
//   {
//     type: 'webauthn-p256',
//     publicKey: '0x...',
//     addedAt: 1735689600
//   }
// ]
```

**wallet_prepareCalls**

```javascript
// Prepare call bundle for signing
const prepared = await provider.request({
  method: "wallet_prepareCalls",
  params: [
    {
      calls: [{ to: "0x...", data: "0x...", value: "0x0" }],
      chainId: "0x1",
      capabilities: {
        paymasterService: { url: "https://..." },
      },
      key: {
        type: "p256",
        publicKey: "0x...",
        prehash: false,
      },
      version: "1.0",
    },
  ],
});

// Returns: { digest, context, capabilities, chainId, version }
```

**wallet_sendPreparedCalls**

```javascript
// Submit signed call bundle
const result = await provider.request({
  method: "wallet_sendPreparedCalls",
  params: [
    {
      ...prepared,
      signature: "0x...",
    },
  ],
});

// Returns: { id: '0x...' } // Intent ID
```

**wallet_getCallsStatus**

```javascript
// Get status of submitted intent
const status = await provider.request({
  method: "wallet_getCallsStatus",
  params: ["0x..."], // intent ID
});

// Returns:
// {
//   status: 'CONFIRMED' | 'PENDING' | 'FAILED',
//   receipts: [
//     {
//       transactionHash: '0x...',
//       status: '0x1',
//       logs: [...]
//     }
//   ]
// }
```

**wallet_sendCalls (EIP-5792)**

```javascript
// Submit calls to be signed in wallet UI
const bundleId = await provider.request({
  method: "wallet_sendCalls",
  params: [
    {
      version: "1.0",
      chainId: "0x1",
      from: "0x...",
      calls: [{ to: "0x...", data: "0x...", value: "0x0" }],
    },
  ],
});
```

### Experimental Methods

**experimental_connect**

```javascript
// Connect end-user to application
const result = await provider.request({
  method: "experimental_connect",
});
```

**experimental_createAccount**

```javascript
// Create new account with passkey
const account = await provider.request({
  method: "experimental_createAccount",
  params: [
    {
      displayName: "My Porto Account",
    },
  ],
});
```

**experimental_grantPermissions**

```javascript
// Grant permissions to a key
await provider.request({
  method: "experimental_grantPermissions",
  params: [
    {
      address: "0x...",
      chainId: "0x1",
      expiry: 1735689600,
      key: {
        type: "secp256k1",
        publicKey: "0x...",
      },
      permissions: {
        calls: [
          {
            to: "0x...", // Authorized contract
            signature: "transfer(address,uint256)", // Allowed function
          },
        ],
        spend: {
          limit: "0x16345785D8A0000", // 0.1 ETH
          period: 3600, // Per hour
        },
      },
    },
  ],
});
```

**experimental_sessions**

```javascript
// List active sessions
const sessions = await provider.request({
  method: "experimental_sessions",
});
```

---

## SDK Integration

### Installation

```bash
npm install porto
```

### Basic Setup (Vanilla JS)

```javascript
import { Porto } from "porto";

// Initialize Porto
const porto = Porto.create();

// Use provider
const accounts = await porto.provider.request({
  method: "wallet_connect",
});

console.log("Connected:", accounts);
```

### Wagmi Integration (Recommended)

```javascript
import { createConfig, http } from "wagmi";
import { mainnet, base, arbitrum } from "wagmi/chains";
import { porto } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet, base, arbitrum],
  connectors: [porto()],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
  },
});
```

**Using with React:**

```javascript
import { useConnect, useAccount, useSendTransaction } from 'wagmi'

function MyApp() {
  const { connect, connectors } = useConnect()
  const { address, isConnected } = useAccount()
  const { sendTransaction } = useSendTransaction()

  return (
    <div>
      {!isConnected ? (
        <button onClick={() => connect({ connector: connectors[0] })}>
          Connect with Porto
        </button>
      ) : (
        <div>
          <p>Connected: {address}</p>
          <button onClick={() => sendTransaction({...})}>
            Send Transaction
          </button>
        </div>
      )}
    </div>
  )
}
```

### EIP-6963 Integration

For wallet connection libraries (Privy, RainbowKit, ConnectKit, etc.):

```javascript
import { Porto } from "porto";

// Porto auto-injects via EIP-6963
const porto = Porto.create();

// Now any EIP-6963 compatible library will detect Porto
// No additional configuration needed
```

### HTTPS Requirement

Porto requires HTTPS because WebAuthn doesn't work on insecure origins.

**Vite:**

```bash
npm install vite-plugin-mkcert
```

```javascript
// vite.config.js
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [mkcert()],
});
```

**Next.js:**

```bash
next dev --experimental-https
```

**Caddy (Reverse Proxy):**

```
# Caddyfile
example.localhost {
  reverse_proxy localhost:5713
}
```

```bash
caddy run
# Visit: https://example.localhost
```

---

## Smart Contract Capabilities

### Account Contract Features

**1. Batch Call Execution**

```solidity
struct Call {
    address to;
    uint256 value;
    bytes data;
}

function execute(Call[] calldata calls) external;
```

**2. Gas Sponsorship**

- Contract accepts fee payment in any ERC-20 token
- Paymaster pays native gas
- User's token transferred to paymaster

**3. Access Control**

```solidity
struct AccessPolicy {
    address[] allowedContracts;
    bytes4[] allowedSelectors;
    bool requiresMultiSig;
}
```

**4. Session Keys**

```solidity
struct SessionKey {
    address key;
    uint256 spendLimit;
    uint256 period;
    uint256 expiresAt;
    AccessPolicy policy;
}
```

**5. Multi-signature Support**

```solidity
function executeWithSignatures(
    Call[] calldata calls,
    bytes[] calldata signatures
) external;
```

### Gas Benchmarks

Porto accounts are optimized for gas efficiency:

| Operation        | Porto Account | Leading ERC-4337 | Savings |
| ---------------- | ------------- | ---------------- | ------- |
| Account Creation | ~50k gas      | ~250k gas        | 80%     |
| Simple Transfer  | ~55k gas      | ~120k gas        | 54%     |
| Token Swap       | ~180k gas     | ~320k gas        | 44%     |
| Batch (3 calls)  | ~200k gas     | ~400k gas        | 50%     |

Performance is 30-71% better than ERC-4337 alternatives.

### Security Audit

Contracts audited by:

- @MiloTruck
- @rholterhus
- @kadenzipfel

Active bug bounty program available.

---

## Cross-Chain Support

### Supported Networks

**Mainnet:**

- Ethereum (Chain ID: 1)
- Base (Chain ID: 8453)
- Optimism (Chain ID: 10)
- Arbitrum (Chain ID: 42161)
- Polygon (Chain ID: 137)
- BNB Chain (Chain ID: 56)
- Celo (Chain ID: 42220)
- Katana (Chain ID: 747474)

**Testnet:**

- Base Sepolia (Chain ID: 84532)
- Optimism Sepolia (Chain ID: 11155420)
- Arbitrum Sepolia (Chain ID: 421614)

### Fee Token Support by Chain

| Network   | Fee Tokens       | Interop Tokens  |
| --------- | ---------------- | --------------- |
| Ethereum  | ETH, USDC, USDT  | ETH, USDC, USDT |
| Base      | ETH, USDC, USDT  | ETH, USDC, USDT |
| Optimism  | ETH, USDC, USDT  | ETH, USDC, USDT |
| Arbitrum  | ETH, USDC, USDT  | ETH, USDC, USDT |
| Polygon   | POL, USDC, USDT  | USDC, USDT      |
| Celo      | CELO, USDC, USDT | USDC, USDT      |
| BNB Chain | BNB, USDT        | No              |
| Katana    | ETH              | No              |

**Fee Tokens:** Tokens accepted to pay execution fees on that chain
**Interop Tokens:** Cross-chain supported tokens

### Same Address Everywhere

Because Porto uses EIP-7702 with chainid=0:

- Account has identical address on all chains
- No deployment needed per chain
- Instant availability everywhere
- No frontrunning across chains

### Cross-Chain Interoperability

Porto supports native cross-chain operations:

- Move assets between chains without bridges
- Execute transactions on multiple chains from single signature
- Unified balance across all chains

---

## Security Model

### Key Security Features

**1. No Seed Phrases**

- Eliminates primary attack vector
- No single point of failure
- Nothing to phish or steal

**2. WebAuthn Security**

- Hardware-backed keys (Secure Enclave, TPM)
- Biometric authentication
- Phishing-resistant by design
- Cannot be remotely compromised

**3. Ephemeral Key Approach**

- Account setup key exists < 1 second
- Never stored anywhere
- Impossible to steal post-creation
- Only passkey remains

**4. Iframe Isolation**

- Authentication happens in id.porto.sh iframe
- Malicious apps cannot access credentials
- CSP protection
- Origin isolation

**5. Session Key Limits**

- Time-bounded permissions
- Amount-bounded permissions
- Contract-bounded permissions
- Revocable at any time

**6. Quote System**

- Prevents MEV attacks
- Fee protection
- Time-limited validity
- Relay signature verification

### Content Security Policy

Required CSP directives:

```
connect-src https://rpc.porto.sh
frame-src https://id.porto.sh
```

### Browser Support & Limitations

**Works:**

- Modern browsers (Chrome, Safari, Firefox, Brave)
- HTTPS origins
- Desktop and mobile

**Doesn't Work:**

- HTTP origins (insecure)
- Very old browsers
- Environments without WebAuthn support

### Recovery Mechanisms

**Current:**

- Passkey synced via cloud (iCloud, Google, etc.)
- Multiple devices automatically have access
- Add multiple passkeys to same account

**Coming Soon:**

- Email-based recovery
- Social recovery options
- Guardian recovery

---

## Technical Specifications

### Cryptographic Algorithms

**WebAuthn Signatures:**

- ES256 (ECDSA with P-256 curve and SHA-256)
- RS256 (RSA with SHA-256) - optional

**Ethereum Signatures:**

- secp256k1 (standard Ethereum)
- P-256 (WebAuthn native)

**EIP-712 Structured Data Hashing:**

- Used for cross-chain replayable signatures
- Modified for Porto's needs

### Transaction Format

**EIP-7702 Transaction Type: 0x04**

Structure:

```
{
  type: 0x04,
  chainId: 0,
  nonce: ...,
  gasLimit: ...,
  maxFeePerGas: ...,
  maxPriorityFeePerGas: ...,
  to: accountAddress,
  value: 0,
  data: encodedCalls,
  accessList: [],
  authorizationList: [{
    chainId: 0,
    address: contractAddress,
    nonce: ...,
    v: ..., r: ..., s: ...
  }]
}
```

### Network Requirements

**Bandwidth:**

- Minimal (standard JSON-RPC)
- WebAuthn ceremony: ~1-5 KB
- Transaction submission: ~0.5-2 KB

**Latency:**

- WebAuthn: 100-500ms (biometric scan)
- Intent preparation: 200-500ms (simulation)
- Transaction confirmation: Chain-dependent (2s - 15s)

**Performance:**

- Up to 71% faster than ERC-4337
- Lower gas costs
- Fewer on-chain operations

### Rate Limits

Porto Relay rate limits (production):

- wallet_prepareCalls: 100 requests/hour per key
- wallet_sendPreparedCalls: Unlimited (with valid quote)
- wallet_getCallsStatus: Unlimited
- wallet_getCapabilities: Unlimited

### Version History

**Current Version:** 1.0

**Changelog:**

- v1.0 - Initial production release
- PREP approach deprecated
- Ephemeral key approach implemented
- EIP-7702 support
- Multi-chain launch

---

## Additional Resources

### Links

- **Website:** https://porto.sh
- **GitHub:** https://github.com/ithacaxyz/porto
- **NPM:** https://www.npmjs.com/package/porto
- **Documentation:** https://porto.sh/sdk
- **Relay Docs:** https://porto.sh/relay
- **Telegram:** @porto_devs
- **Twitter:** @ithacaxyz

### Community

- Report issues: https://github.com/ithacaxyz/porto/issues
- Feature requests: GitHub Discussions
- Developer chat: Telegram @porto_devs

### Related Technologies

- **EIP-7702:** Set EOA Account Code
- **EIP-1193:** Ethereum Provider API
- **EIP-6963:** Multi-Injected Provider Discovery
- **EIP-5792:** Wallet Call API
- **EIP-7836:** Wallet Call Preparation API (Draft)
- **WebAuthn:** W3C Web Authentication API
- **FIDO2:** Fast Identity Online 2.0

---

## Conclusion

Porto represents a paradigm shift in Web3 user experience:

**Traditional Wallets:**

- Install extension
- Create password
- Write down 12 words
- Store securely forever
- Enter password every time
- Switch networks manually
- Need native token for gas

**Porto:**

- No installation (or minimal)
- No password
- No seed phrase
- Biometric authentication
- Automatic cross-chain
- Pay gas in any token

Porto makes blockchain interactions as seamless as using any modern web application, while maintaining self-custody and security. This is the future of Web3 UX.

---

_Last Updated: November 2024_
_Porto Version: 1.0_
_Documentation Version: 1.0_
