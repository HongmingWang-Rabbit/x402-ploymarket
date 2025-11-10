import { NextRequest, NextResponse } from 'next/server';
import { X402_CONFIG } from '@/app/configs/x402';
import { SOLANA_CONFIG } from '@/app/configs/solana';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

/**
 * X402 Payment Middleware Configuration
 *
 * Protects the /api/buy-token endpoint with x402 payment requirements.
 *
 * Architecture - Multi-chain support:
 * - User pays USDC on configured network (Solana, Base, Ethereum, etc.)
 * - Payment amount is dynamic based on swap amount in request body
 * - Payment goes to X402_CONFIG.paymentAddress
 * - For Solana: Single-chain flow (pay on Solana, swap on Solana, deliver on Solana)
 * - For cross-chain: Pay on one chain (Base/ETH), deliver tokens on Solana
 *
 * Flow:
 * 1. Request without payment → 402 Payment Required response with dynamic price + Solana details
 * 2. User pays via x402 on configured network → receives payment proof
 * 3. Retry request with X-PAYMENT header → middleware validates
 * 4. Valid payment → request proceeds to route handler
 * 5. Route handler executes Solana swap with backend wallet
 */

export async function middleware(req: NextRequest) {
  // Apply x402 payment middleware to buy-token endpoint
  if (req.nextUrl.pathname === '/api/buy-token' && req.method === 'POST') {
    // Clone request to read body without consuming it
    const clonedReq = req.clone();

    try {
      // Extract amount from request body for dynamic pricing
      const body = await clonedReq.json();
      const amount = body.amount || 0.01; // Default to 0.01 if not provided

      // Check if X-Payment header exists (user already paid)
      const xPayment = req.headers.get('X-Payment');

      // If no payment header, return 402 with Solana payment details
      if (!xPayment) {
        const isDevnet = X402_CONFIG.network.includes('devnet');
        const usdcMint = new PublicKey(
          isDevnet ? SOLANA_CONFIG.usdcMint.devnet : SOLANA_CONFIG.usdcMint.mainnet
        );
        const recipientWallet = new PublicKey(X402_CONFIG.paymentAddress as string);

        // Calculate recipient's USDC token account
        const recipientTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          recipientWallet
        );

        // Return 402 with Solana-specific payment details
        return NextResponse.json({
          statusCode: 402,
          message: 'Payment Required',
          payment: {
            tokenAccount: recipientTokenAccount.toBase58(),
            mint: usdcMint.toBase58(),
            amount: Math.floor(amount * 1_000_000), // Convert USDC to smallest units (6 decimals)
            amountUSDC: amount,
            cluster: isDevnet ? 'devnet' : 'mainnet',
          },
          config: {
            description: `Buy ${body.tokenType === 1 ? 'YES' : 'NO'} tokens - $${amount} USDC`,
            mimeType: 'application/json',
            maxTimeoutSeconds: 120,
          },
        }, { status: 402 });
      }

      // If payment header exists, decode and validate it
      console.log('[middleware] Payment proof received, validating...');

      try {
        // Decode the X-Payment header
        const paymentProofJson = Buffer.from(xPayment, 'base64').toString('utf-8');
        const paymentProof = JSON.parse(paymentProofJson);

        console.log('[middleware] Payment proof decoded:', {
          version: paymentProof.x402Version,
          scheme: paymentProof.scheme,
          network: paymentProof.network,
        });

        // Basic validation
        if (paymentProof.x402Version !== 1) {
          throw new Error('Unsupported x402 version');
        }

        if (paymentProof.scheme !== 'exact') {
          throw new Error('Unsupported payment scheme');
        }

        if (!paymentProof.payload?.serializedTransaction) {
          throw new Error('Missing serialized transaction in payment proof');
        }

        // For Solana payments, we trust the signed transaction
        // The backend will verify and submit it
        console.log('[middleware] ✓ Payment proof validated, allowing request through');

        // Allow the request to proceed to the route handler
        return NextResponse.next();
      } catch (err: any) {
        console.error('[middleware] Payment validation failed:', err.message);

        return NextResponse.json({
          statusCode: 402,
          message: 'Payment validation failed',
          error: err.message,
        }, { status: 402 });
      }
    } catch (error) {
      console.error('[middleware] Error:', error);

      return NextResponse.json({
        statusCode: 500,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }

  // Allow all other requests to proceed
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    '/api/buy-token',
  ],
};
