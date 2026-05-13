<h1 align="center">Sigby</h1>

<p align="center">
  <strong>A browser wallet that signs with a passkey.</strong><br>
  No seed phrases. No passwords. Nothing to write down.
</p>

<p align="center">
  <em>Built on <a href="https://porto.sh">Porto</a>.</em>
</p>

> **Alpha warning:** Sigby is in active development. Newly created passkeys
> are currently locked to the WebAuthn RP ID `id.sigby.xyz`, though older dev
> passkeys may still be scoped to the extension origin. The extension signing
> key and extension ID can still change before a stable release or a Chrome
> Web Store launch. Do not store meaningful funds in this wallet yet.

---

```bash
pnpm install
pnpm build
# load dist/ as an unpacked extension at chrome://extensions
```

Click the extension icon, authenticate with your passkey, and you have a self-custodial smart account on Base, Ethereum, Arbitrum, Optimism, and Polygon. Same address on every chain, and you don't have to pay gas in the native token.

## Why

|                  | Seed-phrase wallets           | Sigby                                        |
| ---------------- | ----------------------------- | -------------------------------------------- |
| **Auth**         | 12-word seed phrase           | Passkey (Touch ID / Face ID / Windows Hello) |
| **Account type** | EOA                           | EIP-7702 smart account                       |
| **Gas**          | Pay in native token only      | Pay in USDC, USDT, or native                 |
| **Addresses**    | Different per chain sometimes | Same address on every chain                  |
| **Backup**       | Write down 12 words           | Synced via iCloud / Google Passwords         |
| **Batch calls**  | Approve + swap = 2 popups     | Atomic bundle via EIP-5792                   |

Built on [Porto](https://porto.sh) by the Ithaca team (Foundry / Reth / Wagmi / Viem).

## Quick Start

### 1. Install

```bash
git clone <this-repo>
cd <cloned-dir>          # the package itself is named `sigby-wallet`
pnpm install
```

### 2. Build

```bash
pnpm build         # production build (both main + injected provider)
pnpm dev           # watch mode
pnpm type-check    # tsc --noEmit
```

### 3. Load in Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** on
3. Click **Load unpacked** and select the `dist/` folder
4. Pin the Sigby icon to your toolbar

### 4. Create a Wallet

Click the icon, hit **Create Wallet**, and authenticate with your passkey (Touch ID, Windows Hello, or whatever your platform supports). There is no seed phrase to write down. The passkey lives in your platform keychain (iCloud, Google Password Manager, 1Password, and so on) and syncs across your devices automatically.

The Touch ID and Face ID prompts will show the label `Sigby <N>`. That name is fixed at creation time and can't be changed afterwards. The display name inside the wallet (Trading, Savings, Main) is editable later.

### 5. Connect to a dApp

Any EIP-1193 or EIP-6963 dApp works, whether that's Uniswap, OpenSea, or something else. Click Connect Wallet, approve in the Sigby popup, and you're done. The wallet announces itself as `isSigby=true` via EIP-6963.

## Features

Sigby uses EIP-7702 smart accounts: your EOA behaves like a smart contract during a transaction, which lets you batch calls atomically, restrict contract access, and pay gas in something other than the native token.

Authentication is biometric only. There is no password and no seed phrase. WebAuthn keys are hardware-backed (Secure Enclave or TPM) and phishing-resistant by design. The popup also has a configurable idle auto-lock, but that's a UX curtain over the same biometric: every signing operation re-prompts WebAuthn regardless.

You get the same address on every chain. Porto uses `chainId=0` EIP-7702 authorizations, so your account address is identical on Ethereum, Base, Arbitrum, Optimism, and Polygon, with no per-chain deployment.

Gas can be paid in USDC, USDT, or the chain's native token. The wallet queries supported fee tokens from Porto's Relay, and the picker shows up in the **ERC-20 Send** flow and on **dApp transaction approval**. Native-asset Send always pays gas in the native token because Porto's relay handles the native fee inline, and the wallet doesn't expose a fee-token override on that path.

EIP-5792 bundles let dApps send a list of calls in a single approval. `wallet_sendCalls` returns `{ id: bundleId }`, and `wallet_getCallsStatus` polls for receipts.

The extension supports unlimited Porto accounts. Each account has its own passkey, its own dApp connections, and its own transaction history, and you can switch between them from the header.

Per-origin chain context (EIP-3326) means Uniswap on Base can coexist with another dApp on Arbitrum. Each origin gets its own `chainId`, so switching one doesn't break the other.

Session keys give a dApp limited, time-bounded signing authority via `wallet_grantPermissions`. The grant ceremony opens an approval popup, and revocation lives in the Permissions page. ⚠ Today the dApp signing handlers (`wallet_sendCalls`, `eth_sendTransaction`) still always open the approval popup. The granted session key isn't yet consulted to silently sign on the dApp's behalf, so "no more popup spam" is the _target_ shape, not the current behavior. Grant, revoke, and Porto-side key storage are wired up; the popup-skipping path is the missing piece.

Transaction history is pulled from Porto's `wallet_getCallsHistory`. It auto-refreshes when an in-popup Send (native or ERC-20) confirms, because those flows feed `useTransactionWatcher` via `pendingTransactions`. dApp-originated bundles don't currently feed the watcher, so the History page picks them up on its next manual fetch or popup reopen.

To add a custom ERC-20 token, paste a contract address. The wallet fetches symbol and decimals from chain and adds it to the token list.

Settings shows live Porto Relay health with latency and version.

## Supported Chains

**Mainnet:** Ethereum (default), Base, Arbitrum, Optimism, Polygon

**Testnet:** Sepolia, Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Polygon Amoy, Holesky

All chains are pre-configured. Custom chain addition is not yet supported.

## Supported Methods

### EIP-1193 standard

`eth_requestAccounts`, `eth_accounts`, `eth_coinbase`, `eth_chainId`, `net_version`, `eth_getBalance`, `eth_call`, `eth_estimateGas`, `eth_blockNumber`, `eth_getTransactionCount`, `eth_getCode`, `eth_getTransactionReceipt`, `eth_getTransactionByHash`, `eth_gasPrice`, `eth_sendTransaction`, `personal_sign`, `eth_sign` (redirected to `personal_sign`, since it is deprecated and insecure), `eth_signTypedData` / `_v3` / `_v4`

### Wallet methods

`wallet_switchEthereumChain` (EIP-3326, per-origin), `wallet_addEthereumChain` (built-in chains only), `wallet_requestPermissions` (wraps `eth_requestAccounts` in the EIP-2255 caveat envelope), `wallet_getPermissions` (returns `[]`, so Porto-aware dApps fall back to `eth_accounts`), `wallet_grantPermissions` (a dApp-originated session-key grant that opens the grant-permissions approval popup and forwards to the Porto SDK)

### EIP-5792 smart account

`wallet_getCapabilities`, `wallet_sendCalls`, `wallet_getCallsStatus`

`wallet_getCapabilities` and `wallet_getCallsStatus` are proxied from the background directly to Porto Relay (HTTP) so dApps can poll without opening a popup. `wallet_sendCalls` goes through the popup for WebAuthn signing.

### Legacy provider shims

The provider deliberately keeps `isMetaMask: false` while exposing `isSigby: true`. Legacy methods are still implemented for older dApps: `enable()`, `send()`, `sendAsync()`, and `_metamask.isUnlocked()`. The first three log a deprecation warning. `_metamask.isUnlocked()` doesn't, because it's the active wagmi/Web3Modal lock-state probe and gets called on every reconnect, so warning would flood dApp consoles. `enable()` and `sendAsync()` delegate to `request()`. `send()` mostly delegates too, except that `send("net_version")` and `send("eth_chainId")` return cached chain info synchronously (those reads are lock-independent, and pre-EIP-1193 dApps still call them in synchronous code paths). `send("eth_accounts")` and `send("eth_coinbase")` deliberately do **not** return the cached `selectedAddress` synchronously. They route through `request()` so the lock gate runs, because the legacy sync path used to leak a stale unlocked address past a lock event. `_metamask.isUnlocked()` resolves via the private `_sigby_isLocked` RPC, which is visible to the popup origin and connected origins; unconnected origins get a safe-default `true` so they can't poll for idle/active fingerprinting.

### Porto SDK (popup-side)

The popup's `popupPortoService` calls these against the Porto SDK:

- **Account / session:** `wallet_connect` (account create or select), `wallet_disconnect`, `eth_accounts`
- **Signing:** `personal_sign`, `eth_signTypedData_v4`, `wallet_sendCalls` (raw, full EIP-5792 pass-through)
- **Read:** `wallet_getCallsHistory`, `wallet_getCallsStatus`, `wallet_getAssets`, `wallet_getCapabilities`, `wallet_getPermissions`, `wallet_getKeys`, `health`
- **Permissions:** `wallet_grantPermissions`, `wallet_revokePermissions`

Some of these also appear in the dApp-facing list above. That's because the background's `wallet_getCapabilities` and `wallet_getCallsStatus` handlers proxy directly to Porto Relay over HTTP so dApps can poll without a popup round-trip, while the popup uses the SDK form for its own UI calls. Both paths serve the same EIP-5792 contract from two surfaces.

## Project Layout

Pages live in `src/popup/pages/<Page>/index.tsx` with a sibling `use<Page>.ts` hook and occasional helpers. The layout below names the directory, not the file.

```
src/
├── background/         Service worker — dApp request router, account state, Porto Relay proxy
│   ├── index.ts              Entry, lifecycle, message listener
│   ├── messageHandler.ts     Central RPC router
│   ├── rpcHandler.ts         Read-only viem clients (multi-chain)
│   ├── accountManager.ts     Multi-account CRUD
│   ├── dappManager.ts        Per-account connections, per-origin chain, pending approvals
│   ├── eventBroadcaster.ts   EIP-1193 event fan-out (origin-scoped only)
│   ├── tokenService.ts       ERC-20 balances/metadata
│   └── lockStatus.ts         Background mirror of popup lock state via chrome.storage.session
├── content/            Content script — injects provider, bridges page ↔ extension
│   ├── index.ts              Entry, runs at document_start
│   ├── providerInjection.ts  Injects injected.js into page DOM
│   └── dappBridge.ts         postMessage ↔ chrome.runtime bridge, context monitor
├── injected/
│   └── provider.ts           window.ethereum — EIP-1193 + EIP-6963, page context (IIFE)
├── popup/              React popup (400×600) — Porto SDK lives here
│   ├── index.tsx             Mounts React
│   ├── App.tsx               Layout, auth guard, Porto SDK init
│   ├── popup.html            Popup HTML shell
│   ├── tailwind.css          Tailwind entry
│   ├── router.tsx            Hash router
│   ├── store.ts              Zustand — multi-account, assets, lock, pending txs
│   ├── portoService.ts       Actual Porto SDK client (WebAuthn lives here)
│   ├── hooks/                useTransactionWatcher, useAutoLockTimer (idle timeout
│   │                         that drives auto-lock), useReducedMotion + barrel
│   ├── styles/               Design tokens, signature motion presets
│   ├── utils/                Popup-local helpers
│   ├── pages/
│   │   ├── Home/             Balance + native asset + token list
│   │   ├── Send/             Native transfer
│   │   ├── SendToken/        ERC-20 transfer with fee token selector
│   │   ├── Receive/          Address + QR code
│   │   ├── TokenDetail/      Per-token view
│   │   ├── History/          wallet_getCallsHistory
│   │   ├── TransactionDetail/ Single bundle / asset diffs
│   │   ├── Permissions/      Session key management
│   │   ├── Settings/         Account, chain, relay health, authorized keys
│   │   ├── Lock/             LockScreen — biometric canary unlock
│   │   ├── Onboarding/       4-step welcome flow (first run only)
│   │   └── approval/         ConnectionApproval, TransactionApproval,
│   │                         SigningApproval, GrantPermissionsApproval
│   └── components/           ErrorBoundary + approvals, common, keys, layout,
│                             permissions, relay, settings, token, ui
├── types/              account.ts, messages.ts, porto.ts
└── utils/              storage.ts, constants.ts, validators.ts, rpcError.ts, erc20Abi.ts
```

Note: `src/popup/pages/Tokens/` has a `useTokens.ts` hook but no `index.tsx` route, because the `/tokens` path redirects to `/`. The hook stays around because the token-list logic is consumed by Home.

The background does **not** instantiate the Porto SDK, and there is no `src/background/portoService.ts`. WebAuthn requires a visible window, so all Porto SDK calls live in the popup.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

## Development

```bash
pnpm dev             # Vite watch mode (main bundle only: popup/background/content)
pnpm build           # Full production build (main + injected)
pnpm build:main      # Main bundle only
pnpm build:injected  # Injected provider only (page context, IIFE)
pnpm type-check      # tsc --noEmit
```

Heads up: `pnpm dev` does NOT watch `src/injected/provider.ts`, since that build is separate. After editing the injected provider, re-run `pnpm build:injected` manually.

There are two builds for one extension. The injected provider has to run in the page's JavaScript context, not the content script's isolated context, so `window.ethereum` is reachable by dApps. It's bundled as an IIFE by a separate Vite config (`vite.injected.config.ts`) and loaded via `chrome.runtime.getURL("injected.js")`.

After code changes, reload the extension at `chrome://extensions` and refresh any open dApp tabs. The content script detects extension-context invalidation and emits a `disconnect` event, but a hard refresh is cleaner.

### Debugging

| Component         | Where to look                                                 |
| ----------------- | ------------------------------------------------------------- |
| Background        | `chrome://extensions`, then click the **Service worker** link |
| Content script    | DevTools on the dApp tab (Console shows `[ContentScript]`)    |
| Injected provider | Same DevTools, look for `[Sigby]`                             |
| Popup             | Right-click the Sigby popup and pick **Inspect**              |
| Approval popups   | Right-click the popup window and pick **Inspect**             |

Most components log with a `[Component]` prefix. The prefixes actually in use:

- **dApp-visible** (page console): `[Sigby]` (injected provider)
- **Popup** (popup DevTools): `[Sigby:Popup]`, `[Store]`, `[App]`, `[ErrorBoundary]`, `[Watcher]`
- **Background** (service worker DevTools): `[Background]`, `[MessageHandler]`, `[DappManager]`, `[AccountManager]`, `[RpcHandler]`, `[TokenService]`, `[LockStatus]`
- **Content script** (dApp tab DevTools): `[ContentScript]`, `[DappBridge]`, `[ProviderInjection]`

Two notable absences. There is no `[Storage]` prefix; `StorageManager` errors log bare strings like `Failed to get storage key "x"`. And there is no `[Sigby:BG]`, because the background uses `[Background]` and per-class prefixes instead. A handful of catch blocks (notably some approval-flow error logs, plus the `StorageManager` calls just mentioned) still go through bare `console.error` without a prefix, so grep for the message text if you can't find a prefix match.

## Security

The extension never touches private key material. WebAuthn keys live in hardware (Secure Enclave, TPM); we only store account addresses and metadata in extension storage.

Passkey labels are immutable once created. The string you see in the Touch ID prompt is fixed at credential-creation time, so we can't relabel a passkey after the fact. The display name you give an account inside Sigby is independent of that, and you can rename it whenever.

Unconnected dApps see nothing. `eth_accounts` returns `[]` for any origin that hasn't connected, `wallet_getCapabilities` refuses to expose capabilities to those origins, and chain switches affect only the dApp that asked for them.

Origin validation runs along two paths depending on the message channel. Signing handlers and anything that persists origin metadata go through `extractValidOrigin`, which reads `sender.origin` first and then derives from `sender.url`. It deliberately ignores `sender.tab.url` (the top-frame URL would let a malicious iframe inherit the tab's permissions, since content scripts run with `all_frames: true`) and ignores any `origin` field in the message body. The dApp-request dispatch in `handleDappRequest` (`eth_accounts`, `eth_chainId`, `wallet_switchEthereumChain`, `wallet_getCapabilities`, `wallet_getCallsStatus`, and so on) takes `payload.origin` directly, but that field is set by the content script from `window.location.origin` and so is content-script-attested rather than dApp-attested. The full rationale lives in `ARCHITECTURE.md#security-boundaries`.

Content Security Policy locks `connect-src` to Porto Relay and the configured public RPC endpoints.

The Porto relay and smart contracts have been audited by @MiloTruck, @rholterhus, and @kadenzipfel. See [porto.sh](https://porto.sh) for the bounty program.

## Requirements

- Chromium 122 or newer. The manifest gates on Chrome 122 (`minimum_chrome_version`) for the extension WebAuthn host-permissions RP-ID path used by Porto. Brave, Edge, and Vivaldi work wherever they ship a Chromium 122 base or newer.
- Node 20 or newer and pnpm for development. This isn't enforced by an `engines` field, so older toolchains may still work, but they aren't tested.
- A platform passkey provider, such as iCloud Keychain (macOS/iOS), Google Password Manager, 1Password, Bitwarden, or equivalent.

## Limits & TODO

- Custom chain addition (`wallet_addEthereumChain` with non-built-in chains) is not yet supported.
- Raw transactions (`eth_sendRawTransaction`) are not implemented. Porto doesn't expose private keys, so this is an architectural limit rather than a missing feature.
- NFTs get partial coverage. Transaction Detail renders an "NFT" row with collection name, symbol, and signed direction when an asset diff has `type === "erc721"`. The row does **not** carry the token id or contract address, because Porto's diff currently doesn't surface them and we haven't backfilled. There is also no dedicated NFT inventory or transfer UI.
- EOA upgrade (`wallet_prepareUpgradeAccount` and `wallet_upgradeAccount`) is pending.
- Sponsored gas is detected heuristically. Transaction Detail shows a "Sponsored" badge and a "Paid by sponsor" fee state when there is no outgoing native asset diff for the chain matching the fee currency (see `useTransactionDetail.ts`). The relay's `capabilities.merchantUrl` field isn't actually inspected, so without paymaster metadata the heuristic can't be exact, and edge cases like a fee paid in ERC-20 while the sponsor still covered native dust may misclassify. The wallet UI also doesn't let _the user_ configure or request sponsorship; it only surfaces sponsorship that the dApp arranged.

See [docs/PORTO_FEATURE_LIST.md](docs/PORTO_FEATURE_LIST.md) for the full status matrix.

## Acknowledgments

Built on [Porto](https://porto.sh) (SDK and Relay) by [Ithaca](https://ithaca.xyz). Ethereum client code comes from [viem](https://viem.sh). The UI uses React, Zustand, and Tailwind, bundled with Vite and `@crxjs/vite-plugin`.

## License

MIT
