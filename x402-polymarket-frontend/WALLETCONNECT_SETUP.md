# WalletConnect Setup Guide

This guide will help you set up WalletConnect for your application, enabling users to connect with 400+ different wallets.

**Official Documentation**: [https://docs.walletconnect.network/](https://docs.walletconnect.network/)

## Why WalletConnect?

WalletConnect is the industry standard for connecting wallets to dApps. It provides:

- 🔗 **Universal Compatibility** - Works with 400+ wallets (MetaMask, Trust Wallet, Rainbow, Coinbase Wallet, etc.)
- 📱 **Mobile Support** - Seamless mobile wallet connections via QR code
- 🔒 **Security** - End-to-end encrypted connections
- 🌐 **Multi-Chain** - Supports multiple blockchain networks
- 🆓 **Free Tier** - Generous free tier for development and small projects

## Step-by-Step Setup

### 1. Create a WalletConnect Cloud Account

1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Click **"Sign Up"** (or **"Sign In"** if you already have an account)
3. Sign up using GitHub, Google, or Email

### 2. Create a New Project

1. Once logged in, click **"Create"** or **"New Project"**
2. Fill in the project details:
   - **Project Name**: `X402 Polymarket` (or your app name)
   - **Homepage URL**: `http://localhost:3000` (for development) or your production URL
3. Click **"Create"**

### 3. Get Your Project ID

1. After creating the project, you'll see your **Project ID** in the project dashboard
2. Copy the Project ID (format: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
3. Keep this ID safe - you'll need it in the next step

### 4. Configure Your Environment Variables

1. In your project root, create a `.env.local` file (if it doesn't exist)
2. Add your WalletConnect Project ID:

```bash
# Copy from .env.example and fill in your values

# WalletConnect (REQUIRED)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Other required variables
NEXT_PUBLIC_RECEIVER_ADDRESS=0x209693Bc6afc0C5328bA36FaF03C514EF312287C
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_FACILITATOR_URL=https://facilitator.example.com
NEXT_PUBLIC_CDP_CLIENT_KEY=your_cdp_client_key_here
```

3. Replace `your_project_id_here` with your actual Project ID from step 3

### 5. Restart Your Development Server

```bash
# Stop the current server (Ctrl+C)
pnpm dev
```

## Testing the Connection

1. Open your app at `http://localhost:3000`
2. Enter an amount and click "Proceed to Payment"
3. Select **EVM** as the blockchain
4. Click **"Connect Wallet"**
5. **WalletConnect's official modal will appear** with wallet options

### Using WalletConnect Modal

The official WalletConnect modal provides:

**Desktop Experience:**
1. WalletConnect modal appears with QR code + wallet list
2. **Option A - QR Code** (Recommended):
   - Scan QR with your mobile wallet app (MetaMask, Trust, Rainbow, etc.)
   - Approve connection on mobile
   - Desktop automatically connects
3. **Option B - Desktop Wallet Extension**:
   - Click on a wallet from the list (MetaMask, Coinbase Wallet, etc.)
   - Browser extension opens automatically
   - Approve connection
   - Done!

**Mobile Experience:**
1. Modal shows list of installed wallets
2. Tap your preferred wallet
3. App opens automatically
4. Approve connection
5. Return to browser - you're connected!

## Supported Wallets

WalletConnect works with 400+ wallets including:

- 🦊 MetaMask
- 🌈 Rainbow
- 🔵 Coinbase Wallet
- 🛡️ Trust Wallet
- 🔷 Ledger Live
- ⚡ Zerion
- 🔐 Safe
- And many more!

## Production Configuration

When deploying to production:

1. Create a new project in WalletConnect Cloud for production
2. Update your production environment variables
3. Update the project URL to your production domain
4. Enable analytics in WalletConnect Cloud dashboard

## Troubleshooting

### QR Code Not Showing

- Make sure your `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set correctly
- Check the browser console for errors
- Restart your dev server after adding the environment variable

### Connection Failing

- Verify your Project ID is correct
- Make sure your wallet app is up to date
- Try a different wallet app
- Check WalletConnect Cloud dashboard for any service issues

### Modal Not Appearing

- Clear your browser cache
- Make sure you're on the EVM chain (not Solana)
- Check that the WalletButton component is rendering correctly

## Free Tier Limits

WalletConnect Cloud offers a generous free tier:

- ✅ Unlimited projects
- ✅ Up to 1 million monthly requests
- ✅ Email support
- ✅ All features included

This is more than enough for most applications during development and early production.

## Additional Resources

- **[WalletConnect Network Documentation](https://docs.walletconnect.network/)** - Official docs
- **[WalletConnect Cloud Dashboard](https://cloud.walletconnect.com/)** - Manage your projects
- **[Supported Wallets](https://walletconnect.network/products)** - Browse compatible wallets
- **[WagmiJS Documentation](https://wagmi.sh/)** - React hooks for Ethereum
- **[AppKit Documentation](https://docs.walletconnect.network/appkit/overview)** - WalletConnect's Web3 modal

## Implementation Details

This project uses:
- **WalletConnect v2** with official built-in modal
- **WagmiJS v2** for React hooks and wallet management
- **WalletConnect's native UI** for wallet selection (QR code + wallet list)

The modal automatically detects:
- Available wallet extensions (MetaMask, Coinbase Wallet, etc.)
- Mobile wallets via deeplinks
- Browser environment (desktop vs mobile)

See the [WalletConnect Network Docs](https://docs.walletconnect.network/) for advanced features:
- Sign API for transaction signing
- Auth API for authentication
- Push API for notifications
- Web3Inbox for messaging

---

**Need help?**
- Check the [WalletConnect Network Documentation](https://docs.walletconnect.network/)
- Visit the [WalletConnect Discord](https://discord.walletconnect.network/)
- Open an issue in this repository
