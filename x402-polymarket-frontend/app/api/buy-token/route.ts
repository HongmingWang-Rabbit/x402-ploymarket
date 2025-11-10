import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { PredictionMarketClient } from '@/app/lib/solana/client';
import { SOLANA_CONFIG } from '@/app/configs/solana';
import bs58 from 'bs58';

/**
 * Buy Token API - Multi-chain payment flow
 *
 * Architecture:
 * 1. User pays USDC on configured network (Solana/Base/ETH) via x402
 * 2. Payment goes to X402_CONFIG.paymentAddress on that network
 * 3. x402 middleware verifies payment and allows request to proceed
 * 4. This route executes swap on Solana using backend wallet (X402_BACKEND_PRIVATE_KEY)
 * 5. Prediction market tokens sent to user's Solana address (recipient parameter)
 *
 * Flow Options:
 * - Single-chain (Solana): Payment on Solana → Swap on Solana → Deliver on Solana
 * - Cross-chain (Base/ETH): Payment on Base/ETH → Swap on Solana → Deliver on Solana
 */

interface BuyTokenRequest {
  market: string;          // Market address
  tokenType: number;       // 0 = NO, 1 = YES
  amount: number;          // Amount in USDC (determines price)
  recipient: string;       // User's wallet address
  slippage?: number;       // Optional slippage percentage
}

interface BuyTokenResponse {
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

/**
 * Buy Token API
 * POST /api/buy-token
 * Processes x402 payment and executes swap
 */
export async function POST(req: NextRequest): Promise<NextResponse<BuyTokenResponse>> {
  try {
    const body: BuyTokenRequest = await req.json();

    // Validate required fields
    if (!body.market || body.tokenType === undefined || !body.amount || !body.recipient) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request',
        error: 'Missing required fields: market, tokenType, amount, recipient',
      }, { status: 400 });
    }

    // Validate amount
    if (body.amount <= 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid amount',
        error: 'Amount must be greater than 0',
      }, { status: 400 });
    }

    // Validate tokenType
    if (body.tokenType !== 0 && body.tokenType !== 1) {
      return NextResponse.json({
        success: false,
        message: 'Invalid token type',
        error: 'Token type must be 0 (NO) or 1 (YES)',
      }, { status: 400 });
    }

    // Validate addresses
    let marketAddress: PublicKey;
    let recipientAddress: PublicKey;

    try {
      marketAddress = new PublicKey(body.market);
    } catch (e) {
      return NextResponse.json({
        success: false,
        message: 'Invalid market address',
        error: 'Market address is not a valid Solana public key',
      }, { status: 400 });
    }

    try {
      recipientAddress = new PublicKey(body.recipient);
    } catch (e) {
      return NextResponse.json({
        success: false,
        message: 'Invalid recipient address',
        error: 'Recipient address is not a valid Solana public key',
      }, { status: 400 });
    }

    console.log('[buy-token] Processing buy request:', {
      market: body.market,
      tokenType: body.tokenType === 1 ? 'YES' : 'NO',
      amount: body.amount,
      recipient: body.recipient,
    });

    // Initialize connection
    const connection = new Connection(SOLANA_CONFIG.rpcUrl, SOLANA_CONFIG.commitment);

    // Load backend wallet
    const privateKeyString = process.env.X402_BACKEND_PRIVATE_KEY;
    if (!privateKeyString) {
      console.error('[buy-token] X402_BACKEND_PRIVATE_KEY not configured');
      return NextResponse.json({
        success: false,
        message: 'Server configuration error',
        error: 'Backend wallet not configured',
      }, { status: 500 });
    }

    let backendWallet: Keypair;
    try {
      const secretKey = bs58.decode(privateKeyString);
      backendWallet = Keypair.fromSecretKey(secretKey);
      console.log('[buy-token] Backend wallet loaded:', backendWallet.publicKey.toBase58());
    } catch (e) {
      console.error('[buy-token] Failed to decode private key:', e);
      return NextResponse.json({
        success: false,
        message: 'Server configuration error',
        error: 'Invalid backend wallet configuration',
      }, { status: 500 });
    }

    // Check backend wallet balance
    try {
      const balance = await connection.getBalance(backendWallet.publicKey);
      const solBalance = balance / 1e9;
      console.log('[buy-token] Backend wallet balance:', solBalance, 'SOL');

      if (solBalance < 0.01) {
        return NextResponse.json({
          success: false,
          message: 'Insufficient backend wallet balance',
          error: `Backend wallet has insufficient SOL for gas fees. Current: ${solBalance} SOL`,
        }, { status: 500 });
      }
    } catch (e) {
      console.error('[buy-token] Failed to check wallet balance:', e);
    }

    // Check if this is an x402 payment (has X-Payment header)
    const xPaymentHeader = req.headers.get('X-Payment');
    if (xPaymentHeader) {
      console.log('[buy-token] X402 payment detected, processing payment transaction...');

      try {
        // Decode the payment proof
        const paymentProofJson = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
        const paymentProof = JSON.parse(paymentProofJson);

        if (!paymentProof.payload?.serializedTransaction) {
          throw new Error('Missing serialized transaction in payment proof');
        }

        // Deserialize and submit the user's signed USDC payment transaction
        const paymentTxBuffer = Buffer.from(paymentProof.payload.serializedTransaction, 'base64');
        const paymentTx = Transaction.from(paymentTxBuffer);

        console.log('[buy-token] Submitting user USDC payment transaction...');
        const paymentSignature = await connection.sendRawTransaction(paymentTx.serialize());
        console.log('[buy-token] Payment transaction submitted:', paymentSignature);

        // Wait for confirmation
        await connection.confirmTransaction(paymentSignature, 'confirmed');
        console.log('[buy-token] ✓ Payment transaction confirmed');
      } catch (err: any) {
        console.error('[buy-token] Failed to process payment transaction:', err);
        return NextResponse.json({
          success: false,
          message: 'Payment transaction failed',
          error: err.message || 'Failed to submit payment transaction',
        }, { status: 500 });
      }
    }

    // Create wallet adapter
    const walletAdapter = {
      publicKey: backendWallet.publicKey,
      signTransaction: async (tx: any) => {
        tx.sign(backendWallet);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        return txs.map((tx: any) => {
          tx.sign(backendWallet);
          return tx;
        });
      },
      sendTransaction: async (tx: any, conn: Connection) => {
        tx.sign(backendWallet);
        const signature = await conn.sendRawTransaction(tx.serialize());
        return signature;
      },
    };

    // Initialize prediction market client
    const client = new PredictionMarketClient(connection, walletAdapter);

    // Verify market exists
    const market = await client.getMarket(marketAddress);
    if (!market) {
      return NextResponse.json({
        success: false,
        message: 'Market not found',
        error: `Market ${body.market} does not exist`,
      }, { status: 404 });
    }

    // Calculate min output with slippage
    const minOutput = body.slippage
      ? body.amount * (1 - body.slippage / 100)
      : undefined;

    // Execute swap (always Buy direction since this is a purchase API)
    console.log('[buy-token] Executing swap...');
    const result = await client.swap({
      market: marketAddress,
      tokenType: body.tokenType,
      direction: 0, // Always Buy
      amount: body.amount,
      minOutput,
      recipient: recipientAddress,
    });

    if (result.success) {
      console.log('[buy-token] Swap successful:', result.signature);

      return NextResponse.json({
        success: true,
        signature: result.signature,
        message: 'Token purchase successful',
        details: {
          market: body.market,
          tokenType: body.tokenType === 1 ? 'YES' : 'NO',
          amount: body.amount,
          recipient: body.recipient,
        },
      });
    } else {
      console.error('[buy-token] Swap failed:', result.error);

      return NextResponse.json({
        success: false,
        message: 'Swap failed',
        error: result.error || 'Unknown error occurred',
        details: {
          market: body.market,
          tokenType: body.tokenType === 1 ? 'YES' : 'NO',
          amount: body.amount,
          recipient: body.recipient,
        },
      }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error('[buy-token] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: errorMessage,
    }, { status: 500 });
  }
}
