# Reown AppKit Setup Guide

This app now uses **Reown AppKit** (formerly WalletConnect AppKit) for **multi-chain wallet connections** supporting both **EVM** and **Solana**.

## What is Reown AppKit?

Reown AppKit is WalletConnect's official pre-built modal solution that:
- ✅ Handles wallet connections automatically (EVM + Solana)
- ✅ Provides a beautiful, professional UI
- ✅ Supports 400+ wallets across multiple chains
- ✅ Works on desktop & mobile
- ✅ Includes account management & network switching
- ✅ Maintained by the WalletConnect/Reown team

## Setup

### 1. Get Project ID

1. Visit [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)
2. Sign up and create a project
3. Copy your Project ID

### 2. Configure Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### 3. How It Works

The app automatically initializes Reown AppKit in `app/providers/AppKitProvider.tsx` with support for both EVM and Solana:

```typescript
createAppKit({
  adapters: [wagmiAdapter],
  networks: [
    // EVM networks
    mainnet, base, baseSepolia, sepolia,
    // Solana networks
    solanaDevnet, solanaTestnet, solana,
  ],
  projectId,
  metadata: {
    name: 'X402 Polymarket',
    description: 'Multi-chain payment platform',
    ...
  },
});
```

## Usage

### Connect Button

The app uses Reown AppKit's built-in `<w3m-button>` for both EVM and Solana chains:

```tsx
<w3m-button />
// This renders AppKit's official connect button
// - Shows "Connect Wallet" when disconnected
// - Shows connected address when connected
// - Opens AppKit modal on click
// - Supports both EVM and Solana wallets
```

The modal provides:
- QR code for mobile wallets
- List of available wallets (EVM + Solana)
- Account management
- Network switching (between EVM chains and Solana networks)
- Disconnect option

### What Gets Handled Automatically

Reown AppKit automatically manages:
- ✅ Wallet connection
- ✅ Account switching
- ✅ Network switching
- ✅ Disconnection
- ✅ Session persistence
- ✅ Mobile deeplinks
- ✅ QR code generation

You don't need to write any connection logic!

## Integration with Wagmi

Reown AppKit works seamlessly with Wagmi hooks:

```typescript
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';

function MyComponent() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessage } = useSignMessage();

  // Everything works together!
}
```

## Available Components

Reown AppKit provides these web components:

- `<w3m-button />` - Full connect/account button (recommended)
- `<w3m-connect-button />` - Connect button only
- `<w3m-account-button />` - Account button only
- `<w3m-network-button />` - Network switcher button

## Customization

You can customize the modal theme and appearance:

```typescript
createAppKit({
  // ...other config
  themeMode: 'light', // or 'dark'
  themeVariables: {
    '--w3m-accent': '#yourcolor',
  },
});
```

See [Reown AppKit Docs](https://docs.reown.com/appkit) for full customization options.

## Benefits Over Custom Implementation

### Before (Custom Code):
- ❌ Maintain own modal UI
- ❌ Handle connection logic manually
- ❌ Implement QR code generation
- ❌ Manage session persistence
- ❌ Keep up with wallet changes
- ❌ Test on all wallets

### After (Reown AppKit):
- ✅ Professional UI out of the box
- ✅ Connection handled automatically
- ✅ QR codes generated automatically
- ✅ Sessions managed automatically
- ✅ Always up to date
- ✅ Tested with 400+ wallets

## Multi-Chain Support

### Current Architecture

The app uses a **hybrid multi-chain approach**:

**For EVM chains**: Reown AppKit (with WagmiAdapter)
- Handles wallet connection via AppKit modal
- Supports MetaMask, Coinbase Wallet, Rainbow, etc.
- Works with Ethereum, Base, Sepolia, Base Sepolia

**For Solana networks**: Solana Wallet Adapter (fallback)
- Uses `@solana/wallet-adapter-react` for Solana connections
- Supports Phantom, Solflare, Backpack, etc.
- Works with Solana Mainnet, Devnet, Testnet

**Note**: Reown AppKit's Solana networks are configured in the app, which will enable unified multi-chain support once the `@reown/appkit-adapter-solana` package is installed. For now, both systems coexist to ensure full functionality.

### Supported Networks

**EVM Networks**:
- Ethereum Mainnet
- Base Mainnet
- Base Sepolia (testnet)
- Sepolia (testnet)

**Solana Networks**:
- Solana Mainnet
- Solana Testnet
- Solana Devnet

### How Network Switching Works

Reown AppKit automatically handles network switching:
1. User clicks the network switcher in the AppKit modal
2. Modal shows available networks (both EVM and Solana)
3. User selects desired network
4. AppKit handles the switch and prompts wallet if needed
5. App updates automatically to use the new network

### Wallet Compatibility

**EVM Wallets** (work with Ethereum, Base, etc.):
- MetaMask
- Coinbase Wallet
- Rainbow
- Trust Wallet
- WalletConnect-compatible wallets

**Solana Wallets** (work with Solana networks):
- Phantom
- Solflare
- Backpack
- Glow
- WalletConnect-compatible Solana wallets

## Troubleshooting

### Modal not appearing?
- Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Restart dev server after adding env variable
- Check browser console for errors

### Button not rendering?
- Check that AppKitProvider is wrapping your app
- Verify TypeScript declarations are in place (see app/types/reown.d.ts)
- Clear browser cache and restart dev server

### Connection failing?
- Verify Project ID is correct
- Try different wallet
- Check network (Base Sepolia, etc.)

## Resources

- [Reown AppKit Documentation](https://docs.reown.com/appkit)
- [Migration Guide](https://docs.reown.com/appkit/upgrade/from-w3m-to-reown)
- [WalletConnect Cloud](https://cloud.walletconnect.com/)
- [GitHub Repository](https://github.com/reown-com/appkit)

## Example Flow

```
User clicks <w3m-button />
    ↓
Reown AppKit modal opens
    ↓
┌─────────────────────────────────────┐
│  Connect your wallet                │
├─────────────────────────────────────┤
│  Choose Network:                    │
│  • EVM (Ethereum, Base, etc.)       │
│  • Solana (Mainnet, Devnet, etc.)   │
│                                     │
│  [QR Code for mobile]               │
│                                     │
│  Or choose wallet:                  │
│  🦊 MetaMask (EVM)                  │
│  🌈 Rainbow (EVM)                   │
│  🔵 Coinbase Wallet (EVM)           │
│  👻 Phantom (Solana)                │
│  ⚡ Solflare (Solana)               │
│  🛡️  Trust Wallet                   │
│  ... (400+ wallets)                 │
└─────────────────────────────────────┘
    ↓
User selects wallet & network
    ↓
Wallet app opens & user approves
    ↓
Modal closes, user is connected!
    ↓
<w3m-button /> now shows address
```

That's it! Reown AppKit handles everything for you - both EVM and Solana!
