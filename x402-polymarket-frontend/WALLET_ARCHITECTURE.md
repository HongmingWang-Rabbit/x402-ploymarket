# Wallet Connection Architecture

This document explains the wallet connection architecture used in this application.

## Overview

The application supports **two blockchain ecosystems**:
- **EVM (Ethereum Virtual Machine)** - Base, Ethereum, Sepolia, Base Sepolia
- **Solana** - Devnet, Mainnet

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface                       │
│                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ Homepage     │  │ Paywall Page  │  │ Content      │ │
│  │ - Amount     │  │ - Chain       │  │ - Protected  │ │
│  │ - Description│  │   Switcher    │  │   Routes     │ │
│  │ - Pay Button │  │ - Wallet      │  │              │ │
│  │              │  │   Connection  │  │              │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Unified Wallet Interface                    │
│                  (useWallet Hook)                        │
│                                                          │
│  - Manages active blockchain type                       │
│  - Provides unified API for both chains                 │
│  - Handles chain switching                              │
└─────────────────────────────────────────────────────────┘
            │                              │
            ▼                              ▼
┌──────────────────────┐      ┌──────────────────────────┐
│   EVM Wallet Layer   │      │   Solana Wallet Layer    │
│  (useEVMWallet)      │      │  (useSolanaWallet)       │
│                      │      │                          │
│  WagmiJS + Viem      │      │  Wallet Adapter          │
└──────────────────────┘      └──────────────────────────┘
            │                              │
            ▼                              ▼
┌──────────────────────┐      ┌──────────────────────────┐
│  Wallet Providers    │      │  Solana Providers        │
│                      │      │                          │
│  - WalletConnect     │      │  - Phantom               │
│  - MetaMask          │      │  - Solflare              │
│  - Injected          │      │  - Torus                 │
└──────────────────────┘      └──────────────────────────┘
```

## EVM Wallet Connection Flow

### 1. **Provider Setup** (`app/providers/WalletProviders.tsx`)

```typescript
// Only WalletConnect connector is used:
- WalletConnect (REQUIRED - Project ID must be set)
  ↓
  Provides access to 400+ wallets via modal:
  - MetaMask
  - Rainbow
  - Trust Wallet
  - Coinbase Wallet
  - And 400+ more!
```

### 2. **WalletConnect Official Modal**

When user clicks "Connect Wallet" on EVM:

```
User clicks "Connect Wallet"
    ↓
WalletConnect prioritized (first connector)
    ↓
WalletConnect's built-in modal appears:
    - QR Code for mobile wallets
    - List of available desktop wallets
    - Automatic detection of installed wallets
    ↓
User selects connection method:
    - Scan QR with mobile wallet, OR
    - Click desktop wallet from list
    ↓
User approves in wallet app
    ↓
Connection established
    ↓
Modal closes, wallet info displayed
```

### 3. **WalletConnect Flow**

**Desktop:**
```
Click WalletConnect
    ↓
QR code displayed
    ↓
User scans with mobile wallet app
    ↓
Approve connection on mobile
    ↓
Desktop app connected
```

**Mobile:**
```
Click WalletConnect
    ↓
Deeplink opens wallet app
    ↓
Approve connection in wallet
    ↓
Return to browser
    ↓
App connected
```

## Solana Wallet Connection Flow

### 1. **Provider Setup**

```typescript
// Wallets initialized:
- Phantom Wallet
- Solflare Wallet
- Torus Wallet
```

### 2. **Connection Flow**

```
User clicks "Connect Wallet" on Solana
    ↓
Wallet Adapter modal opens (built-in)
    ↓
User selects wallet (Phantom, Solflare, etc.)
    ↓
Selected wallet opens
    ↓
User approves connection
    ↓
Connection established
    ↓
Wallet info displayed
```

## Key Components

### `useWallet` Hook (`app/hooks/wallet/useWallet.ts`)

**Unified interface** for both EVM and Solana:

```typescript
const {
  chainType,        // 'EVM' or 'SOLANA'
  isConnected,      // Connection status
  address,          // Wallet address
  activeWallet,     // Current wallet instance
  switchChainType   // Switch between EVM/Solana
} = useWallet();
```

### `WalletButton` Component (`components/wallet/WalletButton.tsx`)

**Smart connection button** that:
- Triggers WalletConnect's built-in modal for EVM
- Triggers Solana wallet adapter modal for Solana
- Displays connected address when connected
- Handles disconnection for both chains

### `ChainSwitcher` Component

**Toggle between blockchains:**
```
┌─────────────────┐
│ EVM │ Solana    │  ← User can switch
└─────────────────┘
```

## Payment Flow Integration

### 1. **User Journey**

```
Homepage
    ↓ (Enter amount & description)
Paywall Page
    ↓ (Select blockchain: EVM or Solana)
Connect Wallet
    ↓ (Choose connector & approve)
Review Payment Details
    ↓ (Confirm transaction)
Server Verification
    ↓ (Log "PAYMENT GOOD")
Redirect to Content
```

### 2. **EVM Payment** (via X402 Protocol)

```typescript
// Uses EIP-712 signatures + USDC token
1. Prepare payment header
2. Sign with wallet (EIP-712)
3. Create payment payload
4. Encode payment
5. Verify on server
6. Set session cookie
```

### 3. **Solana Payment** (Direct Transfer)

```typescript
// Uses SOL transfers
1. Calculate lamports
2. Create transaction
3. Get recent blockhash
4. Send transaction
5. Wait for confirmation
6. (Optional) Verify on server
```

## Configuration

### Environment Variables

```bash
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# X402 (EVM)
NEXT_PUBLIC_RECEIVER_ADDRESS=0x...
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_FACILITATOR_URL=...
NEXT_PUBLIC_CDP_CLIENT_KEY=...

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=...
```

### Supported Networks

**EVM:**
- Mainnet (Ethereum)
- Base
- Base Sepolia (Testnet)
- Sepolia (Testnet)

**Solana:**
- Devnet (Testnet)
- Mainnet Beta

## Best Practices

### 1. **WalletConnect Only**

This app uses **only WalletConnect** because:
- ✅ Works with 400+ wallets (including MetaMask, Trust, Rainbow, etc.)
- ✅ Better mobile experience with QR codes
- ✅ Universal compatibility - one connector for all wallets
- ✅ No need for multiple connectors
- ✅ Official WalletConnect modal with professional UX
- ✅ Automatic wallet detection

### 2. **Why Not Multiple Connectors?**

WalletConnect's modal already provides:
- Direct connection to MetaMask (if installed)
- Direct connection to Coinbase Wallet (if installed)
- QR code for mobile wallets
- List of 400+ supported wallets

No need for separate MetaMask or injected connectors!

### 3. **Error Handling**

All wallet operations include try-catch with custom error types:
- `WalletConnectionError`
- `WalletSignatureError`
- `WalletTransactionError`

### 4. **SSR Safety**

Wallet initialization only happens on client:
```typescript
if (typeof window === 'undefined') {
  return []; // No wallets during SSR
}
```

## Debugging

### Check Provider Status

```typescript
// In browser console:
console.log('WagmiConfig:', useConfig());
console.log('Connectors:', useConnect().connectors);
console.log('Account:', useAccount());
```

### Common Issues

**WalletConnect modal not showing:**
- Check if `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set in `.env.local`
- Verify you selected EVM chain (not Solana)
- Restart dev server after adding environment variable
- Clear browser cache

**Connection failing:**
- Check Project ID is valid
- Verify wallet app is updated
- Try different connector
- Check browser console for errors

**Hydration errors:**
- Already fixed with `suppressHydrationWarning`
- Caused by browser extensions (Grammarly, etc.)

## References

- [WalletConnect Network Docs](https://docs.walletconnect.network/)
- [Wagmi Documentation](https://wagmi.sh/)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [X402 Protocol](https://github.com/coinbase/x402)
- [Viem Documentation](https://viem.sh/)
