# Architecture

How Sigby works — the component model, the message flows, and why the Porto SDK lives where it does.

## Table of Contents

- [The Big Picture](#the-big-picture)
- [Four Execution Contexts](#four-execution-contexts)
- [Why Porto SDK Lives in the Popup](#why-porto-sdk-lives-in-the-popup)
- [Message Flow: Connecting a dApp](#message-flow-connecting-a-dapp)
- [Message Flow: Sending a Transaction](#message-flow-sending-a-transaction)
- [Message Flow: Events](#message-flow-events)
- [Porto SDK Integration](#porto-sdk-integration)
- [State Model](#state-model)
- [Storage](#storage)
- [Per-Origin Chain Context](#per-origin-chain-context)
- [Security Boundaries](#security-boundaries)
- [Service Worker Death Recovery](#service-worker-death-recovery)
- [Build System](#build-system)

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                       dApp (Uniswap, etc.)                       │
│                                                                  │
│  window.ethereum.request({ method: 'eth_sendTransaction', ... }) │
└───────────────────────────────┬──────────────────────────────────┘
                  postMessage   │   (page context)
┌─────────────────────────────▼────────────────────────────────────┐
│   INJECTED PROVIDER   src/injected/provider.ts                   │
│   window.ethereum · EIP-1193 · EIP-6963 announce                 │
│   isSigby=true, isMetaMask=false, legacy shims                    │
└───────────────────────────────┬──────────────────────────────────┘
                  postMessage   │   (content-script boundary)
┌─────────────────────────────▼────────────────────────────────────┐
│   CONTENT SCRIPT     src/content/ (entry: index.ts)              │
│   providerInjection.ts — injects injected.js into page DOM       │
│   dappBridge.ts       — page ↔ extension bridge, origin check,   │
│                         context-invalidation monitor             │
└───────────────────────────────┬──────────────────────────────────┘
              chrome.runtime    │   (extension boundary)
                 .sendMessage   │
┌─────────────────────────────▼────────────────────────────────────┐
│   BACKGROUND SERVICE WORKER   src/background/                    │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  MessageHandler     routes all messages                 │    │
│   │  RpcHandler         read-only viem clients (multi-chain)│    │
│   │  AccountManager     multi-account state                 │    │
│   │  DappManager        connections, per-origin chain,      │    │
│   │                     pending approval queues             │    │
│   │  EventBroadcaster   EIP-1193 events → content scripts   │    │
│   │  TokenService       ERC-20 balances/metadata            │    │
│   └────────────────────────────────────────────────────────┘    │
└───────────┬───────────────────────────┬──────────────┬───────────┘
            │                           │              │
            │ fetch()                   │ opens popup  │ chrome.tabs
            │ (Porto Relay only for     │ for signing  │ .sendMessage
            │  getCapabilities /        │              │ (events)
            │  getCallsStatus; other    │              │
            │  reads → RpcHandler +     │              │
            │  viem to public RPCs)     │              │
            ▼                           ▼              │
┌──────────────────────┐   ┌──────────────────────────────┐
│   Porto Relay        │   │   POPUP    src/popup/        │
│   rpc.porto.sh       │   │   React · Zustand · Tailwind │
│                      │   │   ┌───────────────────────┐  │
│   Intent builder     │◄──│   │  Porto SDK            │  │
│   Fee quoter         │   │   │  WebAuthn prompts     │  │
│   Submitter          │   │   │  wallet_sendCalls     │  │
└──────────────────────┘   │   └───────────────────────┘  │
                           └──────────────────────────────┘
```

The key insight: **the Porto SDK runs in the popup, not the background.** Everything else is plumbing to get signing requests from dApps to the popup and results back.

## Four Execution Contexts

Manifest V3 extensions split into isolated JavaScript contexts. Sigby uses four:

| Context             | Lifetime                          | Can do                                                 | Cannot do                               |
| ------------------- | --------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| **Page**            | Per tab                           | Read/write `window.*`, be called by dApp code          | Use `chrome.*` APIs                     |
| **Content script**  | Per tab (isolated world)          | Use `chrome.runtime.*`, read DOM                       | Touch page's JS globals directly        |
| **Background SW**   | On-demand, may be killed anytime  | All `chrome.*` APIs, network, storage                  | Show UI, run WebAuthn                   |
| **Popup window**    | While open                        | Full DOM, WebAuthn, all `chrome.*` APIs                | Persist across closes                   |

The **injected provider** (`src/injected/`) runs in the page context so `window.ethereum` is reachable by dApp code. It communicates with the content script via `window.postMessage` — the only safe bridge across that boundary.

*Legacy provider shims in the injected provider:* announces `isSigby: true` and deliberately keeps `isMetaMask: false`; implements the legacy `enable()`, `send()`, `sendAsync()` methods (all log a deprecation warning); `enable()` and `sendAsync()` delegate to `request()` unconditionally, while `send()` has two narrow synchronous fast-paths — `send("net_version")` and `send("eth_chainId")` return cached chain info directly without a round-trip (lock-independent reads, and pre-EIP-1193 dApps still call them in synchronous code paths). `send("eth_accounts")` and `send("eth_coinbase")` deliberately route through `request()` even though `selectedAddress` is cached locally — the legacy sync path used to leak a stale unlocked address past a lock event, and the lock gate only runs on the async path. Exposes `_metamask.isUnlocked()`, which queries Sigby's lock-state RPC and falls back to `this.selectedAddress !== null` if background communication fails. The background additionally aliases `eth_sign` → `personal_sign` (the former is deprecated and insecure, but some old dApps still call it, with parameter order swapped to match `personal_sign`).

The **content script** (`src/content/`) runs in the isolated content-script world. It bridges page ↔ extension via `window.postMessage` one way and `chrome.runtime.sendMessage` the other.

The **background service worker** (`src/background/`) owns the extension's `chrome.storage.local` state (accounts, settings, dApp connections, persisted signing requests, etc.) and talks directly to Porto Relay for methods that don't need signing. Porto's own session / credential-id state lives in **popup-side IndexedDB** via `Porto.Storage.idb()`, not in the background — the background never instantiates Porto.

The **popup** (`src/popup/`) runs the Porto SDK and handles every WebAuthn prompt.

## Why Porto SDK Lives in the Popup

WebAuthn (`navigator.credentials.create` / `.get`) requires a **visible user activation** — a browser tab or popup window in focus. Service workers have no window, so they can't trigger Touch ID or Face ID. Chrome extensions offer an Offscreen Document API for this, but it can't receive user gestures and is primarily for media/audio use cases.

Porto needs WebAuthn for account creation, every transaction signature, and every message sign. That forces the SDK into a visible context.

The background service worker therefore **never instantiates the Porto SDK** — there is no `src/background/portoService.ts`. Any code path that would need Porto on the background side instead opens the popup (`chrome.windows.create` with `?view=…&requestId=…`) and lets the popup do the SDK call, then carries the result back via `APPROVE_SIGNING` / `APPROVE_CONNECTION` / equivalent.

The real implementation is `src/popup/portoService.ts`. It initializes once when the popup opens:

```ts
Porto.Porto.create({
  chains: SUPPORTED_CHAINS,              // viem chain objects
  mode: Porto.Mode.relay({ multichain: true, keystoreHost: 'id.sigby.xyz' }),
  storage: Porto.Storage.idb(),          // IndexedDB (persists across popup closes)
  announceProvider: false,               // we announce our own EIP-6963 from injected/
})
```

The SDK stores account metadata in IndexedDB (per-popup, per-origin). The passkey itself lives in the OS/browser's keychain — iCloud, Google Password Manager, 1Password — and syncs via whatever provider the user has configured. WebAuthn credentials are scoped to the `id.sigby.xyz` RP ID, not the extension ID.

## Message Flow: Connecting a dApp

1. dApp calls `window.ethereum.request({ method: 'eth_requestAccounts' })`
2. **Injected provider** generates a request ID, posts `{ type: 'SIGBY_REQUEST', requestId, method, params }` to its own window (the `requestId` is load-bearing — step 8 correlates the response back to the originating promise)
3. **Content script** (`dappBridge.ts`) listens on `window.message`, forwards via `chrome.runtime.sendMessage({ type: 'DAPP_REQUEST', payload: { method, params, origin }, requestId })` — the `requestId` is lifted to the top level so the background can include it in the response for step 7's correlation
4. **Background** (`messageHandler.ts`) receives the message. For `eth_requestAccounts`:
   - Load active account from `AccountManager`
   - Check `DappManager.isConnected(origin, accountAddress)`
   - If already connected → return `[accountAddress]` immediately
   - Else → `DappManager.requestConnection()` opens the popup with `?view=connect&origin=<origin>&account=<address>` (plus optional `&favicon=…&title=…` for the UI), and returns a Promise that resolves when the user approves/rejects. The `account` param is load-bearing — `ConnectionApproval` reads it to know which account is being granted access.
5. **Popup** (`pages/approval/ConnectionApproval/`) renders the origin, favicon, and title immediately. In a post-mount `useEffect`, it fires `IS_ORIGIN_KNOWN` and updates the UI with a first-visit security banner when the reply says this origin has never connected to any account on this installation. On approve, the popup first runs `popupPortoService.signCanary(accountAddress)` — this fires a fresh WebAuthn / passkey ceremony so connection approvals are biometric-gated to match every other approval path (without it, clicking "Approve" on a dApp connect screen would be a passkey-less way to extend the unlock session). Only after the canary succeeds does it send `APPROVE_CONNECTION` back to the background.
6. **Background** resolves the pending Promise → sends response back through the same chain
7. **Content script** posts `{ type: 'SIGBY_RESPONSE', requestId, result, error }` to the page. **Both fields are always present in the post** — `result` carries `response.data` (which is `undefined` on failure) and `error` carries `response.error` (which is `undefined` on success). The injected provider branches on `if (error)` truthiness, not on field presence. There's one exception: when `dappBridge` itself throws on the catch path (port closed, context invalidated), it posts a `SIGBY_RESPONSE` with `error` only and no `result` field — the injected provider's `if (error)` check still does the right thing
8. **Injected provider** finds the matching request by ID, resolves the dApp's original `request()` Promise

Note on IDs: there are two `requestId` namespaces and they are deliberately separate. The **dApp-facing requestId** (`crypto.randomUUID()` minted in the injected provider, validated by regex on arrival in the content script) correlates page ↔ content-script ↔ background ↔ content-script ↔ page — that's the chain step 8 unwinds. The **internal signing requestId** (`DappManager.generateRequestId()`) is minted inside the background when `requestSigning` opens an approval popup; it correlates background ↔ approval popup ↔ persisted `pendingSigningRequests` row. The internal ID never reaches the dApp or the content script. They share a UUID format and the same field name, but they live in different layers — don't conflate. ⚠ This separation is **load-bearing for an open bug**: the content-script polling fallback (see Service Worker Death Recovery) polls `pendingSigningRequests` using the dApp-facing requestId, but persisted rows are keyed by the DappManager-internal requestId. They never match, so the fallback always returns `not-found` and the dApp surfaces "Request lost (wallet background restarted)" even when the row is alive. Listed here, fixed in `Service Worker Death Recovery`.

The popup window auto-closes. Subsequent `eth_requestAccounts` calls from the same origin short-circuit at step 4 with the stored connection.

## Message Flow: Sending a Transaction

This is where it gets interesting. dApp-originated signing requires a trip through the popup so the user can approve and WebAuthn can prompt.

```
dApp: wallet_sendCalls → injected → content → background
                                                 │
                                                 │ DappManager.requestSigning({
                                                 │   method, params, origin,
                                                 │   accountAddress, chainId, metadata
                                                 │ })
                                                 ▼
                                         chrome.windows.create({
                                           url: 'src/popup/popup.html?view=<view>&requestId=...',
                                           type: 'popup', 400x600
                                         })
                                         view routing:
                                           eth_sendTransaction      → transaction
                                           wallet_sendCalls         → transaction
                                           wallet_grantPermissions  → grant-permissions
                                           personal_sign            → sign
                                           eth_signTypedData_v4     → sign
                                                 │
                                                 ▼
popup renders TransactionApproval page
popup: GET_PENDING_SIGNING → background → returns full request
popup: eth_estimateGas       → background → RpcHandler + viem →
                                public chain RPC (optional, best-effort)
popup: getCapabilities       → Porto SDK → Relay → fee tokens for chain
                              (SDK call, not a direct HTTP fetch)
user picks fee token (USDC / USDT / native), clicks Approve
                                                 │
                                                 ▼
popup: popupPortoService.ensureAccountAuthorized()
       → triggers WebAuthn if needed
popup: popupPortoService.sendCallsRaw({
         ...originalParams,
         capabilities: {
           ...otherCapabilities,   // merchantUrl, permissions, …
           feeToken,               // user choice OR dApp's locked pin
         }
       })
       → Porto SDK signs with passkey (Touch ID prompt)
       → Porto Relay submits intent
       → returns { id: bundleId }
                                                 │
                                                 ▼
popup: APPROVE_SIGNING → background
       carries { requestId, result: bundleId }
background: DappManager.approveSigning() resolves the
            Promise that was pending since step 2
background: handleWalletSendCalls returns
            { success: true, data: { id: bundleId } }
            — the { id: … } wrapping is added at the background
            boundary so the dApp receives the EIP-5792 shape
            (Only eth_sendTransaction results are written to the
             local transactionHistory; wallet_sendCalls bundles are
             not persisted — Porto's wallet_getCallsHistory is the
             source of truth for bundles.)
                                                 │
                                                 ▼
content script posts SIGBY_RESPONSE to page
injected provider resolves dApp's wallet_sendCalls() promise
popup window auto-closes
```

A few subtleties:

- **Deduplication.** `DappManager` derives a dedupe key from `method:origin:<32-bit rolling hash of JSON.stringify(params)>` — a cheap non-cryptographic fingerprint, not a real hash. If the dApp fires the same call twice (common in React strict mode), the new caller's `resolve`/`reject` are chained onto the existing pending Promise — no second popup, no second WebAuthn prompt. Both callers get the same result when the first one settles.
- **FIFO approval-window queue.** Connection and signing approvals share a single in-flight slot — `DappManager` tracks `approvalReserved` (set synchronously before any await, so two callers racing in the same tick can't both pass the gate) plus the existing `windowToRequest` map. When the slot is busy, new approval requests land in `approvalQueue` and `chrome.windows.create` is held back until the current approval window closes. `drainApprovalQueue` runs after every window-close to release the slot and open the next entry. Without this, two concurrent dApp signing requests would race-create two popup windows, each eating focus — and on some platforms only the second one would actually receive WebAuthn input. The queue serialises the user-visible flow without serialising the underlying message handlers (each request still has its own `pendingSigningRequests` entry).
- **Window close — asymmetric handling.** `chrome.windows.onRemoved` is tracked via `windowToRequest`. **Signing** requests are intentionally not auto-rejected on window close — the user may have dismissed the popup intending to resume later via the toolbar popup's pending-approvals queue. The 5-minute timeout still fires if they never come back; explicit Reject still works. **Connection** requests are *intended* to auto-reject on window close — `handleWindowClosed` calls `requestInfo.id.split(":")` to recover the `${origin}:${accountAddress}` request key. ⚠ This is broken for normal `https://…` origins, which themselves contain a `:`. The split returns `["https", "//example.com", "0x…"]` instead of the expected two-element pair, the recovered tuple doesn't match the `requestKey` in `pendingRequests`, `rejectConnection` no-ops, and the request waits for the 2-minute connection timeout instead of rejecting promptly. Until that's fixed, treat window-close on a connection popup as "wait for the timeout" rather than "instant reject" — explicit Reject still works.
- **Timeouts.** Connection requests time out at 2 minutes, signing at 5 minutes. `approveSigning` / `rejectSigning` / `approveConnection` / `rejectConnection` all call `clearTimeout` on settlement; a `pendingSigningRequests.has(requestId)` / `pendingRequests.has(requestKey)` guard inside each timeout callback is the belt-and-braces backstop for the cold-start / race case where the in-memory handle doesn't exist but the timer still fires.
- **Fee token priority — dApp pin wins.** On `wallet_sendCalls`, the dApp can include `capabilities.feeToken` as a hard requirement (e.g. a merchant that wants USDC). When that's present, `TransactionApproval` **locks** the picker to the dApp's choice (`dappRequiredFeeToken ?? selectedFeeToken ?? feeTokens[0]?.symbol`) and blocks approval if the required token isn't available — but only when the chain's fee-token list actually loaded with content. If `feeTokens` is empty (discovery failed or the chain reports no supported fee tokens), the gate falls open and approval continues; otherwise a transient relay outage would brick every dApp that pins a fee token. Only when the dApp doesn't pin a fee token does the user's dropdown selection take effect. The legacy `eth_sendTransaction` path has no `capabilities` slot, so the user's choice always wins there.
- **Two call paths in the popup.** `wallet_sendCalls` goes through `popupPortoService.sendCallsRaw(rawParams)` — an EIP-5792 pass-through that preserves the dApp's full multi-call `calls[]` and most capabilities. The one capability that does **not** pass through verbatim is `feeToken`: `TransactionApproval` strips `capabilities.feeToken` from the dApp's payload and replaces it with the user-selected (or dApp-pinned) value before forwarding. The fee-token slot is the only call site where the user's UI pick can override what the dApp sent; everything else under `capabilities` (merchantUrl, permissions, requiredFunds, …) is passed straight through. `eth_sendTransaction` goes through `popupPortoService.sendTransaction({ from, to, value, data, chainId, feeToken })` — a legacy single-call wrapper that also polls `wallet_getCallsStatus` to return a real transaction hash (because dApps expect one from `eth_sendTransaction`, not a bundle ID).
- **`from`-pinning rejected up front.** Before opening the popup, both `handleWalletSendCalls` and `handleEthSendTransaction` reject requests whose `from` field pins an address other than the currently-active account, returning RPC code `4100 (UNAUTHORIZED)`. dApps can't silently force a sign with a different account — the approval UI shows the active account, and that's the only one that's going to sign.

## Message Flow: Events

EIP-1193 defines four lifecycle events: `accountsChanged`, `chainChanged`, `connect`, `disconnect`. They flow the **opposite** direction — from background outward to the affected tabs. **All four are origin-scoped only** — the event broadcaster has no global fan-out method:

```
background: accountManager.switchAccount(newAddress)
            → for each connected origin on the new account:
              eventBroadcaster.accountsChangedForOrigin([newAddress], origin)
                 │
                 ▼
            chrome.tabs.query({}) → keep only tabs where
            new URL(tab.url).origin === origin (tabs with no tab.url
            or malformed URLs are silently skipped; tabs with no
            content script loaded silently fail the sendMessage and
            are skipped too — this is most tabs in practice):
              chrome.tabs.sendMessage(tabId, {
                type: 'EMIT_EVENT',
                event: 'accountsChanged',
                data: [newAddress]
              })
                 │
                 ▼
content script (dappBridge) receives, posts SIGBY_EVENT to page
injected provider emits to all registered listeners
dApp's provider.on('accountsChanged', ...) fires
```

`EventBroadcaster` exposes only origin-scoped methods: `accountsChangedForOrigin(accounts, origin)`, `chainChangedForOrigin(chainId, origin)`, `connectForOrigin(chainId, origin)`, and `disconnectForOrigin(origin, error)`. The earlier global-fanout variants (`accountsChanged([])`, `disconnect(error)`) were removed — every event now requires the caller to name the origin(s) it applies to. Actual call sites:

- `accountsChangedForOrigin` — fires from `accountManager` (active-account switch, account deletion) and `dappManager.disconnect` to notify the previously-connected origins.
- `chainChangedForOrigin` — fires from `messageHandler.handleWalletSwitchChainForOrigin` (the EIP-3326 dApp-initiated path).
- `disconnectForOrigin` — fires from `accountManager` (account deleted) and `dappManager.disconnect` (explicit per-origin or per-account disconnect).
- `connectForOrigin` — defined but currently has no call sites in the background. The `connect` event a dApp actually receives on first connection is emitted **client-side by the injected provider** the first time `eth_chainId` resolves successfully (`src/injected/provider.ts` — `hasEmittedConnect` guard, fires once per page lifetime). Wagmi-style connectors block on this event, so emitting it from the injected side guarantees they unblock as soon as the provider can answer chain queries — independent of whether the background ever sent any event.

There's one more disconnect path that **doesn't** go through the broadcaster at all: when the content script detects extension-context invalidation (the periodic `chrome.runtime.id` check fails — extension reloaded, updated, or the SW is permanently dead), `dappBridge.ts` directly emits `disconnect` to the page from the content side. The background isn't involved because by definition it isn't reachable. This implements EIP-3326's "chain change only affects the requesting dApp" rule for `chainChanged` and applies the same per-origin discipline to account changes and explicit disconnects.

## Porto SDK Integration

The wallet interacts with Porto at three levels:

**1. Via the SDK in the popup** — for anything that needs signing.

```ts
// src/popup/portoService.ts
await provider.request({ method: 'wallet_connect', params: [{ capabilities: { createAccount: { label } }, chainIds }] })
await provider.request({ method: 'wallet_sendCalls', params: [{ calls, chainId, capabilities: { feeToken } }] })
await provider.request({ method: 'personal_sign', params: [message, account] })
await provider.request({ method: 'wallet_grantPermissions', params: [{ expiry, permissions, feeToken, key? }] })
// `feeToken` is nullable (Porto schema): `null` means "this session key cannot pay
// fees at all". When non-null, `feeToken.limit` is required; both the popup-side
// PopupPortoService.grantPermissions and the background dApp-facing handler
// validate this up front so the SDK's zod error doesn't leak to the dApp.
// `key` is optional; if omitted Porto generates a fresh session key.
```

The dApp-originated `wallet_grantPermissions` is also a full first-class approval flow (not a pure read). The background handler (`messageHandler.handleWalletGrantPermissions`) routes through `DappManager.requestSigning` with `view=grant-permissions`, the popup's `GrantPermissionsApproval` page surfaces the requested permissions / spend limits / expiry, and on approve the popup calls `popupPortoService.grantPermissions(...)` against the Porto SDK. The popup then `JSON.stringify`s the returned `GrantedPermission` object and sends it via `APPROVE_SIGNING` (whose `result` field is typed as `string`); the background `JSON.parse`s that envelope back to the native shape before returning to the dApp. The string-encoding is a property of the popup→background message channel, not of the Porto SDK return value — Porto returns a structured object, the popup serializes it solely to fit it through the typed message bus.

**2. Via the SDK for read-only Porto methods** — history, assets, permissions, keys, capabilities, health. Still from the popup because the SDK holds the provider instance and session state.

```ts
await provider.request({ method: 'wallet_getCallsHistory', params: [{ address, limit: 50, sort: 'desc' }] })
await provider.request({ method: 'wallet_getAssets', params: [{ account, chainFilter, assetTypeFilter: ['erc20', 'native'] }] })
await provider.request({ method: 'wallet_getKeys', params: [{ address }] })
```

The popup-side SDK also handles two **state-mutating** but non-signing methods that don't get separate sections above:

- `wallet_revokePermissions` — revokes a session key by ID. Called from the Permissions page when the user taps revoke; SDK updates Porto's IDB and emits the change to the relay.
- `wallet_disconnect` — drops the popup's in-memory Porto session for the active account. Called when the user explicitly signs out / removes an account. Doesn't touch the platform passkey (that stays in the keychain), only Porto's local session state.

Both run in the popup for the same reason all the other Porto calls do — the SDK lives there.

**3. Via direct `fetch` to Porto Relay** — from the background, for dApp-originated read-only EIP-5792 methods. These don't need signing, don't need a popup, and must be fast.

Two additional dApp-facing wallet methods are handled entirely in the background without any Porto round-trip: `wallet_requestPermissions` (EIP-2255) wraps `eth_requestAccounts` in the EIP-2255 caveat envelope, and `wallet_getPermissions` returns `[]` — Porto-aware dApps expecting session-key permissions fall back to `eth_accounts` for connectivity, which is what we can serve from the background.

```ts
// src/background/messageHandler.ts — wallet_getCapabilities handler
const response = await fetch(PORTO_CONFIG.RELAY_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'wallet_getCapabilities',
    params: [chainIdsNumeric],  // relay schema requires decimal, not hex
  }),
})
```

This is a deliberate shortcut. `wallet_getCapabilities` and `wallet_getCallsStatus` are pure reads — proxying them through the popup would require opening a popup window for each dApp poll, which is unacceptable. Both call sites hit the Relay at `PORTO_CONFIG.RELAY_URL` (`https://rpc.porto.sh`) via `fetch`.

**Not just proxying — reshaping.** Neither Relay-backed handler is a pure pass-through:

- `handleWalletGetCapabilities` — the relay returns a `{ contracts, fees, … }` Porto-internal shape; the background flattens that into the EIP-5792 `{ atomic, feeToken: { supported, tokens }, merchant, permissions, requiredFunds, ...passthrough }` shape and strips the relay-internal `contracts` / `fees` fields. (An earlier version of this handler also emitted an `atomicBatch` field; it was dropped because it isn't in Porto's schema and we didn't want dApps coming to rely on a field that would disappear.)
- `handleWalletGetCallsStatus` — the relay returns an object `{ status, receipts, atomic, capabilities }` and the background re-wraps it into the EIP-5792 envelope `{ version: "1.0", id: bundleId, chainId: <hex>, atomic, status, receipts, capabilities }`. `chainId` is taken from the first receipt when present, otherwise derived from the requesting origin's per-origin chain (so polls during chain switches still return a meaningful value); `atomic` defaults to `true` when the relay doesn't explicitly say otherwise. dApps can `switch (status)` and read `chainId` / `atomic` directly without looking for absent envelope fields.

Both match what the Porto SDK's own helpers would return from the popup — same SDK-parity logic, implemented at the background boundary to avoid a popup round-trip.

Note: other dApp-originated read methods (`eth_getBalance`, `eth_call`, `eth_estimateGas`, `eth_blockNumber`, `eth_getTransactionCount`, `eth_getCode`, `eth_getTransactionReceipt`, `eth_getTransactionByHash`, `eth_gasPrice`) do NOT go to Porto Relay — they go through `RpcHandler` + viem clients to public chain RPCs (the ones listed in `manifest.json` `host_permissions` and the CSP `connect-src`).

### Porto Request Shape

Porto uses `wallet_connect` with capability flags for account creation vs selection:

```ts
// Create new — label resolves to keychainLabel || displayName || 'Sigby',
// typically "Sigby <N>" based on accountCount
{ capabilities: { createAccount: { label: 'Sigby 2' } }, chainIds: [...] }

// Select existing
{ capabilities: { selectAccount: true }, chainIds: [...] }
```

The `label` in `createAccount` becomes the passkey name shown in Touch ID — **immutable**. The extension's display name (editable later) is stored separately in `chrome.storage.local`.

`chainIds` is the list of chains the account should be usable on. Porto's EIP-7702 authorization uses `chainId=0`, making the account available on every specified chain at the same address.

### Transaction Lifecycle

`wallet_sendCalls` returns `{ id: bundleId }` immediately after the Relay submits the intent. The bundle is not yet mined. On the **legacy `eth_sendTransaction` path only**, `popupPortoService.sendTransaction` calls an internal (private) helper `waitForTransactionHash(bundleId)` that polls `wallet_getCallsStatus` every 2 seconds for **up to 30 attempts (~60 seconds)**. The poll has three exit paths:

- **Success with receipt** — `receipts[0].transactionHash` arrives → return it.
- **Confirmed without receipt** — Porto status `200` and no receipts → return the `bundleId` as the best identifier we have.
- **Terminal failure** — Porto status falls in the failed band (`isPortoStatusFailed` matches the 3xx offchain / 4xx-5xx onchain revert codes) → throw a `ProviderRpcError` so the dApp's `eth_sendTransaction` promise rejects, instead of silently handing back a `bundleId` that looks like a successful tx hash but actually represents a failed bundle.

If the loop simply runs out of attempts on transient/`pending` (1xx) statuses without ever hitting a terminal one, it falls back to returning the `bundleId` — `eth_sendTransaction` dApps expect a prompt response, and if confirmation hasn't arrived in a minute the dApp will poll on its own.

For EIP-5792-aware dApps calling `wallet_sendCalls` directly, the background returns the `bundleId` without waiting, per spec. The dApp polls status itself.

## State Model

**Authoritative state** lives in `chrome.storage.local` (background-owned), with one carve-out: **lock state lives in `chrome.storage.session`** under `lastUnlockedAt` (`SESSION_STORAGE_KEYS.LAST_UNLOCKED_AT`). Session storage clears on browser restart, which is exactly the lock semantics we want — relaunching the browser re-locks the wallet without us tracking that explicitly. **Both contexts touch this key, in three different shapes:**

- **Popup unlock** writes the current timestamp (`chrome.storage.session.set({ lastUnlockedAt: now })`).
- **Popup explicit lock** *removes* the key (`chrome.storage.session.remove`) — the gate's "missing or stale" branch then reads as locked. Removal rather than zeroing keeps the in-memory cache and the storage shape in sync (`null` vs absent vs `0` would otherwise be three states answering the same question).
- **Popup `setAutoLockMinutes`** refreshes the timestamp **only when the wallet is currently unlocked** — the rationale is that changing the preset is itself user activity, but bumping the stamp while locked would silently unlock. The bump runs *before* the settings write so the background's `isLocked()` re-compute under the new (possibly tighter) window doesn't retroactively classify prior idle time as expired and fire a spurious lock transition.
- **Background `lockStatus.persistUnlock()`** writes the timestamp after approved dApp connection and signing flows — those approvals already required a fresh WebAuthn ceremony in the popup, so leaving the lock counter stale would force a redundant biometric on the next popup open.

The background's `lockStatus.ts` calls `chrome.storage.onChanged.addListener(...)` (the global storage-change channel; Chrome doesn't expose a per-area `chrome.storage.session.onChanged` shorthand) and filters on `area === "session"` for the unlock key and `area === "local"` for settings changes. It keeps an in-memory mirror so that lock-gated RPC paths (`_sigby_isLocked`, the per-method `LOCK_GATED_METHODS` table in `handleDappRequest`) can answer synchronously without a per-request `chrome.storage.session.get`; the listener is also what tells the background to react to popup-side writes.

Note: the on-transition broadcaster (`broadcastLockTransition` in `background/index.ts`) is intentionally a no-op — `EventBroadcaster` does not consult lock state at all; the dApp-facing lock surface is purely the per-call gate inside `handleDappRequest`, not a `chainChanged` / `disconnect` storm at lock time.

The popup's Zustand store is a cache synced on mount:

```ts
// src/popup/App.tsx (simplified — actual code wraps in try/catch/finally
// and toggles an `initializing` flag to gate the first render)
useEffect(() => {
  async function initialize() {
    await popupPortoService.initialize()
    await syncStoreWithBackground()  // GET_STATE → populates Zustand
  }
  initialize()
}, [])
```

### Background-owned (chrome.storage.local)

| Key                    | Shape                                               |
| ---------------------- | --------------------------------------------------- |
| `accounts`             | `Record<address, Account>`                          |
| `activeAccount`        | `address`                                           |
| `accountOrder`         | `address[]` (UI display order)                      |
| `accountCount`         | `number` (monotonic counter for keychain labels)    |
| `accountDapps`         | `Record<address, Record<origin, ConnectedDapp>>` — each `ConnectedDapp` carries its own `chainId`, driving per-origin chain context (see below) |
| `settings`             | `{ defaultChain, autoLockTimeout, hasCompletedOnboarding, ... }` |
| `transactionHistory`   | `Transaction[]` (last 100)                          |
| `customTokens`         | `Record<address, Record<chainId, tokenAddress[]>>`  |
| `tokenMetadataCache`   | `Record<"${tokenAddress}:${chainId}", TokenMetadata>` (composite key — same `address` can have different metadata per chain) |
| `pendingSigningRequests` | `Record<requestId, PersistedSigningRequest>` — persisted approval queue + cold-start recovery (see below) |
| `account` *(legacy)*   | Single-account record from pre-multi-account installs; consumed by `migrateToMultiAccount` and never written by current code |
| `connectedDapps` *(legacy)* | Single-account dApp connections from pre-multi-account installs; same migration consumer |

Plus one **`chrome.storage.session`** key:

| Key                  | Shape                                                            |
| -------------------- | ---------------------------------------------------------------- |
| `lastUnlockedAt`     | `number` — ms timestamp of the last successful popup unlock; absent or stale-vs-`autoLockTimeout` ⇒ locked. Cleared on browser restart. |

### Popup-owned (Zustand, session-only)

- Multi-account map mirror (fetched from background): `accounts`, `accountOrder`, `activeAddress`
- Network: `chainId`, `chainCommittedAt` (timestamp of last confirmed `SWITCH_CHAIN` reply — used to gate one-shot signature-motion beats so unrelated re-renders don't re-fire them)
- `assets` — flat `PortoAsset[]` for the currently selected `(address, chainId)`. Freshness uses `assetsLastFetched` (advances on success only, drives the 30s TTL) and `assetsLastAttemptedAt` (advances on completion regardless of success — read this for "have we tried yet?" UX gates). The array is reset to `[]` on address or chain switch (not cached across switches).
- `pendingTransactions` — bundle IDs being watched by `useTransactionWatcher`
- `historyRefreshTrigger` — incremented on confirmation to force History page refetch
- `permissions`, `permissionsLoading`, `permissionsNeedAuth` — session-key list + cold-load auth gate
- `accountKeys`, `keysLoading`, `keysNeedAuth` — authorized-keys list + cold-load auth gate
- `relayHealth`, `relayHealthLoading` — Settings relay health card
- Lock: `isUnlocked`, `unlockedAt`, `autoLockMinutes` (cached from `settings.autoLockTimeout`)
- Onboarding: `hasCompletedOnboarding` (persisted mirror), `isOnboardingActive` (in-memory gate decoupled from `hasCompletedOnboarding` so the "You're set" success transition doesn't tear down the flow before it can render)
- `celebrations` — per-kind timestamps of the latest celebration event (e.g. `passkey-success`); views compare last-seen timestamps to advance one-beat animations, never on value equality
- Connection: `isAuthenticated`
- UI flags: `isLoading`, `error`, `errorAt` (for DismissibleError countdown persistence across tab switches), `isAccountSwitcherOpen`, `showTestnets`
- Actions co-located in the same store: account CRUD mirror, chain switch, lock/unlock, onboarding transitions, asset/permission/key fetchers, celebration emitters, etc.

### Popup-owned (IndexedDB, cross-popup persistence)

Porto SDK's own storage — account metadata, session state, a mapping from account address to its credential ID (so the SDK knows which passkey to ask for). The **private key material never lives here** — it stays in the platform keychain (Secure Enclave / TPM / iCloud / Google Password Manager) and is only accessed via WebAuthn ceremonies. Managed entirely by Porto; the extension never reads or writes it directly.

## Storage

Five storage layers, each with a different purpose:

| Layer                    | Owner          | Scope                          | Used for                                   |
| ------------------------ | -------------- | ------------------------------ | ------------------------------------------ |
| Platform keychain        | OS / browser   | Synced across devices          | Passkey private keys (we never see them)   |
| `chrome.storage.local`   | Background SW  | Per-profile, persistent        | Accounts, settings, connections, history   |
| `chrome.storage.session` | Popup + Background SW (both write; background also mirrors via onChanged) | Per-profile, cleared on browser restart | Lock state (`lastUnlockedAt`) |
| IndexedDB (in popup)     | Porto SDK      | Per-origin, persistent         | Porto session state + credential-ID lookup |
| Zustand                  | Popup React    | While popup is open            | UI state, caches                           |

`chrome.storage.local` wraps in `StorageManager` (`src/utils/storage.ts`) — typed, with migration support. The first time the background starts after an upgrade, `migrateToMultiAccount()` runs and moves any legacy single-account data into the new multi-account layout. The migration is idempotent.

## Per-Origin Chain Context

EIP-3326 (`wallet_switchEthereumChain`) says a chain switch should only affect the requesting dApp. Many wallet implementations treat chain switching as global, so every open dApp sees `chainChanged`. Sigby implements it per-origin.

Each `ConnectedDapp` entry in `accountDapps` carries its own `chainId`. `DappManager.getChainIdForOrigin(origin, address)` returns that, falling back to `settings.defaultChain`. When a dApp calls `wallet_switchEthereumChain`:

1. Validate chain is in `CHAIN_CONFIGS`
2. Update `accountDapps[address][origin].chainId`
3. `eventBroadcaster.chainChangedForOrigin(newChainId, origin)` fires `chainChanged` **only to tabs matching that origin**

Other connected dApps keep their chain. This means Uniswap can be on Base while another dApp is on Arbitrum, simultaneously, in the same browser session.

The popup's selected chain (shown in the header) is the **global default** — it drives the wallet's own Send / Receive / Tokens pages, is what `eth_chainId` returns to unconnected origins, and is the fallback chain new dApp connections inherit if they don't pin one. Switching it via the header `ChainSwitcher` fires `SWITCH_CHAIN`, which updates `settings.defaultChain` and **intentionally does NOT broadcast** `chainChanged`: already-connected dApps that established a per-origin chain via `wallet_switchEthereumChain` keep it, because stomping on their chain from a wallet-side UI action would break EIP-3326's contract. Per-origin switches flow through the separate `handleWalletSwitchChainForOrigin` path, which fires `chainChangedForOrigin` only to the requesting origin's tabs.

**Popup-originated reads override per-origin chain.** When the popup makes its own RPC calls (e.g., `eth_getBalance` for the UI), it sends `DAPP_REQUEST` with an explicit `chainId` on the payload. `messageHandler.handleDappRequest` applies chain resolution in this order: `payload.chainId` (set by the popup, wins) → per-origin chain (`dappManager.getChainIdForOrigin`) → `settings.defaultChain`. The popup uses this to query balances for whatever chain the UI is showing, independent of what a connected dApp is on.

## Security Boundaries

**Origin validation — two paths.** Sigby has two distinct origin-resolution strategies depending on which message channel a request arrives on:

1. **Strict path — `extractValidOrigin(sender, providedOrigin)` in `src/utils/validators.ts`** — used by signing handlers (`handlePersonalSign`, `handleSignTypedData`, `handleEthSendTransaction`, `handleWalletSendCalls`, `handleWalletGrantPermissions`) and any handler whose decision will end up persisted as dApp-connection metadata. Reads `sender.origin` first (Chrome populates this with the **frame's** origin and it's authoritative for permission decisions), then falls back to deriving an origin from `sender.url`. Each candidate is gated by `isValidOrigin`. Two sources are deliberately **not** consulted: `sender.tab.url` (the top-frame URL — using it would let a malicious iframe inherit the tab's permissions, since content scripts run in every frame via `all_frames: true`) and the message body's `origin` field (untrusted at this layer). The `providedOrigin` parameter is accepted for backward-compatibility callers but ignored.

2. **Trusted-channel path — `payload.origin` straight from `DAPP_REQUEST`** — used by `handleDappRequest`'s top-level dispatch (`eth_accounts`, `eth_chainId`, `wallet_switchEthereumChain`, `wallet_getCapabilities`, `wallet_getCallsStatus`, etc.) and by popup-originated internal messages (`CONNECT_ACCOUNT_DAPP`, `DISCONNECT_ACCOUNT_DAPP`, `APPROVE_CONNECTION`, …). For DAPP_REQUEST the safety argument is: the content script sets `payload.origin = window.location.origin` and validates `event.origin === window.location.origin` on every inbound `postMessage` before forwarding (`dappBridge.ts:115`), so the field is content-script-attested rather than dApp-attested. For popup-originated messages the popup itself is trusted code; the popup's `chrome-extension://` origin would in fact **fail** `extractValidOrigin` (which only accepts `http:` / `https:` schemes via `isValidOrigin`), which is exactly why the popup carries the relevant dApp origin in the payload — the popup isn't trying to authenticate as the dApp, it's relaying a decision about that dApp's connection state.

The strict path is the right default whenever the handler is acting on a dApp's behalf and will write origin into persistent storage (connection metadata, signing-request rows). The trusted-channel path is the only option for popup-originated decisions about a dApp (extension origin can't satisfy the strict path's HTTP-only rule), and it's fine for stateless dApp reads where the content-script attestation already gives us a verified origin.

**EIP-1193 event allowlist.** The content-script bridge only forwards `accountsChanged`, `chainChanged`, `connect`, `disconnect`, and `message` from `EMIT_EVENT` frames — the `KNOWN_PROVIDER_EVENTS` list in `dappBridge.ts`. Any other event name coming through the bridge is dropped silently, so a compromised background couldn't inject arbitrary event names into the page's provider.

**Per-origin account visibility.** `eth_accounts` returns `[]` for unconnected origins even if the user has an active account. `wallet_getCapabilities` returns `{}` for unconnected origins. This prevents fingerprinting.

**postMessage origins.** The injected provider and content script both validate `event.origin === window.location.origin` before processing messages. Cross-frame exploits can't inject fake responses.

**Extension context monitor.** The content script polls `chrome.runtime.id` every 30s. If the extension is reloaded (id becomes undefined), the orphan content script emits `disconnect` to the page and stops listening, so dApps get a clean failure mode instead of silent dropped requests.

**CSP.** `manifest.json` restricts `connect-src` on extension pages to Porto Relay + the configured public RPC endpoints. `script-src 'self'; object-src 'self'`. No `unsafe-inline`, no `unsafe-eval`. No `frame-src` is set — the extension doesn't iframe anything itself (Porto's `id.porto.sh` iframe flow isn't used because WebAuthn happens directly in the popup via relay mode).

**Two-stage error mapping at the dApp boundary.** Every signing-handler response passes through `messageHandler.toDappErrorResponse`, which classifies the thrown error into exactly two shapes:

- **User reject → `{ code: 4001, message: "User rejected the request" }`.** `DappManager.rejectSigning` throws `Error("User rejected the signing request")`; WebAuthn platform-authenticator cancels surface as `"not allowed"` / `"cancelled"` / `"canceled"`. The `Error`'s structured code doesn't survive stringification, so `toDappErrorResponse` re-derives 4001 by lowercasing the message and matching any of: `user rejected`, `user denied`, `user cancel`, `not allowed`, `cancelled`, `canceled`. dApps' `if (err.code === 4001)` branches fire whether the rejection came from the popup, the user, or the authenticator.
- **Everything else → `{ code: -32603, message: <humanized> }`.** `mapPortoError` rewrites the raw error message into one of a handful of canonical strings — `INSUFFICIENT_FUNDS`, `NETWORK_ERROR`, `WEBAUTHN_TIMEOUT`, `"Transaction nonce conflict. Please try again."`, `"Transaction would revert. Check contract conditions."`, etc. — based on substrings. Keeps the dApp-facing error banners legible instead of leaking raw SDK / relay internals.

**Provider method-locking.** After the injected provider is instantiated, its EIP-1193 method surface (`request`, `on`, `removeListener`, `emit`, and the legacy `enable`/`send`/`sendAsync` shims) is sealed with `Object.defineProperty({ writable: false, configurable: false, enumerable: true })`. The `_metamask` shim object is additionally frozen. This defeats hostile page scripts that would try `provider.request = evilFn` to hijack in-flight dApp calls after the EIP-6963 announcement has gone out. State fields (`chainId`, `selectedAddress`, `isConnected`) stay mutable because the provider updates them on events.

**External messages rejected.** `chrome.runtime.onMessageExternal` — the channel by which web pages or other extensions can send messages directly to Sigby's background — is registered but unconditionally responds with `{ success: false, error: "External messages not supported" }`. All legitimate dApp traffic flows through the content-script bridge, which lets us apply origin validation uniformly.

**First-visit origin check.** On connection approval, `ConnectionApproval` fires an `IS_ORIGIN_KNOWN` message to the background from a post-mount `useEffect` — the origin / favicon / title render immediately, then the security-banner state updates when the reply arrives. If the origin has never been connected to any account on this installation, the UI shows a "first-visit" banner so the user knows this is a new counterparty rather than a routine re-approval.

**No private key material in the extension.** The only keys we touch are passkey _public_ keys (for display in the Authorized Keys list). Private keys live in the Secure Enclave / TPM and are only accessible via WebAuthn ceremonies gated on biometric verification.

## Service Worker Death Recovery

MV3 service workers can be killed at any time — Chrome terminates idle ones after ~30 seconds, and anything can force a restart (extension update, user reload, OS reclaim). A signing request in flight when the SW dies would normally hang the dApp's `await provider.request(…)` forever. Sigby prevents that with a three-part recovery subsystem:

**1. Persist before prompting (best-effort).** `DappManager.requestSigning` calls `persistSigningRequest(...)` to write the full request to `chrome.storage.local` under `pendingSigningRequests` and then immediately opens the popup window (`openSigningPopup`) — the persist call is fire-and-forget (`.catch(...)` logs failures), **not** awaited. In the common case the storage write completes before the popup actually mounts and asks for the request, but the system tolerates the rare race: the popup's `GET_PENDING_SIGNING` reads the in-memory `pendingSigningRequests` map first (which is set synchronously) and only falls back to the persisted row if the in-memory entry is gone (e.g. SW death). The persisted row is what the content-script polling fallback and the cold-start orphan sweep both read.

**2. Content-script polling fallback.** When `chrome.runtime.sendMessage` from `dappBridge.ts` fails with "message port closed" on a recoverable method, the bridge switches to polling: every 2 seconds, it sends `POLL_SIGNING_REQUEST` with the `requestId` and reads the persisted row's `state`. When the state flips to `approved` or `rejected`, the bridge posts the `SIGBY_RESPONSE` to the page. Poll deadline is 5 minutes (the signing timeout). Terminal states the poller can return: `not-found` → `-32603 "Request lost (wallet background restarted)"`; deadline expiry → also `-32603 "Signing request timed out"`. ⚠ **Open bug:** the content script polls with the *dApp-facing* requestId (the injected provider's UUID), but persisted signing rows are keyed by the *DappManager-internal* requestId. Those two namespaces never match, so today this fallback always returns `not-found` and the dApp surfaces the "Request lost" error. The recovery path described here is what's *intended*; the actual code drops every recovered request. Fix is one of: (a) carry the DappManager requestId back through the response so the bridge can poll with it, (b) key the persisted table by the dApp-facing ID, or (c) maintain a side-table mapping one to the other.

**Recoverable method allowlist.** The polling fallback only fires for methods in `dappBridge.ts`'s `RECOVERABLE_METHODS` set: `eth_sendTransaction`, `wallet_sendCalls`, `personal_sign`, `eth_sign`, `eth_signTypedData` / `_v3` / `_v4`. Connection requests (`eth_requestAccounts`) aren't recoverable through the polling path — there's no persisted row to poll against — but they don't hang silently either: when the port-closed catch fires for a non-recoverable method, `dappBridge` immediately posts a `SIGBY_RESPONSE` carrying the original error message back to the page, so the dApp's `request()` promise rejects within the same tick the SW death surfaced. As a final backstop, the injected provider arms a **120-second per-request timeout** (`src/injected/provider.ts`) when `request()` is called; even if every other failure mode somehow swallows the error, that timer rejects the dApp promise. Synchronous methods (`wallet_switchEthereumChain`, `wallet_addEthereumChain`) don't open a popup at all, so SW death isn't a hang risk for them.

**3. Cold-start orphan sweep.** `DappManager.sweepOrphanSigningRequests` runs on every SW wake: `chrome.runtime.onStartup`, `onInstalled`, and from `loadState()` on plain module load (covers the common case where Chrome spins the SW back up without firing either lifecycle event). It scans the persisted table; pending rows older than `signingRequestTimeout` (5 minutes) get marked `rejected` with the `DISCONNECTED` error code. Settled rows older than `SETTLED_GRACE_MS` (30 seconds) are deleted outright — the grace window lets a late content-script poller still read the result before the row is reclaimed. The two thresholds are deliberately different: pending must use the same 5-minute window as the in-memory signing timeout (a shorter pending threshold races the user — the SW can idle out while the popup is still open, the sweep flips `pending` → `rejected`, and the subsequent Approve silently no-ops against the state-guarded updater in `settlePersistedSigningRequest`). Idempotent — safe to run repeatedly.

**Settlement lifecycle.** Approval / rejection calls `settlePersistedSigningRequest`, which only transitions from `pending` (never overwrites a terminal state). The "never overwrites a terminal state" guard is no longer load-bearing for the original race it was designed for — `windows.onRemoved` no longer settles signing requests at all (only connection requests, see Window-close handling above) — but the guard is kept because the orphan sweep can still flip a stale-pending row to `rejected` while a late `approveSigning` arrives, and we want the orphan-sweep verdict to win in that case rather than have the late approval clobber it with a result the dApp will never receive (the in-memory entry is already gone). Settled rows stick around for 30s so a late polling content script can still read the result, then `setTimeout(removePersistedSigningRequest, 30_000)` cleans them up.

The popup reads the same storage key via `GET_PENDING_SIGNING` → `getPendingSigningRequest` to render the approval UI. In-memory `pendingSigningRequests` map and the persisted row share the same `requestId` — whichever survives the SW death wins.

## Build System

Two Vite builds, one output directory:

**Main build** (`vite.config.ts` + `@crxjs/vite-plugin`) — processes `manifest.json`, bundles background, content scripts, popup HTML/TSX/CSS. Emits hashed file names, generates a manifest with correct paths.

**Injected build** (`vite.injected.config.ts`) — separate build because the injected provider must be an **IIFE** (Immediately Invoked Function Expression) that runs standalone in the page context. No ES module imports possible, no cross-file dependencies. Outputs a single `dist/injected.js`, referenced in `manifest.json` as a `web_accessible_resource` and loaded via `chrome.runtime.getURL("injected.js")`.

`pnpm build` runs both sequentially. `pnpm dev` watches the main build; the injected provider is rarely edited and can be rebuilt ad hoc with `pnpm build:injected`.

### Why two builds

- The content script is bundled as an ES module; the injected script must not be.
- The content script has access to `chrome.*` APIs; the injected script must not have them in scope (the page must not see extension APIs).
- Sharing code between them would leak `chrome.*` references through bundler inlining. Separate builds enforce isolation.

---

For the current feature status and Porto RPC method coverage, see [docs/PORTO_FEATURE_LIST.md](docs/PORTO_FEATURE_LIST.md). For dApp integration examples (`window.ethereum` usage), see [docs/PORTO_API_REFERENCE.md](docs/PORTO_API_REFERENCE.md).
