<h1 align="center">Sigby</h1>

<p align="center">
  <strong>A browser wallet that signs with a passkey.</strong><br>
  No seed phrases. No passwords. No extensions to babysit.<br>
  Touch ID, Face ID, Windows Hello — same account on every chain.
</p>

<p align="center">
  <em>Built on <a href="https://porto.sh">Porto</a>.</em>
</p>

> **Alpha warning:** Sigby is in active development. Newly created passkeys are
> currently locked to the WebAuthn RP ID `id.sigby.xyz`; older dev passkeys may
> still be scoped to the extension origin. The extension signing key / extension
> ID may still change before a stable release or Chrome Web Store launch. Do not
> store meaningful funds in this wallet yet.

---

```bash
pnpm install
pnpm build
# load dist/ as an unpacked extension at chrome://extensions
```

Click the extension icon, authenticate with your passkey, and you have a self-custodial smart account on Base, Ethereum, Arbitrum, Optimism, and Polygon — same address, every chain, no gas needed in the native token.

## Why

|                  | Seed-phrase wallets        | Sigby                              |
| ---------------- | -------------------------- | ---------------------------------- |
| **Auth**         | 12-word seed phrase        | Passkey (Touch ID / Face ID / Windows Hello) |
| **Account type** | EOA                        | EIP-7702 smart account             |
| **Gas**          | Pay in native token only   | Pay in USDC, USDT, or native       |
| **Addresses**    | Different per chain sometimes | Same address on every chain    |
| **Backup**       | Write down 12 words        | Synced via iCloud / Google Passwords |
| **Batch calls**  | Approve + swap = 2 popups  | Atomic bundle via EIP-5792         |

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

Click the icon → **Create Wallet** → authenticate with your passkey (Touch ID, Windows Hello, or whatever your platform supports). No seed phrase to write down — the passkey lives in your platform keychain (iCloud, Google Password Manager, 1Password, etc.) and syncs across your devices automatically.

In Touch ID / Face ID prompts, you'll see the label `Sigby <N>` — that name is fixed at creation time and can't be changed. The display name inside the wallet (Trading, Savings, Main) is editable later.

### 5. Connect to a dApp

Any EIP-1193 / EIP-6963 dApp works — Uniswap, OpenSea, whatever. Click Connect Wallet, approve in the Sigby popup, done. The wallet announces itself as `isSigby=true` via EIP-6963.

## Features

**Smart accounts (EIP-7702)** — your EOA acts as a smart contract when you transact. Batch calls atomically, whitelist contracts, pay gas however you want.

**Passkey auth (WebAuthn)** — biometrics only. No password, no seed phrase. Hardware-backed keys in the Secure Enclave / TPM, phishing-resistant by design. The popup itself has a configurable idle auto-lock (a UX curtain over the same biometric — every signing operation re-prompts WebAuthn regardless).

**Same address on every chain** — Porto uses `chainId=0` EIP-7702 authorizations, so your account has the same address on Ethereum, Base, Arbitrum, Optimism, and Polygon. No per-chain deployment.

**Pay gas in anything** — USDC, USDT, or the chain's native token. The wallet queries supported fee tokens from Porto's Relay; the picker is exposed in the **ERC-20 Send** flow and on **dApp transaction approval**. Native-asset Send still pays gas in the native token (no picker — Porto's relay handles the native fee inline) and the wallet doesn't expose a fee-token override on that path.

**EIP-5792 bundles** — dApps can send a list of calls in one approval. `wallet_sendCalls` returns `{ id: bundleId }`; `wallet_getCallsStatus` polls for receipts.

**Multi-account** — unlimited Porto accounts in one extension. Each gets its own passkey, its own dApp connections, its own transaction history. Switch between them from the header.

**Per-origin chain context (EIP-3326)** — Uniswap on Base and another dApp on Arbitrum at the same time. Each origin gets its own `chainId`; switching one doesn't break the other.

**Session keys** — grant a dApp limited, time-bounded signing authority via `wallet_grantPermissions`. The grant ceremony itself opens an approval popup; revocation is in the Permissions page. ⚠ Today the dApp signing handlers (`wallet_sendCalls`, `eth_sendTransaction`) still always open the approval popup — the granted session key isn't yet consulted to silently sign on the dApp's behalf, so "no more popup spam" is the *target* shape, not the current behavior. The grant + revoke + Porto-side key storage is wired; the popup-skipping path is the missing piece.

**Transaction history** — pulled from Porto's `wallet_getCallsHistory`. Auto-refreshes when an in-popup Send (native or ERC-20) confirms — those flows feed `useTransactionWatcher` via `pendingTransactions`. dApp-originated bundles don't currently feed the watcher; the History page picks them up on its next manual fetch / popup reopen.

**Custom ERC-20 tokens** — paste a contract address, the wallet fetches symbol/decimals from chain and adds it to the token list.

**Relay health** — Settings shows live Porto Relay status with latency and version.

## Supported Chains

**Mainnet:** Ethereum (default), Base, Arbitrum, Optimism, Polygon

**Testnet:** Sepolia, Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Polygon Amoy, Holesky

All chains are pre-configured. Custom chain addition is not yet supported.

## Supported Methods

### EIP-1193 standard

`eth_requestAccounts`, `eth_accounts`, `eth_coinbase`, `eth_chainId`, `net_version`, `eth_getBalance`, `eth_call`, `eth_estimateGas`, `eth_blockNumber`, `eth_getTransactionCount`, `eth_getCode`, `eth_getTransactionReceipt`, `eth_getTransactionByHash`, `eth_gasPrice`, `eth_sendTransaction`, `personal_sign`, `eth_sign` (redirected to `personal_sign` — deprecated and insecure), `eth_signTypedData` / `_v3` / `_v4`

### Wallet methods

`wallet_switchEthereumChain` (EIP-3326, per-origin), `wallet_addEthereumChain` (built-in chains only), `wallet_requestPermissions` (wraps `eth_requestAccounts` in the EIP-2255 caveat envelope), `wallet_getPermissions` (returns `[]`; Porto-aware dApps fall back to `eth_accounts`), `wallet_grantPermissions` (dApp-originated session-key grant — opens the grant-permissions approval popup and forwards to Porto SDK)

### EIP-5792 smart account

`wallet_getCapabilities`, `wallet_sendCalls`, `wallet_getCallsStatus`

`wallet_getCapabilities` and `wallet_getCallsStatus` are proxied from the background directly to Porto Relay (HTTP) so dApps can poll without opening a popup. `wallet_sendCalls` goes through the popup for WebAuthn signing.

### Legacy provider shims

Provider deliberately keeps `isMetaMask: false` while exposing `isSigby: true`. Legacy methods are still implemented for older dApps: `enable()`, `send()`, `sendAsync()`, and `_metamask.isUnlocked()`. The first three log a deprecation warning; `_metamask.isUnlocked()` does not (it's the active wagmi/Web3Modal lock-state probe and gets called on every reconnect, so warning would flood dApp consoles). `enable()` and `sendAsync()` delegate to `request()`. `send()` mostly delegates too — except `send("net_version")` and `send("eth_chainId")` return cached chain info synchronously (these reads are lock-independent and pre-EIP-1193 dApps still call them in synchronous code paths). `send("eth_accounts")` and `send("eth_coinbase")` deliberately do **not** return the cached `selectedAddress` synchronously: they route through `request()` so the lock gate runs (the legacy sync path used to leak a stale unlocked address past a lock event). `_metamask.isUnlocked()` resolves via the private `_sigby_isLocked` RPC (visible to popup origin and connected origins; unconnected origins get a safe-default `true` so they can't poll for idle/active fingerprinting).

### Porto SDK (popup-side)

The popup's `popupPortoService` calls these against the Porto SDK:

- **Account / session:** `wallet_connect` (account create / select), `wallet_disconnect`, `eth_accounts`
- **Signing:** `personal_sign`, `eth_signTypedData_v4`, `wallet_sendCalls` (raw, full EIP-5792 pass-through)
- **Read:** `wallet_getCallsHistory`, `wallet_getCallsStatus`, `wallet_getAssets`, `wallet_getCapabilities`, `wallet_getPermissions`, `wallet_getKeys`, `health`
- **Permissions:** `wallet_grantPermissions`, `wallet_revokePermissions`

Why some of these *also* appear in the dApp-facing list above: the background's `wallet_getCapabilities` and `wallet_getCallsStatus` handlers proxy directly to Porto Relay over HTTP for dApp polling (no popup round-trip needed for reads), while the popup uses the SDK form for its own UI calls. They serve the same EIP-5792 contract from two surfaces.

## Project Layout

Pages live in `src/popup/pages/<Page>/index.tsx` with a sibling `use<Page>.ts` hook (and occasional helpers); the layout below names the directory, not the file.

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

Note: `src/popup/pages/Tokens/` has a `useTokens.ts` hook but no `index.tsx` route — the `/tokens` path redirects to `/`. The hook is kept because the token-list logic is consumed by Home.

The background does **not** instantiate the Porto SDK — there is no `src/background/portoService.ts`. WebAuthn requires a visible window, so all Porto SDK calls live in the popup.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

## Development

```bash
pnpm dev             # Vite watch mode — main bundle only (popup/background/content)
pnpm build           # Full production build (main + injected)
pnpm build:main      # Main bundle only
pnpm build:injected  # Injected provider only (page context, IIFE)
pnpm type-check      # tsc --noEmit
```

**Heads up:** `pnpm dev` does NOT watch `src/injected/provider.ts` — that build is separate. After editing the injected provider, re-run `pnpm build:injected` manually.

**Two builds, one extension.** The injected provider needs to run in the page's JavaScript context (not the content script's isolated context) so `window.ethereum` is reachable by dApps. It's bundled as an IIFE by a separate Vite config (`vite.injected.config.ts`) and loaded via `chrome.runtime.getURL("injected.js")`.

**After code changes**, reload the extension at `chrome://extensions` and refresh any open dApp tabs. The content script detects extension-context invalidation and emits a `disconnect` event, but a hard refresh is cleaner.

### Debugging

| Component       | Where to look                                                |
| --------------- | ------------------------------------------------------------ |
| Background      | `chrome://extensions` → **Service worker** link              |
| Content script  | DevTools on the dApp tab (Console shows `[ContentScript]`)   |
| Injected provider | Same DevTools, look for `[Sigby]`                          |
| Popup           | Right-click the Sigby popup → **Inspect**                    |
| Approval popups | Right-click the popup window → **Inspect**                   |

Most components log with a `[Component]` prefix. Actual prefixes in use:

- **dApp-visible** (page console): `[Sigby]` (injected provider)
- **Popup** (popup DevTools): `[Sigby:Popup]`, `[Store]`, `[App]`, `[ErrorBoundary]`, `[Watcher]`
- **Background** (service worker DevTools): `[Background]`, `[MessageHandler]`, `[DappManager]`, `[AccountManager]`, `[RpcHandler]`, `[TokenService]`, `[LockStatus]`
- **Content script** (dApp tab DevTools): `[ContentScript]`, `[DappBridge]`, `[ProviderInjection]`

Notable absences: there is no `[Storage]` prefix (`StorageManager` errors log bare strings like `Failed to get storage key "x"`), and no `[Sigby:BG]` (background uses `[Background]` and per-class prefixes instead). A handful of catch blocks — notably some approval-flow error logs and the `StorageManager` calls just mentioned — still go through bare `console.error` without a prefix; grep for the message text if you can't find a prefix match.

## Security

- **No private keys, ever.** WebAuthn keys live in hardware (Secure Enclave, TPM). The extension only stores account addresses and metadata.
- **Passkey naming is immutable.** The label shown in the Touch ID prompt is fixed at creation time. The extension's display name can change — the keychain label can't.
- **Per-origin isolation.** `eth_accounts` returns `[]` to unconnected dApps. `wallet_getCapabilities` refuses to reveal capabilities to unconnected origins. Chain switches only affect the requesting origin.
- **Origin validation.** `extractValidOrigin` (used by signing handlers and anything that persists origin metadata) reads `sender.origin` first, then derives from `sender.url`, and deliberately ignores both `sender.tab.url` (top-frame URL — would let a malicious iframe inherit the tab's permissions, since content scripts run with `all_frames: true`) and any `origin` field in the message body. The `handleDappRequest` top-level dispatch (`eth_accounts`, `eth_chainId`, `wallet_switchEthereumChain`, `wallet_getCapabilities`, `wallet_getCallsStatus`, etc.) takes `payload.origin` directly — that field is set by the content script from `window.location.origin` and is content-script-attested rather than dApp-attested. See `ARCHITECTURE.md#security-boundaries` for the two-path rationale.
- **CSP.** `connect-src` is restricted to Porto Relay and the configured public RPC endpoints.

The Porto relay and smart contracts have been audited by @MiloTruck, @rholterhus, and @kadenzipfel. See [porto.sh](https://porto.sh) for the bounty program.

## Requirements

- **Chromium 122+** — manifest gates on Chrome 122 (`minimum_chrome_version`) for the extension WebAuthn host-permissions RP-ID path used by Porto. Brave / Edge / Vivaldi work where they ship a Chromium ≥ 122 base.
- **Node 20+ and pnpm** for development (not enforced by an `engines` field; older toolchains may still work but aren't tested)
- A platform passkey provider — iCloud Keychain (macOS/iOS), Google Password Manager, 1Password, Bitwarden, or equivalent

## Limits & TODO

- **Custom chain addition** (`wallet_addEthereumChain` with non-built-in chains) — not yet supported.
- **Raw transactions** (`eth_sendRawTransaction`) — not implemented; Porto doesn't expose private keys so this is architectural.
- **NFTs** — Transaction Detail renders an "NFT" row (collection name/symbol, signed direction) when an asset diff has `type === "erc721"`. The row does **not** carry the token id or contract address — Porto's diff currently doesn't surface them and we haven't backfilled. No dedicated NFT inventory or transfer UI either.
- **EOA upgrade** (`wallet_prepareUpgradeAccount` / `wallet_upgradeAccount`) — pending.
- **Sponsored gas** — Transaction Detail shows a "Sponsored" badge + "Paid by sponsor" fee state, **detected heuristically** (no outgoing native asset diff for the chain matching the fee currency, see `useTransactionDetail.ts`). The relay's `capabilities.merchantUrl` field isn't actually inspected — without paymaster metadata the heuristic can't be exact, and edge cases (fee paid in ERC-20 but sponsor still covered native dust) may misclassify. The wallet UI also doesn't let *the user* configure or request sponsorship; it only surfaces sponsorship that the dApp arranged.

See [docs/PORTO_FEATURE_LIST.md](docs/PORTO_FEATURE_LIST.md) for the full status matrix.

## Acknowledgments

Built on [Porto](https://porto.sh) (SDK + Relay) by [Ithaca](https://ithaca.xyz). Ethereum client code from [viem](https://viem.sh). UI in React + Zustand + Tailwind. Bundled with Vite + `@crxjs/vite-plugin`.

## License

MIT
