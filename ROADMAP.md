# Porto Browser Extension Wallet - Development Roadmap

## Project Overview

**Goal:** Build a next-generation browser wallet extension that uses Porto's WebAuthn technology to eliminate passwords and seed phrases, while maintaining compatibility with all existing dApps (Uniswap, OpenSea, etc.).

**Key Features:**

- Browser extension (Chrome, Firefox, Brave)
- WebAuthn/Passkey authentication (Face ID, Touch ID, Windows Hello)
- No passwords, no seed phrases
- Injects into websites like MetaMask
- Compatible with all dApps
- Multi-chain support
- Self-custody with biometric security

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Technology Stack](#technology-stack)
3. [Phase 0: Planning & Setup](#phase-0-planning--setup)
4. [Phase 1: Core Extension Infrastructure](#phase-1-core-extension-infrastructure)
5. [Phase 2: Porto Integration & WebAuthn](#phase-2-porto-integration--webauthn)
6. [Phase 3: Provider Injection & dApp Communication](#phase-3-provider-injection--dapp-communication)
7. [Phase 4: Transaction Management](#phase-4-transaction-management)
8. [Phase 5: User Interface](#phase-5-user-interface)
9. [Phase 6: Multi-Chain Support](#phase-6-multi-chain-support)
10. [Phase 7: Advanced Features](#phase-7-advanced-features)
11. [Phase 8: Security Audit & Testing](#phase-8-security-audit--testing)
12. [Phase 9: Distribution & Launch](#phase-9-distribution--launch)
13. [Technical Challenges & Solutions](#technical-challenges--solutions)

---

## Project Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER EXTENSION                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │  CONTENT SCRIPT (Injected into every page)         │   │
│  │  - Detects dApp connection requests                 │   │
│  │  - Injects provider (window.ethereum or EIP-6963)  │   │
│  │  - Forwards requests to background                  │   │
│  └────────────────────────────────────────────────────┘   │
│                         ↕                                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │  BACKGROUND SCRIPT (Service Worker)                 │   │
│  │  - Porto SDK integration                            │   │
│  │  - Account management                               │   │
│  │  - Transaction signing                              │   │
│  │  - Porto Relay communication                        │   │
│  │  - State management                                 │   │
│  └────────────────────────────────────────────────────┘   │
│                         ↕                                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │  POPUP UI (Extension popup interface)              │   │
│  │  - Portfolio view                                   │   │
│  │  - Transaction approval                             │   │
│  │  - Settings                                         │   │
│  │  - Account management                               │   │
│  └────────────────────────────────────────────────────┘   │
│                         ↕                                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │  OFFSCREEN DOCUMENT (For WebAuthn)                  │   │
│  │  - WebAuthn ceremonies                              │   │
│  │  - Passkey creation/authentication                  │   │
│  │  - Isolated context for security                    │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    PORTO RELAY                               │
│                  (https://rpc.porto.sh)                      │
│  - Intent building & simulation                              │
│  - Fee estimation & quotes                                   │
│  - Transaction submission                                    │
│  - Multi-chain orchestration                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    BLOCKCHAINS                               │
│  Ethereum | Base | Arbitrum | Optimism | Polygon | etc.     │
└─────────────────────────────────────────────────────────────┘
```

### Component Communication Flow

```
User clicks "Connect Wallet" on Uniswap
         ↓
Content Script detects connection request
         ↓
Content Script forwards to Background Script
         ↓
Background Script checks if user is authenticated
         ↓
If not authenticated → Open Offscreen Document for WebAuthn
         ↓
User scans fingerprint/face
         ↓
Porto SDK creates/connects account
         ↓
Background Script stores account state
         ↓
Background Script sends account to Content Script
         ↓
Content Script informs Uniswap: Connected!
         ↓
User initiates swap on Uniswap
         ↓
Uniswap calls eth_sendTransaction
         ↓
Content Script forwards to Background Script
         ↓
Background Script opens Popup for approval
         ↓
User sees transaction details in Popup
         ↓
User confirms → WebAuthn signature requested
         ↓
Porto Relay prepares calls, returns digest
         ↓
WebAuthn signs digest
         ↓
Porto Relay submits transaction
         ↓
Transaction confirmed on blockchain
         ↓
Background Script updates state
         ↓
Popup shows success
         ↓
Content Script notifies Uniswap: Transaction sent!
```

---

## Technology Stack

### Core Technologies

**Extension Framework:**

- Manifest V3 (latest Chrome extension standard)
- TypeScript (type safety)
- Webpack or Vite (bundling)

**Blockchain Integration:**

- Porto SDK (@porto/sdk)
- Viem (Ethereum interactions)
- Wagmi (optional, for some utilities)

**UI Framework:**

- React 18+ (popup interface)
- TailwindCSS (styling)
- Zustand or Redux (state management)
- React Query (data fetching)

**Storage:**

- chrome.storage.local (persistent data)
- chrome.storage.session (temporary data)
- IndexedDB (large data, transaction history)

**Build Tools:**

- TypeScript 5+
- Webpack 5 or Vite 5
- ESLint + Prettier
- Chrome Extension CLI tools

### Dependencies

```json
{
  "dependencies": {
    "porto": "^1.0.0",
    "viem": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "@tanstack/react-query": "^5.0.0",
    "webextension-polyfill": "^0.10.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "webpack": "^5.88.0",
    "@types/chrome": "^0.0.248",
    "@types/react": "^18.2.0",
    "tailwindcss": "^3.3.0"
  }
}
```

---

## Phase 0: Planning & Setup

**Duration:** 1-2 weeks

### Objectives

- Define project scope and requirements
- Set up development environment
- Create project structure
- Establish development workflow

### Tasks

#### 0.1 Requirements Definition

**Functional Requirements:**

- [ ] User authentication with WebAuthn (Face ID, Touch ID)
- [ ] Account creation without seed phrases
- [ ] Connection to dApps (Uniswap, OpenSea, etc.)
- [ ] Transaction signing and submission
- [ ] Multi-chain support (Ethereum, Base, Arbitrum, etc.)
- [ ] Portfolio view (balances, tokens, NFTs)
- [ ] Transaction history
- [ ] Settings management

**Non-Functional Requirements:**

- [ ] Security: Hardware-backed key storage, WebAuthn
- [ ] Performance: Fast transaction signing (<2s)
- [ ] Compatibility: Chrome, Firefox, Brave
- [ ] UX: Intuitive, modern interface
- [ ] Reliability: 99.9% uptime for core features

#### 0.2 Development Environment Setup

```bash
# Create project
mkdir porto-wallet-extension
cd porto-wallet-extension

# Initialize git
git init
git remote add origin <your-repo-url>

# Initialize npm
npm init -y

# Install core dependencies
npm install porto viem react react-dom zustand
npm install -D typescript webpack webpack-cli @types/chrome @types/react

# Create directory structure
mkdir -p src/{background,content,popup,offscreen,utils,types}
mkdir -p public/{icons,html}
```

#### 0.3 Project Structure

```
porto-wallet-extension/
├── src/
│   ├── background/
│   │   ├── index.ts              # Background service worker entry
│   │   ├── portoService.ts       # Porto SDK integration
│   │   ├── accountManager.ts     # Account state management
│   │   ├── transactionManager.ts # Transaction handling
│   │   └── messageHandler.ts     # Message routing
│   ├── content/
│   │   ├── index.ts              # Content script entry
│   │   ├── providerInjection.ts  # Inject Ethereum provider
│   │   └── dappBridge.ts         # Bridge between dApp and extension
│   ├── popup/
│   │   ├── index.tsx             # Popup React app entry
│   │   ├── App.tsx               # Main popup component
│   │   ├── pages/                # Popup pages
│   │   │   ├── Home.tsx
│   │   │   ├── Send.tsx
│   │   │   ├── Receive.tsx
│   │   │   └── Settings.tsx
│   │   └── components/           # Reusable UI components
│   ├── offscreen/
│   │   ├── index.html            # Offscreen document HTML
│   │   └── webauthn.ts           # WebAuthn ceremonies
│   ├── utils/
│   │   ├── storage.ts            # Chrome storage helpers
│   │   ├── crypto.ts             # Cryptographic utilities
│   │   └── constants.ts          # App constants
│   └── types/
│       ├── messages.ts           # Message type definitions
│       └── account.ts            # Account type definitions
├── public/
│   ├── manifest.json             # Extension manifest
│   ├── icons/                    # Extension icons
│   └── html/                     # HTML files
├── webpack.config.js             # Webpack configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # NPM configuration
```

#### 0.4 Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Porto Wallet",
  "version": "0.1.0",
  "description": "Next-gen crypto wallet with biometric authentication",

  "permissions": ["storage", "activeTab", "offscreen"],

  "host_permissions": ["https://rpc.porto.sh/*", "https://id.porto.sh/*"],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://rpc.porto.sh https://id.porto.sh"
  }
}
```

#### 0.5 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "outDir": "./dist",
    "types": ["chrome", "node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 0.6 Development Workflow Setup

```bash
# Development script
npm run dev      # Build in watch mode
npm run build    # Production build
npm run test     # Run tests
npm run lint     # Lint code
```

**Deliverables:**

- ✅ Project repository initialized
- ✅ Development environment configured
- ✅ Project structure created
- ✅ Build system operational
- ✅ Initial manifest configured

---

## Phase 1: Core Extension Infrastructure

**Duration:** 2-3 weeks

### Objectives

- Implement basic extension structure
- Set up message passing between components
- Create storage management system
- Build state management

### Tasks

#### 1.1 Background Service Worker

**File: src/background/index.ts**

```typescript
// Extension lifecycle management
// Message routing
// Porto SDK initialization
// State persistence

import { PortoService } from "./portoService";
import { MessageHandler } from "./messageHandler";
import { StorageManager } from "../utils/storage";

class BackgroundService {
  private portoService: PortoService;
  private messageHandler: MessageHandler;
  private storageManager: StorageManager;

  constructor() {
    this.portoService = new PortoService();
    this.messageHandler = new MessageHandler(this.portoService);
    this.storageManager = new StorageManager();
  }

  async initialize() {
    // Load persisted state
    await this.loadState();

    // Set up message listeners
    this.setupMessageListeners();

    // Initialize Porto if user previously authenticated
    if (await this.storageManager.hasAccount()) {
      await this.portoService.initialize();
    }
  }

  private setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.messageHandler.handle(message, sender).then(sendResponse);
      return true; // Async response
    });
  }

  private async loadState() {
    // Load account, settings, etc.
  }
}

const background = new BackgroundService();
background.initialize();
```

#### 1.2 Message Passing System

**File: src/types/messages.ts**

```typescript
// Define all message types for communication

export enum MessageType {
  // Authentication
  CREATE_ACCOUNT = "CREATE_ACCOUNT",
  CONNECT_ACCOUNT = "CONNECT_ACCOUNT",
  DISCONNECT_ACCOUNT = "DISCONNECT_ACCOUNT",

  // dApp Communication
  ETH_REQUEST_ACCOUNTS = "ETH_REQUEST_ACCOUNTS",
  ETH_SEND_TRANSACTION = "ETH_SEND_TRANSACTION",
  ETH_SIGN = "ETH_SIGN",
  ETH_SIGN_TYPED_DATA = "ETH_SIGN_TYPED_DATA",

  // Internal
  GET_STATE = "GET_STATE",
  UPDATE_STATE = "UPDATE_STATE",
  OPEN_POPUP = "OPEN_POPUP",
}

export interface Message {
  type: MessageType;
  payload?: any;
  requestId?: string;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId?: string;
}
```

**File: src/background/messageHandler.ts**

```typescript
import { Message, MessageResponse, MessageType } from "../types/messages";
import { PortoService } from "./portoService";

export class MessageHandler {
  constructor(private portoService: PortoService) {}

  async handle(
    message: Message,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    try {
      switch (message.type) {
        case MessageType.CREATE_ACCOUNT:
          return await this.handleCreateAccount(message.payload);

        case MessageType.ETH_REQUEST_ACCOUNTS:
          return await this.handleRequestAccounts(sender);

        case MessageType.ETH_SEND_TRANSACTION:
          return await this.handleSendTransaction(message.payload, sender);

        // ... more handlers

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requestId: message.requestId,
      };
    }
  }

  private async handleCreateAccount(payload: any): Promise<MessageResponse> {
    const account = await this.portoService.createAccount(payload);
    return { success: true, data: account };
  }

  private async handleRequestAccounts(
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    // Check if dApp is already connected
    // If not, request user approval
    // Return accounts
  }

  private async handleSendTransaction(
    payload: any,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    // Open popup for transaction approval
    // Wait for user confirmation
    // Sign and submit transaction
  }
}
```

#### 1.3 Storage Management

**File: src/utils/storage.ts**

```typescript
// Wrapper for chrome.storage with TypeScript types

export interface StorageData {
  account?: {
    address: string;
    credentialId: string;
    publicKey: string;
  };
  connectedDapps?: {
    [origin: string]: {
      connected: boolean;
      permissions: string[];
      timestamp: number;
    };
  };
  settings?: {
    defaultChain: number;
    autoLockTimeout: number;
  };
  transactionHistory?: Transaction[];
}

export class StorageManager {
  async get<K extends keyof StorageData>(
    key: K
  ): Promise<StorageData[K] | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  async set<K extends keyof StorageData>(
    key: K,
    value: StorageData[K]
  ): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: keyof StorageData): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }

  async hasAccount(): Promise<boolean> {
    const account = await this.get("account");
    return account !== null;
  }
}
```

#### 1.4 Content Script Injection

**File: src/content/index.ts**

```typescript
// Entry point for content script
// Runs on every webpage

import { injectProvider } from "./providerInjection";

// Inject provider as early as possible
injectProvider();

// Set up communication bridge
import "./dappBridge";
```

**File: src/content/providerInjection.ts**

```typescript
// Inject Ethereum provider into page context

export function injectProvider() {
  // Inject script that adds window.ethereum
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = (function () {
    this.remove();
  })(document.head || document.documentElement).appendChild(script);
}
```

#### 1.5 State Management

**File: src/popup/store.ts**

```typescript
import { create } from "zustand";

interface WalletState {
  // Account
  account: {
    address: string;
    balance: string;
  } | null;

  // Network
  chainId: number;

  // UI
  isLoading: boolean;
  error: string | null;

  // Actions
  setAccount: (account: WalletState["account"]) => void;
  setChainId: (chainId: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  account: null,
  chainId: 1,
  isLoading: false,
  error: null,

  setAccount: (account) => set({ account }),
  setChainId: (chainId) => set({ chainId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
```

**Deliverables:**

- ✅ Background service worker operational
- ✅ Message passing system implemented
- ✅ Storage management functional
- ✅ Content script injection working
- ✅ State management set up

---

## Phase 2: Porto Integration & WebAuthn

**Duration:** 3-4 weeks

### Objectives

- Integrate Porto SDK into extension
- Implement WebAuthn authentication flow
- Create account creation/connection logic
- Handle passkey storage and retrieval

### Tasks

#### 2.1 Offscreen Document for WebAuthn

Chrome extensions require offscreen documents for WebAuthn in Manifest V3.

**File: public/html/offscreen.html**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Porto Wallet Authentication</title>
  </head>
  <body>
    <script src="/offscreen.js"></script>
  </body>
</html>
```

**File: src/offscreen/webauthn.ts**

```typescript
// WebAuthn ceremonies in isolated context

export class WebAuthnService {
  async createPasskey(options: {
    challenge: Uint8Array;
    userId: Uint8Array;
    userName: string;
  }): Promise<PublicKeyCredential> {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: options.challenge,
        rp: {
          name: "Porto Wallet",
          id: window.location.hostname,
        },
        user: {
          id: options.userId,
          name: options.userName,
          displayName: options.userName,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "required",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    return credential;
  }

  async getPasskey(options: {
    challenge: Uint8Array;
    credentialId?: Uint8Array;
  }): Promise<PublicKeyCredential> {
    const allowCredentials = options.credentialId
      ? [
          {
            id: options.credentialId,
            type: "public-key" as const,
          },
        ]
      : undefined;

    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: options.challenge,
        rpId: window.location.hostname,
        allowCredentials,
        userVerification: "required",
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    return credential;
  }
}

// Message listener for background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const webauthn = new WebAuthnService();

  if (message.type === "WEBAUTHN_CREATE") {
    webauthn
      .createPasskey(message.payload)
      .then((credential) => sendResponse({ success: true, credential }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "WEBAUTHN_GET") {
    webauthn
      .getPasskey(message.payload)
      .then((credential) => sendResponse({ success: true, credential }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
```

#### 2.2 Porto Service Integration

**File: src/background/portoService.ts**

```typescript
import { Porto } from "porto";
import type { EIP1193Provider } from "viem";

export class PortoService {
  private porto: Porto | null = null;
  private provider: EIP1193Provider | null = null;

  async initialize(): Promise<void> {
    // Initialize Porto SDK
    this.porto = Porto.create({
      // Custom configuration for extension context
    });

    this.provider = this.porto.provider;
  }

  async createAccount(options: {
    displayName?: string;
  }): Promise<{ address: string }> {
    if (!this.provider) {
      throw new Error("Porto not initialized");
    }

    // Open offscreen document for WebAuthn
    await this.ensureOffscreenDocument();

    // Request account creation through Porto
    const result = await this.provider.request({
      method: "experimental_createAccount",
      params: [
        {
          displayName: options.displayName || "Porto Wallet",
        },
      ],
    });

    return result;
  }

  async connectAccount(): Promise<{ accounts: string[] }> {
    if (!this.provider) {
      throw new Error("Porto not initialized");
    }

    await this.ensureOffscreenDocument();

    const result = await this.provider.request({
      method: "wallet_connect",
    });

    return result;
  }

  async signTransaction(params: any): Promise<string> {
    if (!this.provider) {
      throw new Error("Porto not initialized");
    }

    // Prepare calls through Porto Relay
    const prepared = await this.provider.request({
      method: "wallet_prepareCalls",
      params: [params],
    });

    // Request WebAuthn signature
    await this.ensureOffscreenDocument();
    const signature = await this.requestWebAuthnSignature(prepared.digest);

    // Send prepared calls with signature
    const result = await this.provider.request({
      method: "wallet_sendPreparedCalls",
      params: [
        {
          ...prepared,
          signature,
        },
      ],
    });

    return result.id;
  }

  private async ensureOffscreenDocument(): Promise<void> {
    // Check if offscreen document exists
    const hasDocument = await chrome.offscreen.hasDocument();

    if (!hasDocument) {
      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: "WebAuthn authentication",
      });
    }
  }

  private async requestWebAuthnSignature(digest: string): Promise<string> {
    // Send message to offscreen document
    const response = await chrome.runtime.sendMessage({
      type: "WEBAUTHN_GET",
      payload: {
        challenge: new TextEncoder().encode(digest),
      },
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    // Extract signature from credential
    const signature = this.extractSignature(response.credential);
    return signature;
  }

  private extractSignature(credential: PublicKeyCredential): string {
    // Convert WebAuthn signature to hex string
    const response = credential.response as AuthenticatorAssertionResponse;
    const signature = new Uint8Array(response.signature);
    return (
      "0x" +
      Array.from(signature)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }
}
```

#### 2.3 Account Manager

**File: src/background/accountManager.ts**

```typescript
import { StorageManager } from "../utils/storage";
import { PortoService } from "./portoService";

export class AccountManager {
  constructor(
    private storageManager: StorageManager,
    private portoService: PortoService
  ) {}

  async createNewAccount(displayName?: string): Promise<string> {
    // Create account through Porto
    const result = await this.portoService.createAccount({ displayName });

    // Store account info
    await this.storageManager.set("account", {
      address: result.address,
      credentialId: result.credentialId,
      publicKey: result.publicKey,
    });

    return result.address;
  }

  async getAccount(): Promise<string | null> {
    const account = await this.storageManager.get("account");
    return account?.address || null;
  }

  async connectExistingAccount(): Promise<string> {
    const result = await this.portoService.connectAccount();

    if (result.accounts.length === 0) {
      throw new Error("No accounts found");
    }

    const address = result.accounts[0];

    // Update stored account
    await this.storageManager.set("account", {
      address,
      credentialId: "", // Retrieved from Porto
      publicKey: "",
    });

    return address;
  }

  async disconnect(): Promise<void> {
    await this.storageManager.remove("account");
  }
}
```

#### 2.4 WebAuthn Challenge Handling

**Key considerations:**

1. **Challenge Generation**

   - Must be cryptographically random
   - Should be unique per authentication
   - Porto Relay provides challenges for transaction signing

2. **Credential Storage**

   - Passkeys stored by browser/OS (iCloud Keychain, etc.)
   - Extension stores credential ID for lookup
   - Public key stored for verification

3. **Signature Verification**
   - Porto Relay verifies signatures
   - Extension validates credential responses
   - Checks for tampering/replay attacks

**Deliverables:**

- ✅ Offscreen document for WebAuthn functional
- ✅ Porto SDK integrated into background script
- ✅ Account creation flow implemented
- ✅ Account connection flow implemented
- ✅ WebAuthn signature handling working

---

## Phase 3: Provider Injection & dApp Communication

**Duration:** 2-3 weeks

### Objectives

- Inject Ethereum provider into web pages
- Implement EIP-1193 provider interface
- Support EIP-6963 multi-provider discovery
- Handle dApp connection requests

### Tasks

#### 3.1 Provider Injection Script

**File: src/injected/provider.ts**

```typescript
// This script runs in page context (not extension context)
// Provides window.ethereum interface for dApps

interface EthereumProvider {
  isPorto: boolean;
  isMetaMask: boolean; // For compatibility
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  // ... other EIP-1193 methods
}

class PortoProvider implements EthereumProvider {
  isPorto = true;
  isMetaMask = true; // Pretend to be MetaMask for compatibility

  private eventListeners = new Map<string, Set<Function>>();
  private requestId = 0;

  constructor() {
    // Set up communication with content script
    this.setupMessageBridge();
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    const requestId = `req_${++this.requestId}`;

    return new Promise((resolve, reject) => {
      // Send request to content script
      window.postMessage(
        {
          type: "PORTO_REQUEST",
          requestId,
          method: args.method,
          params: args.params,
        },
        "*"
      );

      // Wait for response
      const handler = (event: MessageEvent) => {
        if (
          event.data.type === "PORTO_RESPONSE" &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener("message", handler);

          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      window.addEventListener("message", handler);
    });
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  removeListener(event: string, handler: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(handler);
    }
  }

  private setupMessageBridge(): void {
    window.addEventListener("message", (event) => {
      // Handle events from content script
      if (event.data.type === "PORTO_EVENT") {
        this.emit(event.data.event, event.data.data);
      }
    });
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error("Porto provider event handler error:", error);
        }
      });
    }
  }
}

// Inject provider into window
if (!window.ethereum) {
  window.ethereum = new PortoProvider();
}

// Announce via EIP-6963
if (window.ethereum && !window.ethereum.isPorto) {
  // Another provider already exists, use EIP-6963
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: {
        info: {
          uuid: "porto-wallet-extension",
          name: "Porto Wallet",
          icon: "data:image/svg+xml,...",
          rdns: "sh.porto.wallet",
        },
        provider: new PortoProvider(),
      },
    })
  );
}
```

#### 3.2 Content Script Bridge

**File: src/content/dappBridge.ts**

```typescript
// Bridge between injected provider and background script

class DappBridge {
  constructor() {
    this.setupMessageListeners();
  }

  private setupMessageListeners(): void {
    // Listen to messages from injected provider
    window.addEventListener("message", async (event) => {
      if (event.data.type === "PORTO_REQUEST") {
        await this.handleProviderRequest(event.data);
      }
    });
  }

  private async handleProviderRequest(data: any): Promise<void> {
    const { requestId, method, params } = data;

    try {
      // Forward request to background script
      const response = await chrome.runtime.sendMessage({
        type: "DAPP_REQUEST",
        method,
        params,
        origin: window.location.origin,
      });

      // Send response back to page
      window.postMessage(
        {
          type: "PORTO_RESPONSE",
          requestId,
          result: response.data,
        },
        "*"
      );
    } catch (error) {
      // Send error back to page
      window.postMessage(
        {
          type: "PORTO_RESPONSE",
          requestId,
          error: error.message,
        },
        "*"
      );
    }
  }

  public emitEvent(event: string, data: any): void {
    // Send event to injected provider
    window.postMessage(
      {
        type: "PORTO_EVENT",
        event,
        data,
      },
      "*"
    );
  }
}

const bridge = new DappBridge();

// Listen for events from background to forward to page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "EMIT_EVENT") {
    bridge.emitEvent(message.event, message.data);
  }
});
```

#### 3.3 dApp Connection Management

**File: src/background/dappManager.ts**

```typescript
import { StorageManager } from "../utils/storage";

export class DappManager {
  constructor(private storageManager: StorageManager) {}

  async requestConnection(
    origin: string,
    accounts: string[]
  ): Promise<boolean> {
    // Check if dApp already connected
    const connectedDapps =
      (await this.storageManager.get("connectedDapps")) || {};

    if (connectedDapps[origin]?.connected) {
      return true;
    }

    // Request user approval via popup
    const approved = await this.requestUserApproval(origin, accounts);

    if (approved) {
      connectedDapps[origin] = {
        connected: true,
        permissions: ["eth_accounts"],
        timestamp: Date.now(),
      };
      await this.storageManager.set("connectedDapps", connectedDapps);
    }

    return approved;
  }

  async isConnected(origin: string): Promise<boolean> {
    const connectedDapps =
      (await this.storageManager.get("connectedDapps")) || {};
    return connectedDapps[origin]?.connected || false;
  }

  async disconnect(origin: string): Promise<void> {
    const connectedDapps =
      (await this.storageManager.get("connectedDapps")) || {};
    delete connectedDapps[origin];
    await this.storageManager.set("connectedDapps", connectedDapps);
  }

  private async requestUserApproval(
    origin: string,
    accounts: string[]
  ): Promise<boolean> {
    // Open popup with connection request
    // Wait for user response
    // Return approval result
    return new Promise((resolve) => {
      // Implementation using popup
    });
  }
}
```

#### 3.4 Supported RPC Methods

Implement handlers for all standard methods:

**Account Methods:**

- `eth_requestAccounts` - Request account access
- `eth_accounts` - Get connected accounts
- `eth_coinbase` - Get primary account

**Network Methods:**

- `eth_chainId` - Get current chain ID
- `net_version` - Get network ID

**Transaction Methods:**

- `eth_sendTransaction` - Send transaction
- `eth_sendRawTransaction` - Send raw transaction

**Signing Methods:**

- `eth_sign` - Sign message
- `personal_sign` - Sign personal message
- `eth_signTypedData` - Sign typed data (v1)
- `eth_signTypedData_v3` - Sign typed data (v3)
- `eth_signTypedData_v4` - Sign typed data (v4)

**Read Methods:**

- `eth_call` - Execute call
- `eth_estimateGas` - Estimate gas
- `eth_getBalance` - Get balance
- `eth_getTransactionCount` - Get nonce
- `eth_getCode` - Get contract code

**Event Methods:**

- `accountsChanged` - Account changed event
- `chainChanged` - Chain changed event
- `connect` - Connect event
- `disconnect` - Disconnect event

**Deliverables:**

- ✅ Provider injection working on all websites
- ✅ EIP-1193 interface implemented
- ✅ EIP-6963 support added
- ✅ dApp connection flow functional
- ✅ All standard RPC methods supported

---

## Phase 4: Transaction Management

**Duration:** 3-4 weeks

### Objectives

- Implement transaction creation and signing
- Build transaction approval UI
- Handle transaction lifecycle
- Support Porto's intent system

### Tasks

#### 4.1 Transaction Manager

**File: src/background/transactionManager.ts**

```typescript
import { PortoService } from "./portoService";
import { StorageManager } from "../utils/storage";

export interface Transaction {
  id: string;
  from: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
  status: "pending" | "approved" | "rejected" | "sent" | "confirmed" | "failed";
  origin: string;
  timestamp: number;
  hash?: string;
}

export class TransactionManager {
  private pendingTransactions = new Map<string, Transaction>();

  constructor(
    private portoService: PortoService,
    private storageManager: StorageManager
  ) {}

  async createTransaction(params: {
    from: string;
    to: string;
    value?: string;
    data?: string;
    chainId: number;
    origin: string;
  }): Promise<string> {
    const txId = this.generateTxId();

    const transaction: Transaction = {
      id: txId,
      from: params.from,
      to: params.to,
      value: params.value || "0x0",
      data: params.data || "0x",
      chainId: params.chainId,
      status: "pending",
      origin: params.origin,
      timestamp: Date.now(),
    };

    this.pendingTransactions.set(txId, transaction);

    // Open popup for approval
    await this.openApprovalPopup(txId);

    return txId;
  }

  async approveTransaction(txId: string): Promise<string> {
    const transaction = this.pendingTransactions.get(txId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    transaction.status = "approved";

    // Sign and send via Porto
    const intentId = await this.portoService.signTransaction({
      calls: [
        {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
        },
      ],
      chainId: `0x${transaction.chainId.toString(16)}`,
    });

    transaction.hash = intentId;
    transaction.status = "sent";

    // Save to history
    await this.saveToHistory(transaction);

    // Monitor confirmation
    this.monitorTransaction(txId, intentId);

    return intentId;
  }

  async rejectTransaction(txId: string): Promise<void> {
    const transaction = this.pendingTransactions.get(txId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    transaction.status = "rejected";
    this.pendingTransactions.delete(txId);
  }

  async getTransactionStatus(txId: string): Promise<Transaction | null> {
    return this.pendingTransactions.get(txId) || null;
  }

  private async openApprovalPopup(txId: string): Promise<void> {
    await chrome.windows.create({
      url: `popup.html#/approve-tx/${txId}`,
      type: "popup",
      width: 400,
      height: 600,
    });
  }

  private async monitorTransaction(
    txId: string,
    intentId: string
  ): Promise<void> {
    const checkStatus = async () => {
      const status = await this.portoService.provider.request({
        method: "wallet_getCallsStatus",
        params: [intentId],
      });

      const transaction = this.pendingTransactions.get(txId);
      if (!transaction) return;

      if (status.status === "CONFIRMED") {
        transaction.status = "confirmed";
        this.pendingTransactions.delete(txId);
      } else if (status.status === "FAILED") {
        transaction.status = "failed";
        this.pendingTransactions.delete(txId);
      } else {
        // Check again in 2 seconds
        setTimeout(checkStatus, 2000);
      }
    };

    checkStatus();
  }

  private async saveToHistory(transaction: Transaction): Promise<void> {
    const history = (await this.storageManager.get("transactionHistory")) || [];
    history.unshift(transaction);

    // Keep only last 100 transactions
    if (history.length > 100) {
      history.pop();
    }

    await this.storageManager.set("transactionHistory", history);
  }

  private generateTxId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 4.2 Transaction Approval UI

**File: src/popup/pages/ApproveTransaction.tsx**

```typescript
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface TransactionDetails {
  from: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
  origin: string;
  estimatedGas?: string;
  feeInUSD?: string;
}

export function ApproveTransaction() {
  const { txId } = useParams();
  const [tx, setTx] = useState<TransactionDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTransaction();
  }, [txId]);

  async function loadTransaction() {
    const response = await chrome.runtime.sendMessage({
      type: "GET_TRANSACTION",
      payload: { txId },
    });
    setTx(response.data);
  }

  async function handleApprove() {
    setLoading(true);

    try {
      await chrome.runtime.sendMessage({
        type: "APPROVE_TRANSACTION",
        payload: { txId },
      });

      // Show success and close
      window.close();
    } catch (error) {
      alert("Transaction failed: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    await chrome.runtime.sendMessage({
      type: "REJECT_TRANSACTION",
      payload: { txId },
    });
    window.close();
  }

  if (!tx) return <div>Loading...</div>;

  return (
    <div className="approve-tx">
      <h2>Approve Transaction</h2>

      <div className="tx-details">
        <div className="origin">
          <strong>From dApp:</strong> {tx.origin}
        </div>

        <div className="from">
          <strong>From:</strong> {tx.from}
        </div>

        <div className="to">
          <strong>To:</strong> {tx.to}
        </div>

        <div className="value">
          <strong>Amount:</strong> {formatValue(tx.value)} ETH
        </div>

        {tx.data !== "0x" && (
          <div className="data">
            <strong>Data:</strong>
            <code>{tx.data.slice(0, 50)}...</code>
          </div>
        )}

        <div className="gas">
          <strong>Estimated Gas:</strong> {tx.estimatedGas}
          {tx.feeInUSD && <span>(${tx.feeInUSD})</span>}
        </div>
      </div>

      <div className="actions">
        <button
          onClick={handleReject}
          disabled={loading}
          className="btn-reject"
        >
          Reject
        </button>

        <button
          onClick={handleApprove}
          disabled={loading}
          className="btn-approve"
        >
          {loading ? "Confirming..." : "Approve with Face ID"}
        </button>
      </div>
    </div>
  );
}

function formatValue(hex: string): string {
  // Convert hex wei to ETH
  const wei = BigInt(hex);
  const eth = Number(wei) / 1e18;
  return eth.toFixed(6);
}
```

#### 4.3 Gas Estimation

**File: src/utils/gasEstimator.ts**

```typescript
export class GasEstimator {
  async estimateGas(params: {
    from: string;
    to: string;
    value: string;
    data: string;
    chainId: number;
  }): Promise<{
    gasLimit: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    totalCostWei: string;
    totalCostUSD: string;
  }> {
    // Get gas prices from Porto Relay or RPC
    const gasPrices = await this.getGasPrices(params.chainId);

    // Estimate gas limit
    const gasLimit = await this.estimateGasLimit(params);

    // Calculate total cost
    const totalCostWei = BigInt(gasLimit) * BigInt(gasPrices.maxFeePerGas);

    // Convert to USD (fetch ETH price)
    const ethPrice = await this.getETHPrice();
    const totalCostUSD = (Number(totalCostWei) / 1e18) * ethPrice;

    return {
      gasLimit,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      totalCostWei: totalCostWei.toString(),
      totalCostUSD: totalCostUSD.toFixed(2),
    };
  }

  private async getGasPrices(chainId: number) {
    // Fetch current gas prices
  }

  private async estimateGasLimit(params: any) {
    // Estimate gas limit for transaction
  }

  private async getETHPrice(): Promise<number> {
    // Fetch ETH price from oracle
  }
}
```

**Deliverables:**

- ✅ Transaction creation and queuing working
- ✅ Transaction approval UI functional
- ✅ Transaction signing via Porto implemented
- ✅ Transaction monitoring active
- ✅ Gas estimation accurate

---

## Phase 5: User Interface

**Duration:** 3-4 weeks

### Objectives

- Build main popup interface
- Create onboarding flow
- Implement portfolio view
- Design settings pages

### Tasks

#### 5.1 Popup Main App

**File: src/popup/App.tsx**

```typescript
import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";

import { Home } from "./pages/Home";
import { Onboarding } from "./pages/Onboarding";
import { Send } from "./pages/Send";
import { Receive } from "./pages/Receive";
import { Settings } from "./pages/Settings";
import { ApproveTransaction } from "./pages/ApproveTransaction";
import { ApproveConnection } from "./pages/ApproveConnection";

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  async function checkAuthentication() {
    const response = await chrome.runtime.sendMessage({
      type: "GET_STATE",
    });
    setIsAuthenticated(response.data.isAuthenticated);
  }

  if (!isAuthenticated) {
    return <Onboarding />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/send" element={<Send />} />
        <Route path="/receive" element={<Receive />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/approve-tx/:txId" element={<ApproveTransaction />} />
        <Route path="/approve-connection" element={<ApproveConnection />} />
      </Routes>
    </HashRouter>
  );
}
```

#### 5.2 Onboarding Flow

**File: src/popup/pages/Onboarding.tsx**

```typescript
export function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  async function createAccount() {
    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "CREATE_ACCOUNT",
        payload: {
          displayName: "Porto Wallet",
        },
      });

      if (response.success) {
        // Account created, proceed to home
        window.location.reload();
      }
    } catch (error) {
      alert("Failed to create account: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function connectExisting() {
    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "CONNECT_ACCOUNT",
      });

      if (response.success) {
        window.location.reload();
      }
    } catch (error) {
      alert("Failed to connect: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 1) {
    return (
      <div className="onboarding">
        <h1>Welcome to Porto Wallet</h1>
        <p>Next-gen crypto wallet with biometric security</p>

        <button onClick={() => setStep(2)}>Create New Wallet</button>

        <button onClick={() => setStep(3)}>I Have a Wallet</button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="onboarding">
        <h1>Create Your Wallet</h1>

        <div className="features">
          ✓ No passwords or seed phrases ✓ Sign in with Face ID / Touch ID ✓
          Same wallet on all your devices ✓ Multi-chain support
        </div>

        <button onClick={createAccount} disabled={loading}>
          {loading ? "Creating..." : "Create Wallet with Face ID"}
        </button>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="onboarding">
        <h1>Connect Your Wallet</h1>
        <p>Use your existing passkey to connect</p>

        <button onClick={connectExisting} disabled={loading}>
          {loading ? "Connecting..." : "Connect with Face ID"}
        </button>
      </div>
    );
  }
}
```

#### 5.3 Home/Portfolio View

**File: src/popup/pages/Home.tsx**

```typescript
export function Home() {
  const { account } = useWalletStore();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  useEffect(() => {
    loadPortfolio();
  }, [account]);

  async function loadPortfolio() {
    const response = await chrome.runtime.sendMessage({
      type: "GET_PORTFOLIO",
      payload: { address: account.address },
    });
    setPortfolio(response.data);
  }

  return (
    <div className="home">
      <header>
        <div className="account">
          <div className="address">
            {formatAddress(account.address)}
            <button onClick={copyAddress}>📋</button>
          </div>
        </div>

        <ChainSelector />
      </header>

      <div className="balance">
        <div className="total-value">
          ${portfolio?.totalValue.toLocaleString()}
        </div>
        <div className="change">
          {portfolio?.change24h > 0 ? "↑" : "↓"} {portfolio?.change24h}%
        </div>
      </div>

      <div className="actions">
        <Link to="/send">
          <button>Send</button>
        </Link>
        <Link to="/receive">
          <button>Receive</button>
        </Link>
        <button onClick={openSwap}>Swap</button>
      </div>

      <TokenList tokens={portfolio?.tokens} />

      <TransactionHistory address={account.address} />
    </div>
  );
}
```

#### 5.4 Send Page

**File: src/popup/pages/Send.tsx**

```typescript
export function Send() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("ETH");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SEND_TRANSACTION",
        payload: {
          to: recipient,
          value: parseEther(amount).toString(),
          token,
        },
      });

      if (response.success) {
        alert("Transaction sent!");
        history.back();
      }
    } catch (error) {
      alert("Transaction failed: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="send">
      <h2>Send {token}</h2>

      <input
        placeholder="Recipient address (0x...)"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <TokenSelector value={token} onChange={setToken} />

      <button onClick={handleSend} disabled={loading || !recipient || !amount}>
        {loading ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
```

**Deliverables:**

- ✅ Main popup interface complete
- ✅ Onboarding flow functional
- ✅ Portfolio view displaying assets
- ✅ Send/Receive pages working
- ✅ Settings page implemented

---

## Phase 6: Multi-Chain Support

**Duration:** 2-3 weeks

### Objectives

- Implement chain switching
- Support multiple networks
- Handle cross-chain transactions
- Display balances across chains

### Tasks

#### 6.1 Chain Configuration

**File: src/utils/chains.ts**

```typescript
export interface Chain {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorer: string;
  iconUrl: string;
}

export const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 1,
    name: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    iconUrl: "/chains/ethereum.svg",
  },
  {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    iconUrl: "/chains/base.svg",
  },
  {
    id: 42161,
    name: "Arbitrum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    iconUrl: "/chains/arbitrum.svg",
  },
  // Add more chains...
];

export function getChain(chainId: number): Chain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId);
}
```

#### 6.2 Chain Switcher Component

**File: src/popup/components/ChainSelector.tsx**

```typescript
export function ChainSelector() {
  const { chainId, setChainId } = useWalletStore();
  const [open, setOpen] = useState(false);

  const currentChain = getChain(chainId);

  async function switchChain(newChainId: number) {
    // Update local state
    setChainId(newChainId);

    // Notify background script
    await chrome.runtime.sendMessage({
      type: "SWITCH_CHAIN",
      payload: { chainId: newChainId },
    });

    // Emit event to connected dApps
    await chrome.runtime.sendMessage({
      type: "EMIT_EVENT",
      event: "chainChanged",
      data: `0x${newChainId.toString(16)}`,
    });

    setOpen(false);
  }

  return (
    <div className="chain-selector">
      <button onClick={() => setOpen(!open)}>
        <img src={currentChain.iconUrl} />
        {currentChain.name}
      </button>

      {open && (
        <div className="chain-list">
          {SUPPORTED_CHAINS.map((chain) => (
            <button
              key={chain.id}
              onClick={() => switchChain(chain.id)}
              className={chain.id === chainId ? "active" : ""}
            >
              <img src={chain.iconUrl} />
              {chain.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 6.3 Multi-Chain Balance Fetching

**File: src/background/portfolioService.ts**

```typescript
import { createPublicClient, http } from "viem";
import { SUPPORTED_CHAINS } from "../utils/chains";

export class PortfolioService {
  async getPortfolio(address: string): Promise<Portfolio> {
    const balances = await Promise.all(
      SUPPORTED_CHAINS.map((chain) => this.getBalanceOnChain(address, chain))
    );

    const tokens = await this.getTokenBalances(address);

    const totalValue = this.calculateTotalValue(balances, tokens);

    return {
      totalValue,
      balances,
      tokens,
      change24h: 0, // TODO: Calculate from price history
    };
  }

  private async getBalanceOnChain(
    address: string,
    chain: Chain
  ): Promise<Balance> {
    const client = createPublicClient({
      chain: {
        id: chain.id,
        name: chain.name,
        network: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: { default: { http: [chain.rpcUrl] } },
      },
      transport: http(chain.rpcUrl),
    });

    const balance = await client.getBalance({ address });

    return {
      chainId: chain.id,
      chainName: chain.name,
      balance: balance.toString(),
      formatted: formatEther(balance),
    };
  }

  private async getTokenBalances(address: string): Promise<Token[]> {
    // Fetch ERC-20 token balances across chains
    // Use services like Alchemy, Moralis, or The Graph
  }

  private calculateTotalValue(balances: Balance[], tokens: Token[]): number {
    // Sum up all values in USD
  }
}
```

**Deliverables:**

- ✅ Chain switching functional
- ✅ Multi-chain balance display working
- ✅ Cross-chain transaction support
- ✅ All supported chains integrated

---

## Phase 7: Advanced Features

**Duration:** 3-4 weeks

### Objectives

- Add token management
- Implement NFT support
- Add transaction history
- Build swap integration

### Tasks

#### 7.1 Token Management

- Add custom ERC-20 tokens
- Display token balances
- Token price tracking
- Token icons/metadata

#### 7.2 NFT Support

- Display NFT collections
- Show NFT images
- NFT transfer functionality
- NFT metadata fetching

#### 7.3 Transaction History

- Fetch historical transactions
- Display in timeline format
- Filter by type/status
- Export history

#### 7.4 Swap Integration

- Integrate with DEX aggregator (1inch, 0x)
- Quote fetching
- Swap execution
- Slippage protection

**Deliverables:**

- ✅ Token management complete
- ✅ NFT viewing functional
- ✅ Transaction history working
- ✅ Swap feature integrated

---

## Phase 8: Security Audit & Testing

**Duration:** 3-4 weeks

### Objectives

- Comprehensive security testing
- Penetration testing
- Code audit
- Bug fixes

### Tasks

#### 8.1 Security Audit

- [ ] WebAuthn implementation review
- [ ] Message passing security check
- [ ] Storage encryption audit
- [ ] CSP validation
- [ ] XSS vulnerability testing

#### 8.2 Testing

- [ ] Unit tests (>80% coverage)
- [ ] Integration tests
- [ ] E2E tests with dApps
- [ ] Performance testing
- [ ] Cross-browser testing

#### 8.3 Third-Party Audit

- [ ] Engage security firm
- [ ] Fix identified issues
- [ ] Re-audit critical components

**Deliverables:**

- ✅ Security audit report
- ✅ All critical issues fixed
- ✅ Test coverage >80%
- ✅ Third-party audit passed

---

## Phase 9: Distribution & Launch

**Duration:** 2-3 weeks

### Objectives

- Prepare for Chrome Web Store submission
- Create marketing materials
- Launch beta program
- Public release

### Tasks

#### 9.1 Chrome Web Store Preparation

- [ ] Prepare store listing
- [ ] Create screenshots
- [ ] Write description
- [ ] Set up developer account
- [ ] Submit for review

#### 9.2 Documentation

- [ ] User guide
- [ ] FAQ
- [ ] Troubleshooting
- [ ] Privacy policy
- [ ] Terms of service

#### 9.3 Beta Testing

- [ ] Recruit beta testers
- [ ] Gather feedback
- [ ] Fix reported issues
- [ ] Iterate on UX

#### 9.4 Launch

- [ ] Public release on Chrome Web Store
- [ ] Firefox Add-ons submission
- [ ] Marketing campaign
- [ ] Community engagement

**Deliverables:**

- ✅ Extension live on Chrome Web Store
- ✅ Firefox version published
- ✅ Documentation complete
- ✅ Beta feedback incorporated

---

## Technical Challenges & Solutions

### Challenge 1: WebAuthn in Extension Context

**Problem:** WebAuthn has limitations in browser extension service workers.

**Solution:** Use offscreen documents (Manifest V3 feature) to perform WebAuthn ceremonies in a proper browsing context.

### Challenge 2: Porto SDK Adaptation

**Problem:** Porto SDK designed for web applications, not extensions.

**Solution:**

- Run Porto SDK in background service worker
- Adapt communication to use chrome.runtime.sendMessage
- Handle iframe requirement with offscreen document or popup window

### Challenge 3: Storage Security

**Problem:** Need to store sensitive data securely in extension.

**Solution:**

- Never store private keys
- Use WebAuthn for authentication (keys in secure hardware)
- Encrypt sensitive data with user-derived keys
- Leverage chrome.storage with proper access controls

### Challenge 4: dApp Compatibility

**Problem:** Need to work with thousands of existing dApps.

**Solution:**

- Implement full EIP-1193 interface
- Mimic MetaMask behavior for compatibility
- Support EIP-6963 for multi-wallet scenarios
- Comprehensive testing with popular dApps

### Challenge 5: Cross-Chain UX

**Problem:** Managing assets across multiple chains is complex.

**Solution:**

- Unified balance view across all chains
- Automatic chain detection for dApps
- Smart chain switching
- Cross-chain transaction support via Porto

### Challenge 6: Porto Relay Dependency

**Problem:** Extension relies on Porto's centralized relay.

**Solution:**

- Option to run own relay (documented)
- Fallback mechanisms
- Offline mode for read operations
- Clear communication about dependency

---

## Timeline Summary

| Phase   | Duration  | Key Deliverables                |
| ------- | --------- | ------------------------------- |
| Phase 0 | 1-2 weeks | Project setup complete          |
| Phase 1 | 2-3 weeks | Core infrastructure ready       |
| Phase 2 | 3-4 weeks | Porto integration working       |
| Phase 3 | 2-3 weeks | dApp connectivity functional    |
| Phase 4 | 3-4 weeks | Transaction management complete |
| Phase 5 | 3-4 weeks | UI polished                     |
| Phase 6 | 2-3 weeks | Multi-chain support ready       |
| Phase 7 | 3-4 weeks | Advanced features done          |
| Phase 8 | 3-4 weeks | Security audit passed           |
| Phase 9 | 2-3 weeks | Public launch                   |

**Total Estimated Time:** 24-34 weeks (6-8.5 months)

---

## Success Metrics

**Technical Metrics:**

- Transaction signing latency < 2 seconds
- Extension memory usage < 100 MB
- Popup load time < 500ms
- dApp compatibility > 95%

**User Metrics:**

- User retention (7-day) > 60%
- Average session duration > 5 minutes
- Transaction success rate > 98%
- Support tickets < 5% of users

**Security Metrics:**

- Zero critical vulnerabilities
- Zero private key exposures
- WebAuthn success rate > 99%
- No security incidents

---

## Resources & Tools

**Development:**

- TypeScript
- React
- Porto SDK
- Viem/Wagmi
- Chrome Extension APIs

**Testing:**

- Jest (unit tests)
- Playwright (E2E tests)
- Chrome DevTools
- Network mocking tools

**Design:**

- Figma (UI design)
- Tailwind CSS
- Icon libraries

**Infrastructure:**

- GitHub (code repository)
- GitHub Actions (CI/CD)
- Chrome Web Store
- Firefox Add-ons

---

## Next Steps

1. **Review this roadmap** with your team
2. **Set up development environment** (Phase 0)
3. **Start with Phase 1** - Core infrastructure
4. **Iterate and adapt** based on learnings
5. **Stay in contact with Porto team** for SDK support

This roadmap provides a comprehensive guide to building your next-gen crypto wallet extension. Adjust timelines and priorities based on your team's size and expertise.

Good luck! 🚀

---

_Document Version: 1.0_
_Last Updated: November 2024_
