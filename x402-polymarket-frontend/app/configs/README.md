# Configuration Files

All application configuration is centralized in this folder. These files contain non-sensitive configuration values that can be safely committed to version control.

## Files

### `solana.ts`
Solana blockchain connection configuration.

**Exports:**
- `SOLANA_CONFIG`: RPC URL, commitment level, timeouts, and retry settings

**Usage:**
```typescript
import { SOLANA_CONFIG } from '@/app/configs/solana';
const connection = new Connection(SOLANA_CONFIG.rpcUrl, SOLANA_CONFIG.commitment);
```

---

### `contract.ts`
Prediction market smart contract configuration.

**Exports:**
- `CONTRACT_CONFIG`: Program ID, authority, network
- `PDA_SEEDS`: Program Derived Address seeds for account derivation
- `TOKEN_NAMES`: Token naming constants (YES/NO)

**Usage:**
```typescript
import { CONTRACT_CONFIG, PDA_SEEDS } from '@/app/configs/contract';
const programId = CONTRACT_CONFIG.programId;
```

---

### `x402.ts`
X402 payment integration configuration.

**Exports:**
- `X402_CONFIG`: Payment address, facilitator URL, network, pricing

**Usage:**
```typescript
import { X402_CONFIG } from '@/app/configs/x402';
const handler = paymentMiddleware(X402_CONFIG.paymentAddress, ...);
```

**Configuration Required:**
- Update `paymentAddress` with your wallet address for receiving USDC payments
  - For Solana: Use your Solana address (base58 format) - **Recommended for simplicity**
  - For Base/Ethereum: Use your EVM address (0x... format)
- Update `network` to match your payment address:
  - Solana: `'solana'` or `'solana-devnet'`
  - Base: `'base'` or `'base-sepolia'`
  - Ethereum: `'ethereum'` or other supported networks
- Facilitator URL defaults to `https://x402.org/facilitator` and typically doesn't need to be changed

**Multi-Chain Architecture:**
- Single-chain (Solana): Pay on Solana → Swap on Solana → Deliver on Solana
- Cross-chain (Base/ETH): Pay on Base/ETH → Swap on Solana → Deliver on Solana
- The Solana recipient address (where tokens are delivered) is specified in the API request body

---

## Environment Variables

Sensitive values (private keys, secrets) should **never** be in these config files. They belong in environment variables:

| Variable | Location | Purpose |
|----------|----------|---------|
| `X402_BACKEND_PRIVATE_KEY` | `.env.local` | **Required.** Solana wallet private key (base58) for executing swaps |
| `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` | `.env.local` | Optional custom Solana RPC endpoint |

**Note:** X402 payment address and facilitator URL are configured in `/app/configs/x402.ts` (not environment variables) since they are not sensitive values.

## Modifying Configuration

Most configuration changes in these files take effect without restarting the server. However, changes to values referenced at build time may require a restart:

```bash
# Restart the development server
pnpm dev
```

## Network Configuration

The application automatically switches configuration based on `NODE_ENV`:

- **Development** (`NODE_ENV=development`):
  - Solana: Devnet
  - X402: Base Sepolia testnet

- **Production** (`NODE_ENV=production`):
  - Solana: Mainnet
  - X402: Base mainnet

## Security Notes

✅ **Safe to commit**: All files in this folder
❌ **Never commit**: `.env.local`, `.env`, private keys

Configuration files are designed to be environment-agnostic and work across development, staging, and production with automatic network detection.
