# Porto Wallet - Comprehensive Feature List

## Overview

This document maps Porto SDK RPC methods and Relay methods to wallet features, organized by category with implementation priorities.

**Priority Levels:**
- **P0** - Must Have: Core functionality required for MVP
- **P1** - Important: Key features for production readiness
- **P2** - Nice to Have: Advanced features for enhanced UX

**Status Legend:**
- [x] Implemented
- [ ] Not Implemented

---

## 1. Account Management

### 1.1 Create New Account
- **Description:** Create a new Porto smart account using WebAuthn/passkeys
- **Porto Methods:** `wallet_connect` with `capabilities.createAccount`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Uses popup context for WebAuthn biometric prompt. Creates account via Porto SDK with `createAccount.label` for keychain naming.

### 1.2 Connect Existing Account
- **Description:** Connect to an existing Porto account using WebAuthn authentication
- **Porto Methods:** `wallet_connect` with `capabilities.selectAccount`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Triggers passkey selection UI to authenticate existing account.

### 1.3 Get Connected Accounts
- **Description:** Retrieve list of connected/authorized account addresses
- **Porto Methods:** `eth_accounts`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Returns authorized accounts for the current session.

### 1.4 Request Account Access
- **Description:** Request access to accounts from dApps (triggers connection flow)
- **Porto Methods:** `eth_requestAccounts`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Opens connection approval popup for dApps.

### 1.5 Disconnect Wallet
- **Description:** Disconnect the wallet and clear session
- **Porto Methods:** `wallet_disconnect`
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** Settings page calls `popupPortoService.disconnect()` which invokes Porto's `wallet_disconnect` before clearing local state.

### 1.6 Multi-Account Support
- **Description:** Manage multiple accounts, switch between them
- **Porto Methods:** `eth_accounts`, `wallet_connect`
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** Extension supports multiple accounts with account switching and per-account dApp connections.

### 1.7 EOA Upgrade to Smart Account
- **Description:** Upgrade an existing EOA (MetaMask-style) to Porto smart account
- **Porto Methods:** `wallet_prepareUpgradeAccount`, `wallet_upgradeAccount`
- **Priority:** P2
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Advanced feature for users migrating from traditional wallets.

---

## 2. Transaction Features

### 2.1 Send Transaction (Legacy)
- **Description:** Send a single transaction (legacy eth_sendTransaction)
- **Porto Methods:** `eth_sendTransaction` (deprecated, internally uses wallet_sendCalls)
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Supported for dApp compatibility. Internally routed through wallet_sendCalls.

### 2.2 Send Transaction Bundle (EIP-5792)
- **Description:** Send a bundle of calls in a single transaction
- **Porto Methods:** `wallet_sendCalls`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Primary transaction method. Supports multiple calls, fee token selection, sponsorship.

### 2.3 Transaction Status Monitoring
- **Description:** Check status of pending transactions
- **Porto Methods:** `wallet_getCallsStatus`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** `useTransactionWatcher` hook polls pending transactions every 5 seconds. Shows toast on confirmation/failure and triggers balance refresh.

### 2.4 Transaction History
- **Description:** View past transactions and their status
- **Porto Methods:** `wallet_getCallsHistory`
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** History page uses Porto's `wallet_getCallsHistory`. Auto-refreshes when transactions confirm via `historyRefreshTrigger` in Zustand store.

### 2.5 Advanced Transaction Preparation
- **Description:** Prepare calls for manual signing (advanced use)
- **Porto Methods:** `wallet_prepareCalls`, `wallet_sendPreparedCalls`
- **Priority:** P2
- **Status:** [ ] Not Implemented
- **Implementation Notes:** For advanced users who want to inspect/modify transactions before signing.

### 2.6 Gas Fee in Alternative Tokens
- **Description:** Pay gas fees in USDC, USDT, or other tokens instead of native token
- **Porto Methods:** `wallet_sendCalls` with `capabilities.feeToken`, `wallet_getCapabilities`
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** SendToken page fetches available fee tokens via `wallet_getCapabilities` and displays `FeeTokenSelector` component. Selected token passed to `wallet_sendCalls`.

### 2.7 Sponsored/Gasless Transactions
- **Description:** Merchant-sponsored transactions (gasless for users)
- **Porto Methods:** `wallet_sendCalls` with `capabilities.merchantUrl`
- **Priority:** P2
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Allows dApps to sponsor gas fees for users.

### 2.8 Cross-Chain Funding
- **Description:** Automatically fund transactions from assets on other chains
- **Porto Methods:** `wallet_sendCalls` with `capabilities.requiredFunds`
- **Priority:** P2
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Advanced Porto feature for seamless cross-chain UX.

---

## 3. Signing Features

### 3.1 Personal Message Signing
- **Description:** Sign a personal message (human-readable)
- **Porto Methods:** `personal_sign`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Opens signing approval popup with message preview.

### 3.2 Typed Data Signing (EIP-712)
- **Description:** Sign structured typed data (permits, orders, etc.)
- **Porto Methods:** `eth_signTypedData_v4`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Supports v3 and v4. Displays parsed typed data in approval UI.

---

## 4. Token/Asset Management

### 4.1 Get Native Token Balance
- **Description:** Get ETH/native token balance on current chain
- **Porto Methods:** `eth_getBalance` (RPC)
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Uses viem public clients via RpcHandler.

### 4.2 Get Token Balances (Multi-Chain)
- **Description:** Get all token balances (native + ERC-20) across chains
- **Porto Methods:** `wallet_getAssets`
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** Zustand store calls `wallet_getAssets` once on popup open. Assets cached with 30-second TTL. Home and Tokens pages share same data. Auto-refreshes on account/chain switch and after transaction confirmation.

### 4.3 Custom Token Management
- **Description:** Add/remove custom ERC-20 tokens to track
- **Porto Methods:** N/A (extension feature)
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** Extension-side feature for tracking arbitrary ERC-20 tokens.

### 4.4 NFT Display
- **Description:** View NFT collections and individual NFTs
- **Porto Methods:** `wallet_getAssets` (with NFT support)
- **Priority:** P2
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Types defined but UI not implemented.

### 4.5 Token Sending
- **Description:** Send ERC-20 tokens to another address
- **Porto Methods:** `wallet_sendCalls` (with token transfer call)
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** SendToken page encodes ERC-20 `transfer()` call and sends via `wallet_sendCalls`. Includes fee token selection for gas payment in alternative tokens.

### 4.6 NFT Transfer
- **Description:** Transfer NFTs to another address
- **Porto Methods:** `wallet_sendCalls` (with NFT transfer call)
- **Priority:** P2
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Requires NFT UI and transfer flow.

---

## 5. Session Keys & Permissions

### 5.1 Grant Session Key Permissions
- **Description:** Allow dApps limited access to sign transactions without user approval each time
- **Porto Methods:** `wallet_connect` with `capabilities.grantPermissions`, `wallet_grantPermissions`
- **Priority:** P1
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Enables "approve once, use many times" UX for games, trading, etc.

### 5.2 Get Active Permissions
- **Description:** View currently active session key permissions
- **Porto Methods:** `wallet_getPermissions`
- **Priority:** P1
- **Status:** [ ] Not Implemented (basic EIP-2255 only)
- **Implementation Notes:** Currently only returns basic connection permissions, not Porto session keys.

### 5.3 Revoke Permissions
- **Description:** Revoke previously granted session key permissions
- **Porto Methods:** `wallet_revokePermissions`
- **Priority:** P1
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Users should be able to revoke any active permissions from settings.

### 5.4 Spend Limits
- **Description:** Set spend limits on session keys
- **Porto Methods:** `wallet_grantPermissions` with spend limit parameters
- **Priority:** P1
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Security feature to limit how much a session key can spend.

### 5.5 Get Account Keys
- **Description:** View all authorized keys on the smart account
- **Porto Methods:** `wallet_getKeys` (Relay)
- **Priority:** P2
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Shows all WebAuthn keys, session keys, etc. authorized on the account.

---

## 6. Wallet Capabilities

### 6.1 Get Wallet Capabilities
- **Description:** Query what features the wallet supports per chain
- **Porto Methods:** `wallet_getCapabilities`
- **Priority:** P1
- **Status:** [x] Implemented
- **Implementation Notes:** `popupPortoService.getCapabilities()` fetches per-chain capabilities. Used to get available fee tokens for gas payment selection.

### 6.2 Capability Discovery for dApps
- **Description:** Allow dApps to discover wallet capabilities before requesting features
- **Porto Methods:** `wallet_getCapabilities`
- **Priority:** P1
- **Status:** [x] Implemented (internal use)
- **Implementation Notes:** Currently used internally for fee token discovery. Can be exposed to dApps via message handler.

---

## 7. Network/Chain Management

### 7.1 Get Current Chain
- **Description:** Get the current chain ID
- **Porto Methods:** `eth_chainId`
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Per-origin chain context supported.

### 7.2 Switch Chain
- **Description:** Switch to a different chain
- **Porto Methods:** `wallet_switchEthereumChain` (EIP-3326)
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Per-origin chain switching with chainChanged events.

### 7.3 Add Chain
- **Description:** Add a new chain (EIP-3085)
- **Porto Methods:** `wallet_addEthereumChain`
- **Priority:** P2
- **Status:** [ ] Not Implemented (partial)
- **Implementation Notes:** Currently only supports built-in chains, no custom chain addition.

### 7.4 Multi-Chain Balance View
- **Description:** View balances across all supported chains simultaneously
- **Porto Methods:** `wallet_getAssets`, RPC calls per chain
- **Priority:** P1
- **Status:** [x] Implemented (partial)
- **Implementation Notes:** portfolioService fetches balances across chains.

---

## 8. Relay Health & Status

### 8.1 Relay Health Check
- **Description:** Check if Porto relay is healthy and operational
- **Porto Methods:** `health` (Relay)
- **Priority:** P1
- **Status:** [ ] Not Implemented
- **Implementation Notes:** Useful for showing connection status and debugging.

---

## 9. Developer/dApp Integration

### 9.1 EIP-1193 Provider
- **Description:** Standard Ethereum provider interface for dApp communication
- **Porto Methods:** All EIP-1193 methods
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Full EIP-1193 compliant provider injected into pages.

### 9.2 EIP-6963 Provider Discovery
- **Description:** Multi-wallet discovery standard
- **Porto Methods:** N/A (wallet announcement standard)
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** Announces Porto Wallet via EIP-6963 events.

### 9.3 Event Emissions
- **Description:** Emit standard events (accountsChanged, chainChanged, connect, disconnect)
- **Porto Methods:** N/A (standard events)
- **Priority:** P0
- **Status:** [x] Implemented
- **Implementation Notes:** eventBroadcaster handles all event emissions.

### 9.4 MetaMask Compatibility
- **Description:** Compatibility with dApps expecting MetaMask-specific behavior
- **Porto Methods:** N/A (compatibility layer)
- **Priority:** P0
- **Status:** [x] Implemented (partial)
- **Implementation Notes:** Provider has isMetaMask=true for compatibility.

---

## Implementation Roadmap Summary

### Phase 1: MVP (P0 Features) - COMPLETE
- [x] Account creation/connection via WebAuthn
- [x] Multi-account management
- [x] Transaction sending via wallet_sendCalls
- [x] Message signing (personal_sign, eth_signTypedData_v4)
- [x] Chain switching
- [x] dApp connection management
- [x] EIP-1193/EIP-6963 provider

### Phase 2: Production Ready (P1 Features) - MOSTLY COMPLETE
- [x] wallet_disconnect integration
- [x] wallet_getCallsHistory for complete transaction history
- [x] wallet_getAssets integration (unified balance fetching)
- [x] Gas fee token selection (via wallet_getCapabilities)
- [x] wallet_getCapabilities implementation
- [x] Token sending UI (ERC-20 transfers)
- [ ] Session key permissions (wallet_grantPermissions)
- [ ] Relay health monitoring

### Phase 3: Advanced Features (P2 Features)
- [ ] EOA upgrade to smart account
- [ ] wallet_prepareCalls for advanced users
- [ ] Sponsored/gasless transactions
- [ ] Cross-chain funding
- [ ] NFT display and transfer
- [ ] Custom chain addition
- [ ] Full key management (wallet_getKeys)

---

## Porto SDK Method Reference

### SDK Provider Methods (via provider.request)

| Method | Category | Priority | Status |
|--------|----------|----------|--------|
| `eth_accounts` | Account | P0 | Implemented |
| `eth_requestAccounts` | Account | P0 | Implemented |
| `eth_sendTransaction` | Transaction | P0 | Implemented |
| `eth_signTypedData_v4` | Signing | P0 | Implemented |
| `personal_sign` | Signing | P0 | Implemented |
| `wallet_connect` | Account | P0 | Implemented |
| `wallet_disconnect` | Account | P1 | Implemented |
| `wallet_getAssets` | Assets | P1 | Implemented |
| `wallet_getCapabilities` | Capabilities | P1 | Implemented |
| `wallet_getCallsStatus` | Transaction | P0 | Implemented |
| `wallet_getCallsHistory` | Transaction | P1 | Implemented |
| `wallet_getPermissions` | Permissions | P1 | Partial |
| `wallet_grantPermissions` | Permissions | P1 | Not Implemented |
| `wallet_revokePermissions` | Permissions | P1 | Not Implemented |
| `wallet_prepareUpgradeAccount` | Account | P2 | Not Implemented |
| `wallet_prepareCalls` | Transaction | P2 | Not Implemented |
| `wallet_sendCalls` | Transaction | P0 | Implemented |
| `wallet_sendPreparedCalls` | Transaction | P2 | Not Implemented |
| `wallet_upgradeAccount` | Account | P2 | Not Implemented |

### Relay RPC Methods (direct relay calls)

| Method | Category | Priority | Status |
|--------|----------|----------|--------|
| `wallet_getCapabilities` | Capabilities | P1 | Implemented |
| `wallet_getKeys` | Account | P2 | Not Implemented |
| `wallet_getAssets` | Assets | P1 | Implemented |
| `wallet_prepareCalls` | Transaction | P2 | Not Implemented |
| `wallet_sendPreparedCalls` | Transaction | P2 | Not Implemented |
| `wallet_prepareUpgradeAccount` | Account | P2 | Not Implemented |
| `wallet_upgradeAccount` | Account | P2 | Not Implemented |
| `wallet_getCallsStatus` | Transaction | P0 | Implemented |
| `wallet_getCallsHistory` | Transaction | P1 | Implemented |
| `health` | Status | P1 | Not Implemented |

---

## Feature Dependencies

```
Account Management
    |
    v
Transaction Features <-- wallet_sendCalls core
    |
    v
Session Keys & Permissions (requires account)
    |
    v
Advanced Features (sponsorship, cross-chain)
```

---

## Notes

1. **WebAuthn Context**: Porto SDK requires visible UI context for WebAuthn prompts. All signing operations must be triggered from popup, not background service worker.

2. **EIP-5792 (wallet_sendCalls)**: This is the primary transaction method for Porto. Traditional eth_sendTransaction is supported for compatibility but routes through wallet_sendCalls internally.

3. **Session Keys**: One of Porto's most powerful features. Enables "approve once" UX for gaming, trading, and other frequent-transaction use cases.

4. **Fee Tokens**: Porto allows paying gas in tokens other than the native currency (ETH). This is a significant UX improvement.

5. **Cross-Chain Funding**: Porto can automatically source funds from other chains if needed. Advanced feature requiring careful UX design.

---

*Document Version: 1.1*
*Last Updated: November 2024*

---

## Recent Implementation Summary (v1.1)

### Porto SDK Methods Now Implemented:
1. **`wallet_getAssets`** - Unified balance fetching for native + ERC-20 tokens
2. **`wallet_getCallsHistory`** - Complete transaction history from Porto
3. **`wallet_getCallsStatus`** - Transaction status polling with auto-refresh
4. **`wallet_getCapabilities`** - Fee token discovery for gas payment options
5. **`wallet_disconnect`** - Proper session cleanup

### Key Architecture Changes:
- **Zustand Store**: Centralized asset state with 30-second cache TTL
- **Transaction Watcher**: `useTransactionWatcher` hook polls pending transactions
- **Auto-Refresh**: Balances refresh on account/chain switch and transaction confirmation
- **History Sync**: `historyRefreshTrigger` keeps History page in sync with confirmations
