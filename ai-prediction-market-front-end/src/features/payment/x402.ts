import { x402Config } from '@/config';

// x402 payment types
export interface PaymentQuote {
  network: string;
  paymentAddress: string;
  amount: string;
  currency: string;
  expiresAt: number;
}

export interface PaymentResponse {
  success: boolean;
  transactionSignature?: string;
  error?: string;
}

/**
 * Request a payment quote from the backend
 */
export async function requestPaymentQuote(
  endpoint: string,
  params: Record<string, unknown>
): Promise<PaymentQuote | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (response.status === 402) {
      // Parse x402 payment requirements from response headers or body
      const paymentInfo = await response.json();
      return {
        network: x402Config.network,
        paymentAddress: x402Config.paymentAddress,
        amount: paymentInfo.amount || '1.0',
        currency: 'USDC',
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to request payment quote:', error);
    return null;
  }
}

/**
 * Create a signed USDC transfer transaction for x402 payment
 * Returns the serialized transaction to be sent in X-Payment header
 */
export async function createPaymentTransaction(
  wallet: {
    publicKey: import('@solana/web3.js').PublicKey;
    signTransaction: (tx: import('@solana/web3.js').Transaction) => Promise<import('@solana/web3.js').Transaction>;
  },
  quote: PaymentQuote,
  connection: import('@solana/web3.js').Connection
): Promise<string | null> {
  try {
    const { PublicKey, Transaction } = await import('@solana/web3.js');
    const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
    const { contractConfig } = await import('@/config');

    const usdcMint = new PublicKey(contractConfig.currentUsdcMint);
    const paymentAddress = new PublicKey(quote.paymentAddress);
    const amount = parseFloat(quote.amount) * Math.pow(10, contractConfig.usdcDecimals);

    // Get token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      wallet.publicKey
    );
    const receiverTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      paymentAddress
    );

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      senderTokenAccount,
      receiverTokenAccount,
      wallet.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );

    // Build transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: wallet.publicKey,
    });
    transaction.add(transferInstruction);

    // Sign but don't submit
    const signedTx = await wallet.signTransaction(transaction);

    // Serialize and encode
    const serialized = signedTx.serialize({ requireAllSignatures: true });
    return Buffer.from(serialized).toString('base64');
  } catch (error) {
    console.error('Failed to create payment transaction:', error);
    return null;
  }
}

/**
 * Execute a request with x402 payment
 */
export async function executeWithPayment(
  endpoint: string,
  params: Record<string, unknown>,
  paymentTransaction: string
): Promise<PaymentResponse> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': paymentTransaction,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Payment failed',
      };
    }

    return {
      success: true,
      transactionSignature: data.data?.signature,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}
