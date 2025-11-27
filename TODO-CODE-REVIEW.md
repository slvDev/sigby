# Code Review Issues (Porto SDK Migration)

## High Priority

### 1. Remove console.log in production
- `src/popup/portoService.ts` - lines 59, 65-66, 87-88, 133-136
- `src/popup/pages/Tokens.tsx` - lines 126, 138

### 2. Replace native dialogs with custom UI
- `src/popup/pages/Send.tsx:90` - `alert()` → custom success modal
- `src/popup/pages/Settings.tsx:105` - `confirm()` → custom confirmation modal

### 3. Add React error boundaries
- Wrap Porto SDK calls to prevent popup crash on unexpected errors

### 4. Type Porto provider properly
- `src/popup/portoService.ts:51` - `any` → proper Porto provider type

## Medium Priority

### 5. Batch token auto-removal
- `src/popup/pages/Tokens.tsx:115-131` - sequential → batch message

### 6. Document disconnect() error handling
- `src/popup/portoService.ts:511-513` - intentional error swallowing needs JSDoc

## Features / Enhancements

### 7. Add fee token selector to native ETH send page
- `src/popup/pages/Send.tsx` - Add `FeeTokenSelector` component to allow paying gas with ERC20 tokens (USDC, USDT) for native ETH transfers
- Porto supports this via `capabilities.feeToken` in `wallet_sendCalls`
