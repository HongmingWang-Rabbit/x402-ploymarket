# Paywall Integration Guide

## Overview

The paywall system now supports **both EVM and Solana** payments, giving users the flexibility to pay with their preferred blockchain.

## Features

✅ **Multi-Chain Support**: EVM (Base Sepolia) and Solana (Devnet)
✅ **Seamless Switching**: Users can switch between blockchains
✅ **Unified UI**: Consistent payment experience
✅ **x402 Integration**: EVM payments verified via x402 protocol
✅ **Modular Architecture**: Easy to extend with more payment methods

## How It Works

### User Flow

1. **User visits protected content** → Redirected to `/paywall`
2. **Select blockchain** → Choose EVM or Solana via ChainSwitcher
3. **Connect wallet** → Click "Connect Wallet" button
4. **Review payment** → See amount, recipient, and network
5. **Confirm payment** → Sign and send transaction
6. **Redirect** → Automatically redirected to content after success

### Architecture

```
Middleware (middleware.ts)
    ↓
Check payment-session cookie
    ↓
No session? → /paywall
    ↓
Paywall Component
    ├── ChainSwitcher (EVM/Solana)
    ├── WalletButton (Connect)
    └── Payment Form
        ├── EVMPaymentForm (x402 protocol)
        └── SolanaPaymentForm (Direct transfer)
```

## File Structure

```
app/
├── paywall/
│   └── page.tsx                  # Main paywall component
├── actions.ts                    # Server action for payment verification
├── layout.tsx                    # Wrapped with MultiChainWalletProvider
└── middleware.ts                 # Payment verification middleware
```

## Components

### Main Paywall (`app/paywall/page.tsx`)

```typescript
<Paywall>
  <ChainSwitcher />              // Switch between EVM/Solana
  <WalletButton />               // Connect wallet
  {chainType === EVM ? (
    <EVMPaymentForm />           // x402 payment
  ) : (
    <SolanaPaymentForm />        // Solana payment
  )}
</Paywall>
```

### EVM Payment Flow

1. **Prepare Payment Header**: Using x402's `preparePaymentHeader`
2. **Sign EIP-712 Message**: Via wagmi's `useSignTypedData`
3. **Create Payment Payload**: Combine header + signature
4. **Encode Payment**: Using x402's `exact.evm.encodePayment`
5. **Verify on Server**: Call `verifyPayment` server action
6. **Set Session Cookie**: On successful verification
7. **Redirect**: To protected content

### Solana Payment Flow

1. **Calculate Amount**: Convert SOL to lamports
2. **Create Transaction**: Using `SystemProgram.transfer`
3. **Get Blockhash**: From Solana RPC
4. **Send Transaction**: Via wallet adapter
5. **Wait for Confirmation**: Transaction confirmed
6. **Verify (Optional)**: Server-side verification
7. **Redirect**: To protected content

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
# x402 Configuration (EVM)
NEXT_PUBLIC_RECEIVER_ADDRESS=0x209693Bc6afc0C5328bA36FaF03C514EF312287C
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_FACILITATOR_URL=https://facilitator.x402.com
NEXT_PUBLIC_CDP_CLIENT_KEY=your_key_here

# WalletConnect (Optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

### Payment Configuration

Edit `app/paywall/page.tsx`:

```typescript
const PAYMENT_CONFIGS: Record<string, PaymentConfig> = {
  cheap: {
    amount: "0.01",                    // Amount in token/SOL
    description: "Access to cheap content",
    recipient: "0x...",                // EVM address
  },
  expensive: {
    amount: "0.25",
    description: "Access to expensive content",
    recipient: "0x...",
  },
};
```

### EVM Payment Requirements

```typescript
const evmPaymentRequirements: PaymentRequirements = {
  scheme: "exact",
  network: "base-sepolia",           // or "base", "mainnet", etc.
  maxAmountRequired: "10000",        // In token units (USDC has 6 decimals)
  resource: "https://example.com",
  description: "Payment description",
  payTo: "0x...",                    // Recipient address
  asset: "0x036CbD...",              // Token contract (USDC on Base Sepolia)
  extra: {
    name: "USDC",
    version: "2",
  },
};
```

### Solana Recipient Address

```typescript
// In SolanaPaymentForm, update the recipient
const recipientPubkey = new PublicKey(
  "YOUR_SOLANA_ADDRESS_HERE"  // Replace with your Solana address
);
```

## Customization

### Change Payment Amount

```typescript
const PAYMENT_CONFIGS = {
  myContent: {
    amount: "1.00",        // 1 USDC for EVM, 1 SOL for Solana
    description: "...",
    recipient: "...",
  }
};
```

### Add New Payment Tiers

```typescript
const PAYMENT_CONFIGS = {
  basic: { amount: "0.01", ... },
  pro: { amount: "0.10", ... },
  premium: { amount: "1.00", ... },
};

// Use query params to select tier
const searchParams = new URLSearchParams(window.location.search);
const tier = searchParams.get('tier') || 'basic';
const config = PAYMENT_CONFIGS[tier];
```

### Custom Styling

The paywall uses Tailwind CSS. Customize colors:

```typescript
// EVM (Blue theme)
className="bg-blue-600 hover:bg-blue-700"

// Solana (Purple theme)
className="bg-purple-600 hover:bg-purple-700"

// Change to your brand colors
className="bg-brand-600 hover:bg-brand-700"
```

## Testing

### Test on EVM (Base Sepolia)

1. Get test USDC from [Base Sepolia Faucet](https://faucet.circle.com/)
2. Connect MetaMask to Base Sepolia
3. Visit `/paywall`
4. Select EVM, connect wallet
5. Complete payment

### Test on Solana (Devnet)

1. Get test SOL from [Solana Faucet](https://faucet.solana.com/)
2. Connect Phantom/Solflare to Devnet
3. Visit `/paywall`
4. Select Solana, connect wallet
5. Complete payment

## Integrating with Your Backend

### EVM Payment Verification

The EVM payment is verified via the `verifyPayment` server action in `app/actions.ts`:

```typescript
export async function verifyPayment(payload: string): Promise<string> {
  const { verify, settle } = useFacilitator();

  const payment = exact.evm.decodePayment(payload);
  const valid = await verify(payment, paymentRequirements);

  if (!valid.isValid) {
    throw new Error(valid.invalidReason);
  }

  const settleResponse = await settle(payment, paymentRequirements);

  if (settleResponse.success) {
    // Set cookie, update database, etc.
    cookies().set("payment-session", payload);
  }

  return "Success";
}
```

### Solana Payment Verification

For production, add backend verification:

```typescript
// 1. Get transaction signature from frontend
const signature = await solanaWallet.sendTransaction(transaction);

// 2. Send to backend for verification
const response = await fetch('/api/verify-solana-payment', {
  method: 'POST',
  body: JSON.stringify({
    signature,
    amount: lamports,
    sender: publicKey.toBase58(),
  }),
});

// 3. Backend verifies transaction on Solana
// app/api/verify-solana-payment/route.ts
export async function POST(req: Request) {
  const { signature, amount, sender } = await req.json();

  const connection = new Connection(clusterApiUrl('devnet'));
  const tx = await connection.getTransaction(signature);

  // Verify transaction details
  if (tx && tx.meta?.err === null) {
    // Transaction successful
    // Set cookie, update database
    cookies().set("payment-session", signature);
    return Response.json({ success: true });
  }

  return Response.json({ success: false });
}
```

## Middleware Configuration

The middleware checks for payment session:

```typescript
// middleware.ts
export const middleware = (req: NextRequest) => {
  const paymentHeader = req.cookies.get("payment-session");

  if (!paymentHeader) {
    return NextResponse.rewrite(new URL("/paywall", req.url));
  }

  // Continue with x402 verification for paid users
  return x402PaymentMiddleware(req);
};
```

## Error Handling

### Common Errors

**"Please connect your wallet"**
- User hasn't connected wallet
- Wrong network selected

**"Transaction failed"**
- Insufficient balance
- User rejected transaction
- Network issues

**"Payment verification failed"**
- Invalid signature
- Expired payment intent
- Server-side verification failed

### Error Display

```typescript
{error && (
  <div className="bg-red-100 text-red-800 p-3 rounded-lg">
    {error}
  </div>
)}
```

## Production Checklist

### Before Going Live

- [ ] Update `PAYMENT_CONFIGS` with production amounts
- [ ] Change networks to mainnet (Base, Solana Mainnet)
- [ ] Update recipient addresses (your production wallets)
- [ ] Set up proper backend verification for Solana
- [ ] Add rate limiting to prevent spam
- [ ] Set up monitoring/alerts for failed payments
- [ ] Test with real (small) amounts
- [ ] Configure proper session expiration
- [ ] Add payment analytics/tracking
- [ ] Set up webhook for payment confirmations

### Security Considerations

1. **Never store private keys** in the frontend
2. **Validate all transactions** on the backend
3. **Use HTTPS** for all endpoints
4. **Implement rate limiting** on payment endpoints
5. **Verify token amounts** match expected values
6. **Check transaction confirmations** before granting access
7. **Use secure session cookies** with httpOnly flag
8. **Implement proper CORS** policies

## Advanced Features

### Dynamic Pricing

```typescript
// Fetch price from backend
const [price, setPrice] = useState<string>();

useEffect(() => {
  fetch('/api/get-price')
    .then(res => res.json())
    .then(data => setPrice(data.price));
}, []);
```

### Payment History

```typescript
// Track payments in database
await db.payments.create({
  userId,
  amount,
  blockchain: chainType,
  txHash: signature,
  timestamp: Date.now(),
});
```

### Recurring Payments

```typescript
// Check subscription status
const hasActiveSubscription = await checkSubscription(userId);

if (!hasActiveSubscription) {
  redirect('/paywall');
}
```

## Troubleshooting

### Wallet Won't Connect

1. Check if wallet extension is installed
2. Verify correct network in wallet
3. Check browser console for errors
4. Try refreshing the page

### Payment Fails

1. Ensure sufficient balance (token + gas)
2. Check network is correct
3. Verify recipient address is valid
4. Check RPC endpoint is responsive

### Redirect Not Working

1. Check cookie is being set
2. Verify middleware configuration
3. Check URL in redirect matches content path
4. Clear browser cookies and retry

## Resources

- [x402 Protocol Documentation](https://x402.org)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Wagmi Documentation](https://wagmi.sh)
- [Wallet Adapter](https://github.com/solana-labs/wallet-adapter)

## Support

For issues or questions:
- Check [WALLET_INTEGRATION_GUIDE.md](./WALLET_INTEGRATION_GUIDE.md)
- Review [ARCHITECTURE.md](./ARCHITECTURE.md)
- See example implementation in [app/wallet-example.tsx](./app/wallet-example.tsx)
