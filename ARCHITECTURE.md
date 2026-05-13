# Architecture

How Sigby works: the component model, the message flows, and why the Porto SDK lives where it does.

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

The Porto SDK runs in the popup, not the background. Everything else is plumbing to get signing requests from dApps to the popup, and results back.

## Four Execution Contexts

Manifest V3 extensions split into isolated JavaScript contexts. Sigby uses four:

| Context             | Lifetime                          | Can do                                                 | Cannot do                               |
| ------------------- | --------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| **Page**            | Per tab                           | Read/write `window.*`, be called by dApp code          | Use `chrome.*` APIs                     |
| **Content script**  | Per tab (isolated world)          | Use `chrome.runtime.*`, read DOM                       | Touch page's JS globals directly        |
| **Background SW**   | On-demand, may be killed anytime  | All `chrome.*` APIs, network, storage                  | Show UI, run WebAuthn                   |
| **Popup window**    | While open                        | Full DOM, WebAuthn, all `chrome.*` APIs                | Persist across closes                   |

The **injected provider** (`src/injected/`) runs in the page context so `window.ethereum` is reachable by dApp code. It talks to the content script via `window.postMessage`, which is the only safe bridge across that boundary.

The injected provider also carries a few legacy shims. It announces `isSigby: true` and deliberately keeps `isMetaMask: false`. The legacy `enable()`, `send()`, and `sendAsync()` methods all log a deprecation warning. `enable()` and `sendAsync()` delegate to `request()` unconditionally. `send()` has two narrow synchronous fast-paths: `send("net_version")` and `send("eth_chainId")` return cached chain info directly without a round-trip, since these reads are lock-independent and pre-EIP-1193 dApps still call them in synchronous code paths. `send("eth_accounts")` and `send("eth_coinbase")` deliberately route through `request()` even though `selectedAddress` is cached locally. The reason is that the legacy sync path used to leak a stale unlocked address past a lock event, and the lock gate only runs on the async path. The provider also exposes `_metamask.isUnlocked()`, which queries Sigby's lock-state RPC and falls back to `this.selectedAddress !== null` if background communication fails. As a separate quirk, the background aliases `eth_sign` to `personal_sign` (the former is deprecated and insecure, but some old dApps still call it), with parameter order swapped to match `personal_sign`.

The **content script** (`src/content/`) runs in the isolated content-script world. It bridges page to extension via `window.postMessage` one way and `chrome.runtime.sendMessage` the other.

The **background service worker** (`src/background/`) owns the extension's `chrome.storage.local` state (accounts, settings, dApp connections, persisted signing requests, and so on) and talks directly to Porto Relay for methods that don't need signing. Porto's own session and credential-id state lives in popup-side IndexedDB via `Porto.Storage.idb()`, not in the background. The background never instantiates Porto.

The **popup** (`src/popup/`) runs the Porto SDK and handles every WebAuthn prompt.

## Why Porto SDK Lives in the Popup

WebAuthn (`navigator.credentials.create` / `.get`) requires a visible user activation: a browser tab or popup window in focus. Service workers have no window, so they can't trigger Touch ID or Face ID. Chrome extensions offer an Offscreen Document API for this, but it can't receive user gestures and is primarily intended for media and audio use cases.

Porto needs WebAuthn for account creation, every transaction signature, and every message sign. That forces the SDK into a visible context.

The background service worker therefore never instantiates the Porto SDK; there is no `src/background/portoService.ts`. When a code path on the background side would need Porto, it instead opens the popup (`chrome.windows.create` with `?view=…&requestId=…`) and lets the popup do the SDK call. The result then comes back via `APPROVE_SIGNING`, `APPROVE_CONNECTION`, or the equivalent message for that flow.

The real implementation is `src/popup/portoService.ts`. It initializes once when the popup opens:

```ts
Porto.Porto.create({
  chains: SUPPORTED_CHAINS,              // viem chain objects
  mode: Porto.Mode.relay({ multichain: true, keystoreHost: 'id.sigby.xyz' }),
  storage: Porto.Storage.idb(),          // IndexedDB (persists across popup closes)
  announceProvider: false,               // we announce our own EIP-6963 from injected/
})
```

The SDK stores account metadata in IndexedDB (per-popup, per-origin). The passkey itself lives in the OS or browser keychain (iCloud, Google Password Manager, 1Password) and syncs via whatever provider the user has configured. WebAuthn credentials created against the current config are scoped to the `id.sigby.xyz` RP ID. Note that this is not retroactive: Porto persists each credential's `rpId` inside its IDB row at creation time, and the signing path reads `rpId` from the stored key rather than from the live config. Credentials created back when `keystoreHost` was `undefined` still resolve under the extension origin and keep working today; the `id.sigby.xyz` scoping applies only to credentials minted after the switch. This per-key persistence is what kept existing dev passkeys alive across the keystoreHost change, and it's also why the unbuilt half-state (config flipped but `id.sigby.xyz` not yet DNS-live) didn't immediately brick existing wallets.

## Message Flow: Connecting a dApp

1. The dApp calls `window.ethereum.request({ method: 'eth_requestAccounts' })`.
2. The **injected provider** generates a request ID and posts `{ type: 'SIGBY_REQUEST', requestId, method, params }` to its own window. The `requestId` is load-bearing because step 8 uses it to correlate the response back to the originating promise.
3. The **content script** (`dappBridge.ts`) listens on `window.message` and forwards via `chrome.runtime.sendMessage({ type: 'DAPP_REQUEST', payload: { method, params, origin }, requestId })`. The `requestId` is lifted to the top level so the background can include it in the response for step 7's correlation.
4. The **background** (`messageHandler.ts`) receives the message. For `eth_requestAccounts` it loads the active account from `AccountManager` and checks `DappManager.isConnected(origin, accountAddress)`. If the dApp is already connected, it returns `[accountAddress]` immediately. Otherwise `DappManager.requestConnection()` opens the popup with `?view=connect&origin=<origin>&account=<address>` (plus optional `&favicon=…&title=…` for the UI) and returns a Promise that resolves when the user approves or rejects. The `account` param is load-bearing here too: `ConnectionApproval` reads it to know which account is being granted access.
5. The **popup** (`pages/approval/ConnectionApproval/`) renders the origin, favicon, and title immediately. In a post-mount `useEffect`, it fires `IS_ORIGIN_KNOWN` and updates the UI with a first-visit security banner when the reply says this origin has never connected to any account on this installation. On approve, the popup first runs `popupPortoService.signCanary(accountAddress)`. That fires a fresh WebAuthn ceremony so connection approvals are biometric-gated to match every other approval path. Without it, clicking "Approve" on a dApp connect screen would be a passkey-less way to extend the unlock session. Only after the canary succeeds does the popup send `APPROVE_CONNECTION` back to the background.
6. The **background** resolves the pending Promise and sends the response back through the same chain.
7. The **content script** posts `{ type: 'SIGBY_RESPONSE', requestId, result, error }` to the page. Both fields are always present in the post: `result` carries `response.data` (which is `undefined` on failure) and `error` carries `response.error` (which is `undefined` on success). The injected provider branches on `if (error)` truthiness, not on field presence. There is one exception: when `dappBridge` itself throws on the catch path (port closed, context invalidated), it posts a `SIGBY_RESPONSE` with `error` only and no `result` field. The injected provider's `if (error)` check still does the right thing.
8. The **injected provider** finds the matching request by ID and resolves the dApp's original `request()` Promise.

A note on IDs. There are two `requestId` namespaces and they are deliberately separate. The dApp-facing requestId (`crypto.randomUUID()` minted in the injected provider, validated by regex on arrival in the content script) correlates page to content-script to background to content-script to page; that is the chain step 8 unwinds. The internal signing requestId (`DappManager.generateRequestId()`) is minted inside the background when `requestSigning` opens an approval popup, and it correlates background to approval popup to the persisted `pendingSigningRequests` row. The internal ID never reaches the dApp or the content script. They share a UUID format and the same field name, but they live in different layers, so don't conflate them.

⚠ This separation is load-bearing for an open bug. The content-script polling fallback (see Service Worker Death Recovery) polls `pendingSigningRequests` using the dApp-facing requestId, but persisted rows are keyed by the DappManager-internal requestId. The two never match. The fallback always returns `not-found`, and the dApp surfaces "Request lost (wallet background restarted)" even when the row is alive. Listed here, discussed under Service Worker Death Recovery.

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

A few subtleties are worth calling out.

**Deduplication.** `DappManager` derives a dedupe key from `method:origin:<32-bit rolling hash of JSON.stringify(params)>`. The hash is a cheap non-cryptographic fingerprint, not a real hash. If the dApp fires the same call twice (common in React strict mode), the new caller's `resolve` and `reject` are chained onto the existing pending Promise. There is no second popup and no second WebAuthn prompt; both callers get the same result when the first one settles.

**FIFO approval-window queue.** Connection and signing approvals share a single in-flight slot. `DappManager` tracks `approvalReserved`, set synchronously before any await so two callers racing in the same tick can't both pass the gate, plus the existing `windowToRequest` map. When the slot is busy, new approval requests land in `approvalQueue` and `chrome.windows.create` is held back until the current approval window closes. `drainApprovalQueue` runs after every window-close to release the slot and open the next entry. Without this, two concurrent dApp signing requests would race-create two popup windows, each eating focus, and on some platforms only the second one would actually receive WebAuthn input. The queue serialises the user-visible flow without serialising the underlying message handlers; each request still has its own `pendingSigningRequests` entry.

**Window close, asymmetric handling.** `chrome.windows.onRemoved` is tracked via `windowToRequest`. Signing requests are intentionally not auto-rejected on window close, because the user may have dismissed the popup intending to resume later via the toolbar popup's pending-approvals queue. The 5-minute timeout still fires if they never come back, and explicit Reject still works. Connection requests are *intended* to auto-reject on window close: `handleWindowClosed` calls `requestInfo.id.split(":")` to recover the `${origin}:${accountAddress}` request key.

⚠ That recovery is broken for normal `https://…` origins, which themselves contain a `:`. The split returns `["https", "//example.com", "0x…"]` instead of the expected two-element pair, the recovered tuple doesn't match the `requestKey` in `pendingRequests`, `rejectConnection` no-ops, and the request waits for the 2-minute connection timeout instead of rejecting promptly. Until that is fixed, treat window-close on a connection popup as "wait for the timeout" rather than "instant reject". Explicit Reject still works.

**Timeouts.** Connection requests time out at 2 minutes, signing at 5 minutes. `approveSigning`, `rejectSigning`, `approveConnection`, and `rejectConnection` all call `clearTimeout` on settlement. A `pendingSigningRequests.has(requestId)` or `pendingRequests.has(requestKey)` guard inside each timeout callback is the belt-and-braces backstop for the cold-start or race case where the in-memory handle doesn't exist but the timer still fires.

**Fee token priority: dApp pin wins.** On `wallet_sendCalls`, the dApp can include `capabilities.feeToken` as a hard requirement (for example a merchant that wants USDC). When that's present, `TransactionApproval` locks the picker to the dApp's choice (`dappRequiredFeeToken ?? selectedFeeToken ?? feeTokens[0]?.symbol`) and blocks approval if the required token isn't available, but only when the chain's fee-token list actually loaded with content. If `feeTokens` is empty (discovery failed or the chain reports no supported fee tokens), the gate falls open and approval continues. Otherwise a transient relay outage would brick every dApp that pins a fee token. Only when the dApp doesn't pin a fee token does the user's dropdown selection take effect. The legacy `eth_sendTransaction` path has no `capabilities` slot, so the user's choice always wins there.

**Two call paths in the popup.** `wallet_sendCalls` goes through `popupPortoService.sendCallsRaw(rawParams)`, an EIP-5792 pass-through that preserves the dApp's full multi-call `calls[]` and most capabilities. The one capability that does *not* pass through verbatim is `feeToken`: `TransactionApproval` strips `capabilities.feeToken` from the dApp's payload and replaces it with the user-selected (or dApp-pinned) value before forwarding. The fee-token slot is the only call site where the user's UI pick can override what the dApp sent; everything else under `capabilities` (merchantUrl, permissions, requiredFunds, and so on) is passed straight through. `eth_sendTransaction` goes through `popupPortoService.sendTransaction({ from, to, value, data, chainId, feeToken })`, a legacy single-call wrapper that also polls `wallet_getCallsStatus` to return a real transaction hash, because dApps expect one from `eth_sendTransaction`, not a bundle ID.

**`from`-pinning rejected up front.** Before opening the popup, both `handleWalletSendCalls` and `handleEthSendTransaction` reject requests whose `from` field pins an address other than the currently-active account, returning RPC code `4100 (UNAUTHORIZED)`. dApps can't silently force a sign with a different account; the approval UI shows the active account, and that's the only one that's going to sign.

## Message Flow: Events

EIP-1193 defines four lifecycle events: `accountsChanged`, `chainChanged`, `connect`, and `disconnect`. They flow the opposite direction from requests, from the background outward to the affected tabs. All four are origin-scoped only; the event broadcaster has no global fan-out method.

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

`EventBroadcaster` exposes only origin-scoped methods: `accountsChangedForOrigin(accounts, origin)`, `chainChangedForOrigin(chainId, origin)`, `connectForOrigin(chainId, origin)`, and `disconnectForOrigin(origin, error)`. The earlier global-fanout variants (`accountsChanged([])`, `disconnect(error)`) were removed; every event now requires the caller to name the origin(s) it applies to. The actual call sites are:

- `accountsChangedForOrigin` fires from `accountManager` (active-account switch, account deletion) and from `dappManager.disconnect` to notify the previously-connected origins.
- `chainChangedForOrigin` fires from `messageHandler.handleWalletSwitchChainForOrigin`, the EIP-3326 dApp-initiated path.
- `disconnectForOrigin` fires from `accountManager` (account deleted) and `dappManager.disconnect` (explicit per-origin or per-account disconnect).
- `connectForOrigin` is defined but currently has no call sites in the background. The `connect` event a dApp actually receives on first connection is emitted client-side by the injected provider the first time `eth_chainId` resolves successfully (`src/injected/provider.ts`, guarded by `hasEmittedConnect` so it fires once per page lifetime). Wagmi-style connectors block on this event, so emitting it from the injected side guarantees they unblock as soon as the provider can answer chain queries, independent of whether the background ever sent any event.

There is one more disconnect path that doesn't go through the broadcaster at all. When the content script detects extension-context invalidation (the periodic `chrome.runtime.id` check fails because the extension was reloaded, updated, or the SW is permanently dead), `dappBridge.ts` directly emits `disconnect` to the page from the content side. The background isn't involved, because by definition it isn't reachable. Together, these paths implement EIP-3326's "chain change only affects the requesting dApp" rule for `chainChanged` and apply the same per-origin discipline to account changes and explicit disconnects.

## Porto SDK Integration

The wallet interacts with Porto at three levels.

**1. Via the SDK in the popup**, for anything that needs signing.

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

The dApp-originated `wallet_grantPermissions` is also a full first-class approval flow, not a pure read. The background handler (`messageHandler.handleWalletGrantPermissions`) routes through `DappManager.requestSigning` with `view=grant-permissions`. The popup's `GrantPermissionsApproval` page surfaces the requested permissions, spend limits, and expiry, and on approve the popup calls `popupPortoService.grantPermissions(...)` against the Porto SDK. The popup then `JSON.stringify`s the returned `GrantedPermission` object and sends it via `APPROVE_SIGNING`, whose `result` field is typed as `string`. The background `JSON.parse`s that envelope back to the native shape before returning to the dApp. The string-encoding is a property of the popup-to-background message channel, not of the Porto SDK return value: Porto returns a structured object, and the popup serializes it solely to fit it through the typed message bus.

**2. Via the SDK for read-only Porto methods**: history, assets, permissions, keys, capabilities, health. These still run from the popup, because the SDK holds the provider instance and session state.

```ts
await provider.request({ method: 'wallet_getCallsHistory', params: [{ address, limit: 50, sort: 'desc' }] })
await provider.request({ method: 'wallet_getAssets', params: [{ account, chainFilter, assetTypeFilter: ['erc20', 'native'] }] })
await provider.request({ method: 'wallet_getKeys', params: [{ address }] })
```

The popup-side SDK also handles two state-mutating but non-signing methods that don't get separate sections above:

- `wallet_revokePermissions` revokes a session key by ID. Called from the Permissions page when the user taps revoke. The SDK updates Porto's IDB and emits the change to the relay.
- `wallet_disconnect` drops the popup's in-memory Porto session for the active account. Called when the user explicitly signs out or removes an account. It doesn't touch the platform passkey (that stays in the keychain), only Porto's local session state.

Both run in the popup for the same reason all the other Porto calls do: the SDK lives there.

**3. Via direct `fetch` to Porto Relay**, from the background, for dApp-originated read-only EIP-5792 methods. These don't need signing, don't need a popup, and must be fast.

Two additional dApp-facing wallet methods are handled entirely in the background without any Porto round-trip. `wallet_requestPermissions` (EIP-2255) wraps `eth_requestAccounts` in the EIP-2255 caveat envelope, and `wallet_getPermissions` returns `[]`. Porto-aware dApps expecting session-key permissions fall back to `eth_accounts` for connectivity, which is what we can serve from the background.

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

This is a deliberate shortcut. `wallet_getCapabilities` and `wallet_getCallsStatus` are pure reads. Proxying them through the popup would require opening a popup window for each dApp poll, which is unacceptable. Both call sites hit the Relay at `PORTO_CONFIG.RELAY_URL` (`https://rpc.porto.sh`) via `fetch`.

Neither Relay-backed handler is a pure pass-through; both reshape the response.

`handleWalletGetCapabilities` receives a `{ contracts, fees, … }` Porto-internal shape from the relay and flattens it into the EIP-5792 `{ atomic, feeToken: { supported, tokens }, merchant, permissions, requiredFunds, ...passthrough }` shape, stripping the relay-internal `contracts` and `fees` fields. (An earlier version of this handler also emitted an `atomicBatch` field. It was dropped because it isn't in Porto's schema and we didn't want dApps coming to rely on a field that would disappear.)

`handleWalletGetCallsStatus` receives `{ status, receipts, atomic, capabilities }` from the relay and re-wraps it into the EIP-5792 envelope `{ version: "1.0", id: bundleId, chainId: <hex>, atomic, status, receipts, capabilities }`. `chainId` is taken from the first receipt when present, and otherwise derived from the requesting origin's per-origin chain so that polls during chain switches still return a meaningful value. `atomic` defaults to `true` when the relay doesn't explicitly say otherwise. dApps can `switch (status)` and read `chainId` and `atomic` directly without looking for absent envelope fields.

Both match what the Porto SDK's own helpers would return from the popup, same SDK-parity logic, implemented at the background boundary to avoid a popup round-trip.

Note that other dApp-originated read methods (`eth_getBalance`, `eth_call`, `eth_estimateGas`, `eth_blockNumber`, `eth_getTransactionCount`, `eth_getCode`, `eth_getTransactionReceipt`, `eth_getTransactionByHash`, `eth_gasPrice`) do *not* go to Porto Relay. They go through `RpcHandler` plus viem clients to public chain RPCs (the ones listed in `manifest.json` `host_permissions` and the CSP `connect-src`).

### Porto Request Shape

Porto uses `wallet_connect` with capability flags for account creation vs selection:

```ts
// Create new — label resolves to keychainLabel || displayName || 'Sigby',
// typically "Sigby <N>" based on accountCount
{ capabilities: { createAccount: { label: 'Sigby 2' } }, chainIds: [...] }

// Select existing
{ capabilities: { selectAccount: true }, chainIds: [...] }
```

The `label` in `createAccount` becomes the passkey name shown in Touch ID, and it is immutable. The extension's display name (editable later) is stored separately in `chrome.storage.local`.

`chainIds` is the list of chains the account should be usable on. Porto's EIP-7702 authorization uses `chainId=0`, which makes the account available on every specified chain at the same address.

### Transaction Lifecycle

`wallet_sendCalls` returns `{ id: bundleId }` immediately after the Relay submits the intent. The bundle is not yet mined. On the legacy `eth_sendTransaction` path only, `popupPortoService.sendTransaction` calls an internal (private) helper `waitForTransactionHash(bundleId)` that polls `wallet_getCallsStatus` every 2 seconds for up to 30 attempts (about 60 seconds). The poll has three exit paths:

- *Success with receipt.* `receipts[0].transactionHash` arrives, and we return it.
- *Confirmed without receipt.* Porto status is `200` and there are no receipts; we return the `bundleId` as the best identifier we have.
- *Terminal failure.* Porto status falls in the failed band (`isPortoStatusFailed` matches the 3xx offchain and 4xx-5xx onchain revert codes); we throw a `ProviderRpcError` so the dApp's `eth_sendTransaction` promise rejects, instead of silently handing back a `bundleId` that looks like a successful tx hash but actually represents a failed bundle.

If the loop simply runs out of attempts on transient or `pending` (1xx) statuses without ever hitting a terminal one, it falls back to returning the `bundleId`. `eth_sendTransaction` dApps expect a prompt response, and if confirmation hasn't arrived in a minute the dApp will poll on its own.

For EIP-5792-aware dApps calling `wallet_sendCalls` directly, the background returns the `bundleId` without waiting, per spec. The dApp polls status itself.

## State Model

Authoritative state lives in `chrome.storage.local` (background-owned), with one carve-out: lock state lives in `chrome.storage.session` under `lastUnlockedAt` (`SESSION_STORAGE_KEYS.LAST_UNLOCKED_AT`). Session storage clears on browser restart, which is exactly the lock semantics we want; relaunching the browser re-locks the wallet without us tracking that explicitly. Both contexts touch this key, in four different shapes:

- A popup unlock writes the current timestamp (`chrome.storage.session.set({ lastUnlockedAt: now })`).
- An explicit popup lock *removes* the key (`chrome.storage.session.remove`); the gate's "missing or stale" branch then reads as locked. Removal rather than zeroing keeps the in-memory cache and the storage shape in sync, since `null` vs absent vs `0` would otherwise be three states answering the same question.
- The popup's `setAutoLockMinutes` refreshes the timestamp only when the wallet is currently unlocked. The rationale is that changing the preset is itself user activity, but bumping the stamp while locked would silently unlock. The bump runs *before* the settings write so the background's `isLocked()` re-compute under the new (possibly tighter) window doesn't retroactively classify prior idle time as expired and fire a spurious lock transition.
- The background's `lockStatus.persistUnlock()` writes the timestamp after approved dApp connection and signing flows. Those approvals already required a fresh WebAuthn ceremony in the popup, so leaving the lock counter stale would force a redundant biometric on the next popup open.

The background's `lockStatus.ts` calls `chrome.storage.onChanged.addListener(...)`, which is the global storage-change channel (Chrome doesn't expose a per-area `chrome.storage.session.onChanged` shorthand). It filters on `area === "session"` for the unlock key and `area === "local"` for settings changes. It also keeps an in-memory mirror so that lock-gated RPC paths (`_sigby_isLocked`, the per-method `LOCK_GATED_METHODS` table in `handleDappRequest`) can answer synchronously without a per-request `chrome.storage.session.get`. The listener is also what tells the background to react to popup-side writes.

Note that the on-transition broadcaster (`broadcastLockTransition` in `background/index.ts`) is intentionally a no-op. `EventBroadcaster` does not consult lock state at all; the dApp-facing lock surface is purely the per-call gate inside `handleDappRequest`, not a `chainChanged` or `disconnect` storm at lock time.

The popup's Zustand store is a cache synced on mount:

```ts
// src/popup/App.tsx (simplified: actual code wraps in try/catch/finally
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
| `accountDapps`         | `Record<address, Record<origin, ConnectedDapp>>`. Each `ConnectedDapp` carries its own `chainId`, driving per-origin chain context (see below) |
| `settings`             | `{ defaultChain, autoLockTimeout, hasCompletedOnboarding, ... }` |
| `transactionHistory`   | `Transaction[]` (last 100)                          |
| `customTokens`         | `Record<address, Record<chainId, tokenAddress[]>>`  |
| `tokenMetadataCache`   | `Record<"${tokenAddress}:${chainId}", TokenMetadata>` (composite key, since the same `address` can have different metadata per chain) |
| `pendingSigningRequests` | `Record<requestId, PersistedSigningRequest>`. Persisted approval queue plus cold-start recovery (see below) |
| `account` *(legacy)*   | Single-account record from pre-multi-account installs; consumed by `migrateToMultiAccount` and never written by current code |
| `connectedDapps` *(legacy)* | Single-account dApp connections from pre-multi-account installs; same migration consumer |

Plus one **`chrome.storage.session`** key:

| Key                  | Shape                                                            |
| -------------------- | ---------------------------------------------------------------- |
| `lastUnlockedAt`     | `number`. Ms timestamp of the last successful popup unlock; absent or stale-vs-`autoLockTimeout` ⇒ locked. Cleared on browser restart. |

### Popup-owned (Zustand, session-only)

- Multi-account map mirror (fetched from background): `accounts`, `accountOrder`, `activeAddress`.
- Network: `chainId` and `chainCommittedAt` (timestamp of last confirmed `SWITCH_CHAIN` reply, used to gate one-shot signature-motion beats so unrelated re-renders don't re-fire them).
- `assets`: flat `PortoAsset[]` for the currently selected `(address, chainId)`. Freshness uses `assetsLastFetched` (advances on success only, drives the 30s TTL) and `assetsLastAttemptedAt` (advances on completion regardless of success; read this for "have we tried yet?" UX gates). The array is reset to `[]` on address or chain switch and is not cached across switches.
- `pendingTransactions`: bundle IDs being watched by `useTransactionWatcher`.
- `historyRefreshTrigger`: incremented on confirmation to force a History page refetch.
- `permissions`, `permissionsLoading`, `permissionsNeedAuth`: session-key list plus cold-load auth gate.
- `accountKeys`, `keysLoading`, `keysNeedAuth`: authorized-keys list plus cold-load auth gate.
- `relayHealth`, `relayHealthLoading`: Settings relay health card.
- Lock: `isUnlocked`, `unlockedAt`, `autoLockMinutes` (cached from `settings.autoLockTimeout`).
- Onboarding: `hasCompletedOnboarding` (persisted mirror) and `isOnboardingActive` (in-memory gate, decoupled from `hasCompletedOnboarding` so the "You're set" success transition doesn't tear down the flow before it can render).
- `celebrations`: per-kind timestamps of the latest celebration event (e.g. `passkey-success`). Views compare last-seen timestamps to advance one-beat animations, never on value equality.
- Connection: `isAuthenticated`.
- UI flags: `isLoading`, `error`, `errorAt` (for DismissibleError countdown persistence across tab switches), `isAccountSwitcherOpen`, `showTestnets`.
- Actions co-located in the same store: account CRUD mirror, chain switch, lock/unlock, onboarding transitions, asset/permission/key fetchers, celebration emitters, and so on.

### Popup-owned (IndexedDB, cross-popup persistence)

This is Porto SDK's own storage: account metadata, session state, and a mapping from account address to its credential ID so the SDK knows which passkey to ask for. The private key material never lives here. It stays in the platform keychain (Secure Enclave, TPM, iCloud, Google Password Manager) and is only accessed via WebAuthn ceremonies. Porto manages this entirely; the extension never reads or writes it directly.

## Storage

Five storage layers, each with a different purpose:

| Layer                    | Owner          | Scope                          | Used for                                   |
| ------------------------ | -------------- | ------------------------------ | ------------------------------------------ |
| Platform keychain        | OS / browser   | Synced across devices          | Passkey private keys (we never see them)   |
| `chrome.storage.local`   | Background SW  | Per-profile, persistent        | Accounts, settings, connections, history   |
| `chrome.storage.session` | Popup + Background SW (both write; background also mirrors via onChanged) | Per-profile, cleared on browser restart | Lock state (`lastUnlockedAt`) |
| IndexedDB (in popup)     | Porto SDK      | Per-origin, persistent         | Porto session state + credential-ID lookup |
| Zustand                  | Popup React    | While popup is open            | UI state, caches                           |

`chrome.storage.local` is wrapped in `StorageManager` (`src/utils/storage.ts`), which is typed and supports migrations. The first time the background starts after an upgrade, `migrateToMultiAccount()` runs and moves any legacy single-account data into the new multi-account layout. The migration is idempotent.

## Per-Origin Chain Context

EIP-3326 (`wallet_switchEthereumChain`) says a chain switch should only affect the requesting dApp. Many wallet implementations treat chain switching as global, so every open dApp sees `chainChanged`. Sigby implements it per-origin.

Each `ConnectedDapp` entry in `accountDapps` carries its own `chainId`. `DappManager.getChainIdForOrigin(origin, address)` returns that value, falling back to `settings.defaultChain`. When a dApp calls `wallet_switchEthereumChain`, the background validates that the chain is in `CHAIN_CONFIGS`, updates `accountDapps[address][origin].chainId`, and calls `eventBroadcaster.chainChangedForOrigin(newChainId, origin)`, which fires `chainChanged` only to tabs matching that origin.

Other connected dApps keep their chain. This means Uniswap can be on Base while another dApp is on Arbitrum, simultaneously, in the same browser session.

The popup's selected chain (shown in the header) is the global default. It drives the wallet's own Send, Receive, and Tokens pages, is what `eth_chainId` returns to unconnected origins, and is the fallback chain that new dApp connections inherit if they don't pin one. Switching it via the header `ChainSwitcher` fires `SWITCH_CHAIN`, which updates `settings.defaultChain` and intentionally does *not* broadcast `chainChanged`. Already-connected dApps that established a per-origin chain via `wallet_switchEthereumChain` keep it, because stomping on their chain from a wallet-side UI action would break EIP-3326's contract. Per-origin switches flow through the separate `handleWalletSwitchChainForOrigin` path, which fires `chainChangedForOrigin` only to the requesting origin's tabs.

Popup-originated reads can override the per-origin chain. When the popup makes its own RPC calls (for example `eth_getBalance` for the UI), it sends `DAPP_REQUEST` with an explicit `chainId` on the payload. `messageHandler.handleDappRequest` applies chain resolution in this order: an explicit `payload.chainId` set by the popup wins, otherwise the per-origin chain from `dappManager.getChainIdForOrigin`, otherwise `settings.defaultChain`. The popup uses this to query balances for whatever chain the UI is showing, independent of what a connected dApp is on.

## Security Boundaries

**Origin validation, two paths.** Sigby has two distinct origin-resolution strategies depending on which message channel a request arrives on.

The first is the strict path, `extractValidOrigin(sender, providedOrigin)` in `src/utils/validators.ts`. It is used by signing handlers (`handlePersonalSign`, `handleSignTypedData`, `handleEthSendTransaction`, `handleWalletSendCalls`, `handleWalletGrantPermissions`) and by any handler whose decision will end up persisted as dApp-connection metadata. It reads `sender.origin` first, since Chrome populates this with the *frame's* origin and it is authoritative for permission decisions, and then falls back to deriving an origin from `sender.url`. Each candidate is gated by `isValidOrigin`. Two sources are deliberately *not* consulted: `sender.tab.url` (the top-frame URL, which would let a malicious iframe inherit the tab's permissions since content scripts run in every frame via `all_frames: true`) and the message body's `origin` field (untrusted at this layer). The `providedOrigin` parameter is accepted for backward-compatibility callers but ignored.

The second is the trusted-channel path, `payload.origin` straight from `DAPP_REQUEST`. It is used by `handleDappRequest`'s top-level dispatch (`eth_accounts`, `eth_chainId`, `wallet_switchEthereumChain`, `wallet_getCapabilities`, `wallet_getCallsStatus`, and so on) and by popup-originated internal messages (`CONNECT_ACCOUNT_DAPP`, `DISCONNECT_ACCOUNT_DAPP`, `APPROVE_CONNECTION`, and so on). For `DAPP_REQUEST` the safety argument is that the content script sets `payload.origin = window.location.origin` and validates `event.origin === window.location.origin` on every inbound `postMessage` before forwarding (`dappBridge.ts:115`), so the field is content-script-attested rather than dApp-attested. For popup-originated messages, the popup itself is trusted code. The popup's `chrome-extension://` origin would in fact *fail* `extractValidOrigin`, which only accepts `http:` and `https:` schemes via `isValidOrigin`. That is exactly why the popup carries the relevant dApp origin in the payload: the popup isn't trying to authenticate as the dApp, it is relaying a decision about that dApp's connection state.

The strict path is the right default whenever the handler is acting on a dApp's behalf and will write origin into persistent storage (connection metadata, signing-request rows). The trusted-channel path is the only option for popup-originated decisions about a dApp (the extension origin can't satisfy the strict path's HTTP-only rule), and it is fine for stateless dApp reads where the content-script attestation already gives us a verified origin.

**EIP-1193 event allowlist.** The content-script bridge only forwards `accountsChanged`, `chainChanged`, `connect`, `disconnect`, and `message` from `EMIT_EVENT` frames; this is the `KNOWN_PROVIDER_EVENTS` list in `dappBridge.ts`. Any other event name coming through the bridge is dropped silently, so a compromised background couldn't inject arbitrary event names into the page's provider.

**Per-origin account visibility.** `eth_accounts` returns `[]` for unconnected origins even if the user has an active account. `wallet_getCapabilities` returns `{}` for unconnected origins. This prevents fingerprinting.

**postMessage origins.** The injected provider and content script both validate `event.origin === window.location.origin` before processing messages. Cross-frame exploits can't inject fake responses.

**Extension context monitor.** The content script polls `chrome.runtime.id` every 30 seconds. If the extension is reloaded (id becomes undefined), the orphan content script emits `disconnect` to the page and stops listening, so dApps get a clean failure mode instead of silent dropped requests.

**CSP.** `manifest.json` restricts `connect-src` on extension pages to Porto Relay plus the configured public RPC endpoints. `script-src 'self'; object-src 'self'`. No `unsafe-inline`, no `unsafe-eval`. No `frame-src` is set, because the extension doesn't iframe anything itself; Porto's `id.porto.sh` iframe flow isn't used, since WebAuthn happens directly in the popup via relay mode.

**Two-stage error mapping at the dApp boundary.** Every signing-handler response passes through `messageHandler.toDappErrorResponse`, which classifies the thrown error into exactly two shapes.

A user-reject becomes `{ code: 4001, message: "User rejected the request" }`. `DappManager.rejectSigning` throws `Error("User rejected the signing request")`, and WebAuthn platform-authenticator cancels surface as `"not allowed"`, `"cancelled"`, or `"canceled"`. Because the `Error`'s structured code doesn't survive stringification, `toDappErrorResponse` re-derives 4001 by lowercasing the message and matching any of: `user rejected`, `user denied`, `user cancel`, `not allowed`, `cancelled`, `canceled`. dApps' `if (err.code === 4001)` branches fire whether the rejection came from the popup, the user, or the authenticator.

Everything else becomes `{ code: -32603, message: <humanized> }`. `mapPortoError` rewrites the raw error message into one of a handful of canonical strings (`INSUFFICIENT_FUNDS`, `NETWORK_ERROR`, `WEBAUTHN_TIMEOUT`, `"Transaction nonce conflict. Please try again."`, `"Transaction would revert. Check contract conditions."`, and so on) based on substrings. This keeps the dApp-facing error banners legible instead of leaking raw SDK or relay internals.

**Provider method-locking.** After the injected provider is instantiated, its EIP-1193 method surface (`request`, `on`, `removeListener`, `emit`, and the legacy `enable`/`send`/`sendAsync` shims) is sealed with `Object.defineProperty({ writable: false, configurable: false, enumerable: true })`. The `_metamask` shim object is additionally frozen. This defeats hostile page scripts that would try `provider.request = evilFn` to hijack in-flight dApp calls after the EIP-6963 announcement has gone out. State fields (`chainId`, `selectedAddress`, `isConnected`) stay mutable because the provider updates them on events.

**External messages rejected.** `chrome.runtime.onMessageExternal`, the channel by which web pages or other extensions can send messages directly to Sigby's background, is registered but unconditionally responds with `{ success: false, error: "External messages not supported" }`. All legitimate dApp traffic flows through the content-script bridge, which lets us apply origin validation uniformly.

**First-visit origin check.** On connection approval, `ConnectionApproval` fires an `IS_ORIGIN_KNOWN` message to the background from a post-mount `useEffect`. The origin, favicon, and title render immediately, and the security-banner state updates when the reply arrives. If the origin has never been connected to any account on this installation, the UI shows a "first-visit" banner so the user knows this is a new counterparty rather than a routine re-approval.

**No private key material in the extension.** The only keys we touch are passkey _public_ keys, for display in the Authorized Keys list. Private keys live in the Secure Enclave or TPM and are only accessible via WebAuthn ceremonies gated on biometric verification.

## Service Worker Death Recovery

MV3 service workers can be killed at any time. Chrome terminates idle ones after about 30 seconds, and anything can force a restart (extension update, user reload, OS reclaim). A signing request in flight when the SW dies would normally hang the dApp's `await provider.request(…)` forever. Sigby has a three-part recovery subsystem designed to prevent that. The design is sound on paper, but one of the three parts is currently broken (see the ⚠ note on the polling fallback below). Until that's fixed, recovered signing requests surface as "Request lost" rather than carrying the real terminal state back to the dApp. The other two parts (persist-before-prompting and the cold-start orphan sweep) work as described.

**1. Persist before prompting, best-effort.** Before opening the popup, `DappManager.requestSigning` calls `persistSigningRequest(...)` to write the full request to `chrome.storage.local` under `pendingSigningRequests`, then immediately opens the popup window (`openSigningPopup`). The persist call is fire-and-forget; failures are logged via `.catch(...)`, and the call is *not* awaited. In the common case the storage write completes before the popup actually mounts and asks for the request, but the system tolerates the rare race. The popup's `GET_PENDING_SIGNING` reads the in-memory `pendingSigningRequests` map first (which is set synchronously), and only falls back to the persisted row if the in-memory entry is gone (for example after SW death). The persisted row is what the content-script polling fallback and the cold-start orphan sweep both read.

**2. Content-script polling fallback.** When `chrome.runtime.sendMessage` from `dappBridge.ts` fails with "message port closed" on a recoverable method, the bridge switches to polling. Every 2 seconds it sends `POLL_SIGNING_REQUEST` with the `requestId` and reads the persisted row's `state`. When the state flips to `approved` or `rejected`, the bridge posts the `SIGBY_RESPONSE` to the page. The poll deadline is 5 minutes, matching the signing timeout. Two terminal states can come from the poller: `not-found` produces `-32603 "Request lost (wallet background restarted)"`, and deadline expiry produces `-32603 "Signing request timed out"`.

⚠ Open bug: the content script polls with the *dApp-facing* requestId (the injected provider's UUID), but persisted signing rows are keyed by the *DappManager-internal* requestId. Those two namespaces never match, so today this fallback always returns `not-found` and the dApp surfaces the "Request lost" error. The recovery path described here is what's *intended*; the actual code drops every recovered request. The fix is one of: (a) carry the DappManager requestId back through the response so the bridge can poll with it, (b) key the persisted table by the dApp-facing ID, or (c) maintain a side-table mapping one to the other.

**Recoverable method allowlist.** The polling fallback only fires for methods in `dappBridge.ts`'s `RECOVERABLE_METHODS` set: `eth_sendTransaction`, `wallet_sendCalls`, `personal_sign`, `eth_sign`, and `eth_signTypedData` / `_v3` / `_v4`. Connection requests (`eth_requestAccounts`) aren't recoverable through the polling path because there is no persisted row to poll against, but they don't hang silently either. When the port-closed catch fires for a non-recoverable method, `dappBridge` immediately posts a `SIGBY_RESPONSE` carrying the original error message back to the page, so the dApp's `request()` promise rejects within the same tick the SW death surfaced. As a final backstop, the injected provider arms a 120-second per-request timeout (`src/injected/provider.ts`) when `request()` is called. Even if every other failure mode somehow swallows the error, that timer rejects the dApp promise. Synchronous methods (`wallet_switchEthereumChain`, `wallet_addEthereumChain`) don't open a popup at all, so SW death isn't a hang risk for them.

**3. Cold-start orphan sweep.** `DappManager.sweepOrphanSigningRequests` runs on every SW wake: `chrome.runtime.onStartup`, `onInstalled`, and from `loadState()` on plain module load. The last covers the common case where Chrome spins the SW back up without firing either lifecycle event. The sweep scans the persisted table. Pending rows older than `signingRequestTimeout` (5 minutes) get marked `rejected` with the `DISCONNECTED` error code. Settled rows older than `SETTLED_GRACE_MS` (30 seconds) are deleted outright; the grace window lets a late content-script poller still read the result before the row is reclaimed.

The two thresholds are deliberately different. The pending threshold must use the same 5-minute window as the in-memory signing timeout. A shorter pending threshold would race the user: the SW can idle out while the popup is still open, the sweep would flip `pending` to `rejected`, and the subsequent Approve would silently no-op against the state-guarded updater in `settlePersistedSigningRequest`. The sweep is idempotent and safe to run repeatedly.

**Settlement lifecycle.** Approval and rejection both call `settlePersistedSigningRequest`, which only transitions from `pending` (it never overwrites a terminal state). That guard is no longer load-bearing for the original race it was designed for, since `windows.onRemoved` no longer settles signing requests at all (only connection requests, as discussed in window-close handling above). It is kept anyway, because the orphan sweep can still flip a stale-pending row to `rejected` while a late `approveSigning` arrives, and in that case we want the orphan-sweep verdict to win rather than letting the late approval clobber it with a result the dApp will never receive (the in-memory entry is already gone). Settled rows stick around for 30 seconds so a late polling content script can still read the result, then `setTimeout(removePersistedSigningRequest, 30_000)` cleans them up.

The popup reads the same storage key via `GET_PENDING_SIGNING` → `getPendingSigningRequest` to render the approval UI. The in-memory `pendingSigningRequests` map and the persisted row share the same `requestId`; whichever survives the SW death wins.

## Build System

There are two Vite builds, sharing one output directory.

The main build (`vite.config.ts` plus `@crxjs/vite-plugin`) processes `manifest.json` and bundles the background, the content scripts, and the popup HTML, TSX, and CSS. It emits hashed file names and generates a manifest with the correct paths.

The injected build (`vite.injected.config.ts`) is separate because the injected provider must be an IIFE (Immediately Invoked Function Expression) that runs standalone in the page context. ES module imports aren't possible, and there are no cross-file dependencies. It outputs a single `dist/injected.js`, referenced in `manifest.json` as a `web_accessible_resource` and loaded via `chrome.runtime.getURL("injected.js")`.

`pnpm build` runs both sequentially. `pnpm dev` watches the main build. The injected provider is rarely edited and can be rebuilt ad hoc with `pnpm build:injected`.

### Why two builds

The content script is bundled as an ES module; the injected script must not be. The content script has access to `chrome.*` APIs; the injected script must not have them in scope, because the page must not see extension APIs. Sharing code between them would leak `chrome.*` references through bundler inlining, so separate builds enforce isolation.
