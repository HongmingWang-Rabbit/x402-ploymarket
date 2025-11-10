# X402 Payment Integration Guide

Simple x402 integration for buying prediction market tokens with multi-chain support.

## Overview

**Multi-chain payment flow:**

x402 supports payments on multiple blockchains. You can choose:

### Option 1: Single-chain (Solana → Solana)
1. User pays USDC on **Solana** via x402 → Your Solana address receives payment
2. Backend executes swap on **Solana** using backend wallet
3. Prediction market tokens sent to user's **Solana address**

### Option 2: Cross-chain (Base/ETH → Solana)
1. User pays USDC on **Base/Ethereum** via x402 → Your EVM address receives payment
2. Backend executes swap on **Solana** using backend wallet
3. Prediction market tokens sent to user's **Solana address**

**Configuration**: Set your preferred network and payment address in `/app/configs/x402.ts`

The middleware handles dynamic pricing based on the swap amount.

## Setup

### 1. Environment Variable

Add to your `.env.local`:

```bash
# Backend wallet private key (base58 encoded)
# This is the ONLY sensitive value - keep it secret!
X402_BACKEND_PRIVATE_KEY=your_base58_private_key_here
```

### 2. X402 Payment Configuration

Update `/app/configs/x402.ts` with your payment receiving address and network:

```typescript
export const X402_CONFIG = {
  // For Solana: Use your Solana address (recommended for simplicity)
  paymentAddress: 'YourSolanaAddressHere',
  network: 'solana-devnet', // or 'solana' for mainnet

  // OR for Base/Ethereum: Use your EVM address
  // paymentAddress: '0xYourEVMAddressHere' as `0x${string}`,
  // network: 'base-sepolia', // or 'base', 'ethereum', etc.

  facilitatorUrl: 'https://x402.org/facilitator' as `${string}://${string}`,
  // ... rest of config
};
```

### 3. Generate Backend Wallet

```bash
# Generate new wallet
solana-keygen new --outfile backend-wallet.json

# Get the base58 private key
solana-keygen display backend-wallet.json
# Copy the private key to X402_BACKEND_PRIVATE_KEY
```

### 4. Fund Backend Wallet

The backend wallet needs SOL for gas fees:

```bash
# For devnet
solana airdrop 2 <backend-wallet-address> --url devnet

# For mainnet, send SOL from your treasury
solana transfer <backend-wallet-address> 1 --from your-wallet.json
```

## How X402 Works

The x402 middleware automatically handles payment verification:

1. **Request without payment** → Middleware returns `402 Payment Required` with payment instructions
2. **User pays via x402** → User's wallet sends payment to `X402_PAYMENT_ADDRESS` on Base network
3. **Payment verified** → x402 facilitator validates the payment and generates proof
4. **Retry with proof** → User retries request with `X-PAYMENT` header containing proof
5. **Access granted** → Middleware validates proof and allows request to proceed to route handler
6. **Swap executed** → Backend wallet executes swap and sends tokens to user's Solana address

The middleware is configured in `/middleware.ts` to protect the `/api/buy-token` endpoint.

## API Endpoint

### `POST /api/buy-token`

Executes a token purchase using x402 payment.

**Request Body:**
```typescript
{
  market: string;          // Market address
  tokenType: number;       // 0 = NO, 1 = YES
  direction: number;       // 0 = Buy, 1 = Sell
  amount: number;          // Amount in USDC
  recipient: string;       // User's wallet address
  slippage?: number;       // Optional: slippage percentage (e.g., 1 for 1%)
}
```

**Success Response (200):**
```json
{
  "success": true,
  "signature": "transaction_signature_here",
  "message": "Token purchase successful",
  "details": {
    "market": "AGcC...",
    "tokenType": "YES",
    "amount": 10,
    "recipient": "user_wallet_address"
  }
}
```

**Error Response (400/404/500):**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Usage Example

### From Frontend

```typescript
async function buyToken(
  market: string,
  tokenType: 'YES' | 'NO',
  amount: number,
  userAddress: string
) {
  const response = await fetch('/api/buy-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      market,
      tokenType: tokenType === 'YES' ? 1 : 0,
      direction: 0, // Buy
      amount,
      recipient: userAddress,
      slippage: 1, // 1% slippage tolerance
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('Purchase successful!', result.signature);
  } else {
    console.error('Purchase failed:', result.error);
  }

  return result;
}

// Example usage
const result = await buyToken(
  'AGcCPY76hibdReLTsjtEPW1tFwUbcH3wvCX8kKFm26c1',
  'YES',
  10, // 10 USDC
  'user_wallet_address_here'
);
```

### With x402 Integration

The x402 middleware automatically handles the payment flow. When you call the API, it will return a 402 response if payment is required, and the x402 SDK will handle the payment process:

```typescript
async function buyTokenWithX402(
  market: string,
  tokenType: 'YES' | 'NO',
  amount: number,
  userAddress: string
) {
  try {
    // Call the API - x402 middleware will handle payment if needed
    const response = await fetch('/api/buy-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        market,
        tokenType: tokenType === 'YES' ? 1 : 0,
        amount,
        recipient: userAddress,
        slippage: 1,
      }),
    });

    // If 402 Payment Required, x402 client SDK will:
    // 1. Prompt user to pay
    // 2. Retry request with payment proof
    // 3. Return the successful response

    const result = await response.json();

    if (result.success) {
      console.log('Purchase successful!', result.signature);
      return result;
    } else {
      console.error('Purchase failed:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error buying tokens:', error);
    throw error;
  }
}

// Example usage in a React component
function BuyButton() {
  const [loading, setLoading] = useState(false);
  const wallet = useWallet();

  async function handleBuy() {
    if (!wallet.publicKey) {
      alert('Please connect your Solana wallet first');
      return;
    }

    setLoading(true);
    try {
      const result = await buyTokenWithX402(
        'AGcCPY76hibdReLTsjtEPW1tFwUbcH3wvCX8kKFm26c1',
        'YES',
        10, // 10 USDC worth
        wallet.publicKey.toBase58()
      );

      alert(`Tokens purchased successfully! TX: ${result.signature}`);
    } catch (error) {
      alert('Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleBuy} disabled={loading}>
      {loading ? 'Processing...' : 'Buy YES Tokens'}
    </button>
  );
}
```

**Note:** The x402 client SDK (running in the user's browser) automatically detects 402 responses and handles the payment flow. You don't need to manually integrate payment logic - just make normal API calls.

## Validation

The API automatically validates:

✅ **Required fields** - market, tokenType, direction, amount, recipient
✅ **Amount** - Must be greater than 0
✅ **Token type** - Must be 0 (NO) or 1 (YES)
✅ **Direction** - Must be 0 (Buy) or 1 (Sell)
✅ **Addresses** - Must be valid Solana public keys
✅ **Market exists** - Verifies market is active
✅ **Backend balance** - Checks sufficient SOL for gas

## Error Messages

| Error | Meaning |
|-------|---------|
| `Missing required fields` | Request missing required parameters |
| `Amount must be greater than 0` | Invalid amount provided |
| `Invalid token type` | tokenType must be 0 or 1 |
| `Invalid market address` | Market address is not valid |
| `Market not found` | Market doesn't exist |
| `Insufficient backend wallet balance` | Backend wallet needs more SOL |
| `Swap failed` | Transaction failed (check logs for details) |

## Configuration

All configuration is centralized in `/app/configs/`:

### Solana Configuration (`/app/configs/solana.ts`)

```typescript
export const SOLANA_CONFIG = {
  rpcUrl: process.env.NODE_ENV === 'production'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com',

  commitment: 'confirmed' as const,
  confirmTimeout: 60000,
  maxRetries: 3,
};
```

### Smart Contract Configuration (`/app/configs/contract.ts`)

```typescript
export const CONTRACT_CONFIG = {
  programId: new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM'),
  programDataAddress: new PublicKey('3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq'),
  authority: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),
  network: 'devnet' as const,
};
```

### X402 Configuration (`/app/configs/x402.ts`)

```typescript
export const X402_CONFIG = {
  // Update this with your actual payment receiving address
  paymentAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,

  facilitatorUrl: 'https://x402.org/facilitator' as `${string}://${string}`,
  network: process.env.NODE_ENV === 'production' ? 'base' : 'base-sepolia',
  basePrice: '$0.01',
  config: {
    description: 'Buy prediction market tokens with x402',
    mimeType: 'application/json',
    maxTimeoutSeconds: 120,
  },
};
```

**Important:** Update the `paymentAddress` field with your actual EVM-compatible address where you want to receive x402 payments.

You can modify these configuration files without restarting the server (for most changes).

## Security

✅ **Private key in env** - Never commit to git
✅ **No webhook secrets** - Simpler security model
✅ **Validation** - All inputs validated
✅ **Balance checks** - Prevents failed transactions

## Monitoring

Monitor these metrics:
- Backend wallet SOL balance (for gas)
- Failed swap rate
- API response times

## Cost Estimation

Each swap transaction costs approximately:
- **Devnet**: ~0.00001 SOL (negligible)
- **Mainnet**: ~0.00001-0.0001 SOL per transaction

With 1000 transactions, you need ~0.1-1 SOL in the backend wallet.

## Testing

### Test without x402 (Direct API Call)

This will return a 402 Payment Required response:

```bash
curl -X POST http://localhost:3000/api/buy-token \
  -H "Content-Type: application/json" \
  -d '{
    "market": "AGcCPY76hibdReLTsjtEPW1tFwUbcH3wvCX8kKFm26c1",
    "tokenType": 1,
    "amount": 1,
    "recipient": "your_wallet_address",
    "slippage": 1
  }'
```

Expected response:
```json
{
  "statusCode": 402,
  "message": "Payment Required",
  "payment": {
    "address": "0x...",
    "amount": "0.01",
    "currency": "USDC",
    "network": "base-sepolia"
  }
}
```

### Test with x402 Client

Use the x402-compatible client in your frontend application to automatically handle the 402 payment flow. The client will:
1. Detect the 402 response
2. Prompt the user to pay
3. Automatically retry with payment proof
4. Return the successful response

## Troubleshooting

### "Backend wallet not configured"
- Add X402_BACKEND_PRIVATE_KEY to `.env.local`
- Restart Next.js server

### "Invalid backend wallet configuration"
- Check private key is valid base58 format
- Regenerate wallet if needed

### "Insufficient backend wallet balance"
- Airdrop more SOL (devnet) or send SOL (mainnet)

### "Market not found"
- Verify market address is correct
- Check market exists on-chain

### "Swap failed"
- Check market has sufficient liquidity
- Verify trade size is within limits
- Check logs for detailed error

### "Payment verification failed"
- Verify `paymentAddress` in `/app/configs/x402.ts` is set correctly
- Check payment was sent to the correct Base network address
- Ensure x402 facilitator URL is accessible
- Verify network configuration (base vs base-sepolia)

### "402 Payment Required not returning"
- Check middleware.ts is configured correctly
- Verify `paymentAddress` in `/app/configs/x402.ts` is not the default placeholder
- Restart Next.js server after modifying configuration
- Check middleware matcher includes '/api/buy-token'

## Support

For issues:
- **API errors**: Check server logs
- **Contract errors**: See contract documentation
- **X402 integration**: Contact x402 support
