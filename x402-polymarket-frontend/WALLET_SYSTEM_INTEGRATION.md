# Internal Wallet System Integration

This document explains how the application is integrated with the internal wallet system (`app/utils/wallet`) for maximum customization.

## Overview

The wallet system is designed to be **modular and customizable** by wrapping all wallet functionality through internal utilities. This makes it easy to:
- Add custom UI components
- Extend wallet functionality
- Support new chains
- Customize address formatting
- Build custom payment flows

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  (Header, WalletStatus, Custom Components)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Wallet Integration Layer                        │
│  (useWallet, useEVMWallet, useSolanaWallet hooks)           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Internal Wallet System                          │
│  (app/utils/wallet)                                         │
│  ┌──────────────┬──────────────┬─────────────┬──────────┐  │
│  │   Types      │   Utils      │  Constants  │  Errors  │  │
│  └──────────────┴──────────────┴─────────────┴──────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Wallet Providers                             │
│  (Reown AppKit, Solana Wallet Adapter)                      │
└─────────────────────────────────────────────────────────────┘
```

## Internal Wallet System Components

### 1. Types (`app/utils/wallet/types.ts`)

Core type definitions for blockchain-agnostic wallet operations:

```typescript
import { BlockchainType, WalletConnectionState } from '@/app/utils/wallet';

// Unified wallet interface
interface Wallet = EVMWallet | SolanaWallet;

// Connection states
enum WalletConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}
```

### 2. Utilities (`app/utils/wallet/utils.ts`)

Helper functions for all wallet operations:

```typescript
import { WalletUtils, EVMWalletUtils, SolanaWalletUtils } from '@/app/utils/wallet';

// Generic utilities
WalletUtils.formatAddress(address, chainType);
WalletUtils.isValidAddress(address, chainType);
WalletUtils.detectBlockchainType(address);

// EVM-specific
EVMWalletUtils.formatAddress(address);
EVMWalletUtils.getTransactionUrl(txHash, network);
EVMWalletUtils.getNetworkName(chainId);

// Solana-specific
SolanaWalletUtils.formatAddress(address);
SolanaWalletUtils.lamportsToSol(lamports);
SolanaWalletUtils.getTransactionUrl(signature, cluster);
```

### 3. Constants (`app/utils/wallet/constants.ts`)

Network configurations and default values:

```typescript
import { EVM_NETWORKS, SOLANA_NETWORKS, DEFAULT_CONFIG } from '@/app/utils/wallet';

// Access network configs
const baseConfig = EVM_NETWORKS['base-sepolia'];
const solanaConfig = SOLANA_NETWORKS['devnet'];

// Use defaults
const { ADDRESS_DISPLAY_START_CHARS, ADDRESS_DISPLAY_END_CHARS } = DEFAULT_CONFIG;
```

### 4. Errors (`app/utils/wallet/errors.ts`)

Wallet-specific error handling:

```typescript
import {
  WalletConnectionError,
  WalletSignatureError,
  WalletTransactionError,
  isWalletError,
} from '@/app/utils/wallet';
```

## How Components Are Integrated

### Header Component

The Header uses the internal wallet system through the `WalletStatus` component:

```typescript
// components/layout/Header.tsx
import { WalletStatus } from '@/components/wallet';

{isConnected && (
  <WalletStatus
    showNetwork={true}    // Uses internal network configs
    showAddress={true}    // Uses internal address formatting
  />
)}
```

**What WalletStatus does internally:**
1. Gets wallet data from `useWallet` hook
2. Formats address using `WalletUtils.formatAddress()`
3. Gets network name using `EVMWalletUtils.getNetworkName()` or `SOLANA_NETWORKS`
4. Displays formatted data with proper styling

### WalletStatus Component

Fully integrated with internal wallet system:

```typescript
// components/wallet/WalletStatus.tsx
import { WalletUtils, EVMWalletUtils, SOLANA_NETWORKS } from '@/app/utils/wallet';

export function WalletStatus() {
  const { chainType, address } = useWallet();

  // Use internal utils for formatting
  const formattedAddress = WalletUtils.formatAddress(address, chainType);

  // Get network info from internal constants
  const networkName = chainType === BlockchainType.EVM
    ? EVMWalletUtils.getNetworkName(chainId)
    : SOLANA_NETWORKS['devnet'].name;

  return (/* Formatted display */);
}
```

### AddressDisplay Component

Shows how to use utilities for address operations:

```typescript
import { WalletUtils } from '@/app/utils/wallet';

export function AddressDisplay({ address, chainType }) {
  // Format using internal utils
  const formatted = WalletUtils.formatAddress(address, chainType);

  // Copy full address to clipboard
  const handleCopy = () => navigator.clipboard.writeText(address);

  return <span>{formatted}</span>;
}
```

## Customization Examples

### Example 1: Custom Transaction Explorer Link

```typescript
import { EVMWalletUtils, SolanaWalletUtils } from '@/app/utils/wallet';

function TransactionLink({ hash, chainType, network }) {
  const url = chainType === BlockchainType.EVM
    ? EVMWalletUtils.getTransactionUrl(hash, network)
    : SolanaWalletUtils.getTransactionUrl(hash, 'devnet');

  return <a href={url}>View Transaction</a>;
}
```

### Example 2: Network Badge with Internal Configs

```typescript
import { EVM_NETWORKS } from '@/app/utils/wallet';

function NetworkBadge({ chainId }) {
  const network = Object.values(EVM_NETWORKS).find(n => n.chainId === chainId);

  return (
    <div>
      <span>{network?.name}</span>
      <span>{network?.nativeCurrency.symbol}</span>
    </div>
  );
}
```

### Example 3: Solana Amount Display

```typescript
import { SolanaWalletUtils } from '@/app/utils/wallet';

function SolAmount({ lamports }) {
  const sol = SolanaWalletUtils.lamportsToSol(lamports);
  const formatted = SolanaWalletUtils.formatSol(lamports, 4);

  return <span>{formatted} SOL</span>;
}
```

### Example 4: Address Validator

```typescript
import { WalletUtils } from '@/app/utils/wallet';

function AddressInput({ value, onChange, chainType }) {
  const isValid = WalletUtils.isValidAddress(value, chainType);
  const detected = WalletUtils.detectBlockchainType(value);

  return (
    <div>
      <input value={value} onChange={onChange} />
      {isValid ? '✅ Valid' : '❌ Invalid'}
      {detected && `Detected: ${detected}`}
    </div>
  );
}
```

## Available Utility Functions

### WalletUtils (Generic)

| Function | Description |
|----------|-------------|
| `formatAddress(address, chainType)` | Format address for display |
| `isValidAddress(address, chainType)` | Validate address format |
| `detectBlockchainType(address)` | Auto-detect chain from address |
| `sleep(ms)` | Async delay helper |
| `retry(fn, maxAttempts)` | Retry with exponential backoff |

### EVMWalletUtils (EVM-specific)

| Function | Description |
|----------|-------------|
| `formatAddress(address, start?, end?)` | Format EVM address |
| `isValidAddress(address)` | Validate EVM address (0x...) |
| `getTransactionUrl(hash, network)` | Get explorer TX URL |
| `getAddressUrl(address, network)` | Get explorer address URL |
| `getNetworkName(chainId)` | Get network name from chain ID |
| `isSupportedChain(chainId)` | Check if chain is supported |

### SolanaWalletUtils (Solana-specific)

| Function | Description |
|----------|-------------|
| `formatAddress(address, start?, end?)` | Format Solana address |
| `isValidAddress(address)` | Validate Solana address |
| `getTransactionUrl(signature, cluster)` | Get explorer TX URL |
| `getAddressUrl(address, cluster)` | Get explorer address URL |
| `lamportsToSol(lamports)` | Convert lamports to SOL |
| `solToLamports(sol)` | Convert SOL to lamports |
| `formatSol(lamports, decimals)` | Format SOL with decimals |

## Network Configurations

### EVM Networks

Available in `EVM_NETWORKS` constant:
- `mainnet` - Ethereum Mainnet (chainId: 1)
- `base` - Base Mainnet (chainId: 8453)
- `base-sepolia` - Base Sepolia Testnet (chainId: 84532)
- `sepolia` - Sepolia Testnet (chainId: 11155111)
- `polygon` - Polygon (chainId: 137)
- `arbitrum` - Arbitrum One (chainId: 42161)

Each config includes:
```typescript
{
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: { name, symbol, decimals };
}
```

### Solana Networks

Available in `SOLANA_NETWORKS` constant:
- `mainnet` - Solana Mainnet Beta
- `devnet` - Solana Devnet
- `testnet` - Solana Testnet

Each config includes:
```typescript
{
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  cluster: 'mainnet-beta' | 'devnet' | 'testnet';
}
```

## Adding New Networks

### Adding EVM Network

Edit `app/utils/wallet/constants.ts`:

```typescript
export const EVM_NETWORKS = {
  // ... existing networks
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};
```

### Adding Solana Network

No changes needed - all Solana networks use the same structure.

## Custom Component Development

See `components/wallet/WalletCustomizationExample.tsx` for complete examples of:

1. ✅ Custom Wallet Info Card
2. ✅ Transaction Link Generator
3. ✅ Solana Amount Formatter
4. ✅ Network Switcher Dropdown
5. ✅ Address Validator Component

## Benefits of This Architecture

1. **🎨 Customizable** - Build custom UIs using internal utilities
2. **🔒 Type-Safe** - Full TypeScript support
3. **🔧 Maintainable** - Centralized wallet logic
4. **🚀 Extensible** - Easy to add new chains/features
5. **📦 Modular** - Import only what you need
6. **🎯 Consistent** - Unified API across all chains

## Best Practices

1. **Always use internal utils** for formatting and validation
2. **Import from `@/app/utils/wallet`** for type safety
3. **Use constants** for network configs instead of hardcoding
4. **Wrap new features** in the internal system for consistency
5. **Follow the examples** in `WalletCustomizationExample.tsx`

## Future Enhancements

The internal wallet system makes it easy to add:

- ✅ More blockchain networks (Polygon, Arbitrum, etc.)
- ✅ Custom wallet connection flows
- ✅ Transaction history tracking
- ✅ Balance checking utilities
- ✅ Token management
- ✅ ENS/SNS name resolution
- ✅ Multi-wallet support
- ✅ Wallet analytics

All of these can be built by extending the internal utilities while maintaining the same clean API.
