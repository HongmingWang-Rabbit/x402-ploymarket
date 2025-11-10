'use client';

import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { X402_CONFIG } from '@/app/configs/x402';

/**
 * X402 Payment Hook for Solana USDC Payments
 *
 * Architecture:
 * 1. Request payment quote from /api/buy-token (returns 402 Payment Required)
 * 2. User signs USDC transfer transaction (but doesn't submit it)
 * 3. Send transaction as X-Payment header proof
 * 4. Server validates payment, submits transaction, executes swap
 * 5. User receives prediction market tokens
 */

interface PaymentQuote {
  payment: {
    tokenAccount: string;    // Recipient's USDC token account
    mint: string;             // USDC mint address
    amount: number;           // Amount in smallest units (lamports)
    amountUSDC: number;       // Amount in USDC
    cluster: string;          // solana-devnet or solana-mainnet
  };
}

interface BuyTokenParams {
  market: string;
  tokenType: number;        // 0 = NO, 1 = YES
  amount: number;           // Amount in USDC
  recipient: string;        // User's Solana wallet address
  slippage?: number;
}

interface BuyTokenResult {
  success: boolean;
  signature?: string;
  message: string;
  error?: string;
  details?: {
    market: string;
    tokenType: string;
    amount: number;
    recipient: string;
  };
}

export function useX402Payment() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buy tokens using x402 payment flow
   */
  const buyTokenWithX402 = useCallback(async (
    params: BuyTokenParams
  ): Promise<BuyTokenResult> => {
    setLoading(true);
    setError(null);

    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      console.log('[x402] Step 1: Requesting payment quote from server...');

      // Step 1: Request payment quote (should return 402)
      const quoteResponse = await fetch('/api/buy-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      // If not 402, handle as normal response
      if (quoteResponse.status !== 402) {
        const result = await quoteResponse.json();
        setLoading(false);
        return result;
      }

      // Parse 402 payment quote
      const quote: PaymentQuote = await quoteResponse.json();
      console.log('[x402] Payment quote received:', quote.payment);

      const recipientTokenAccount = new PublicKey(quote.payment.tokenAccount);
      const usdcMint = new PublicKey(quote.payment.mint);
      const amount = quote.payment.amount;

      console.log('[x402] Step 2: Creating USDC payment transaction...');
      console.log('[x402]   Amount:', quote.payment.amountUSDC, 'USDC');
      console.log('[x402]   Recipient:', quote.payment.tokenAccount);

      // Step 2: Get payer's USDC token account
      const payerTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        wallet.publicKey
      );

      console.log('[x402]   Payer token account:', payerTokenAccount.toBase58());

      // Warning: If payer and recipient are the same, you're paying yourself (fine for testing)
      if (payerTokenAccount.toBase58() === recipientTokenAccount.toBase58()) {
        console.warn('[x402] ⚠️  Warning: You are paying yourself. This is fine for testing but update X402_CONFIG.paymentAddress for production.');
      }

      // Check if payer has USDC account and balance
      try {
        const payerAccount = await getAccount(connection, payerTokenAccount);
        const balance = Number(payerAccount.amount) / 1e6; // USDC has 6 decimals

        console.log('[x402]   Payer USDC balance:', balance);

        if (Number(payerAccount.amount) < amount) {
          throw new Error(
            `Insufficient USDC balance. Have: ${balance} USDC, Need: ${quote.payment.amountUSDC} USDC`
          );
        }
      } catch (err: any) {
        // Check if the error is because the account doesn't exist
        if (err.name === 'TokenAccountNotFoundError' ||
            err.message?.includes('could not find') ||
            err.message?.includes('Invalid') ||
            err.message?.includes('account does not exist')) {
          throw new Error(
            `You don't have a USDC token account yet. To use x402 payment, you need USDC in your wallet first. ` +
            `Please get some devnet USDC from a faucet or use the regular "Wallet" payment method instead.`
          );
        }
        throw err;
      }

      // Step 3: Check if recipient token account exists
      console.log('[x402] Step 3: Checking recipient token account...');
      let recipientAccountExists = false;
      try {
        await getAccount(connection, recipientTokenAccount);
        recipientAccountExists = true;
        console.log('[x402]   ✓ Recipient token account exists');
      } catch {
        console.log('[x402]   ⚠ Recipient token account needs to be created');
      }

      // Step 4: Create payment transaction (but don't submit it)
      console.log('[x402] Step 4: Building payment transaction...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      const tx = new Transaction({
        feePayer: wallet.publicKey,
        blockhash,
        lastValidBlockHeight,
      });

      // Add create account instruction if needed
      if (!recipientAccountExists) {
        // Parse recipient wallet from payment address config
        const recipientWallet = new PublicKey(X402_CONFIG.paymentAddress);

        const createAccountIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,         // payer
          recipientTokenAccount,    // associated token account address
          recipientWallet,          // owner
          usdcMint                  // mint
        );

        tx.add(createAccountIx);
        console.log('[x402]   + Added create token account instruction');
      }

      // Add USDC transfer instruction
      const transferIx = createTransferInstruction(
        payerTokenAccount,        // source
        recipientTokenAccount,    // destination
        wallet.publicKey,         // owner
        amount                    // amount in smallest units
      );

      tx.add(transferIx);
      console.log('[x402]   + Added transfer instruction');

      // Step 5: Sign the transaction (user approval)
      console.log('[x402] Step 5: Requesting user signature...');
      const signedTx = await wallet.signTransaction(tx);

      // Serialize the signed transaction
      const serializedTx = signedTx.serialize().toString('base64');
      console.log('[x402]   ✓ Transaction signed');

      // Step 6: Create x402 payment proof
      console.log('[x402] Step 6: Creating payment proof...');
      const paymentProof = {
        x402Version: 1,
        scheme: 'exact',
        network: quote.payment.cluster === 'devnet' ? 'solana-devnet' : 'solana-mainnet',
        payload: {
          serializedTransaction: serializedTx,
        },
      };

      // Base64 encode the payment proof
      const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');
      console.log('[x402]   ✓ Payment proof created');

      // Step 7: Retry request with X-Payment header
      console.log('[x402] Step 7: Sending payment proof to server...');
      const paidResponse = await fetch('/api/buy-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': xPaymentHeader,
        },
        body: JSON.stringify(params),
      });

      const result: BuyTokenResult = await paidResponse.json();

      if (result.success) {
        console.log('[x402] ✅ Payment successful!');
        console.log('[x402]   Transaction:', result.signature);
      } else {
        console.error('[x402] ❌ Payment failed:', result.error);
      }

      setLoading(false);
      return result;

    } catch (err: any) {
      console.error('[x402] Error:', err);
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      setLoading(false);

      return {
        success: false,
        message: 'Payment failed',
        error: errorMessage,
      };
    }
  }, [connection, wallet]);

  return {
    buyTokenWithX402,
    loading,
    error,
    isConnected: !!wallet.publicKey,
  };
}
