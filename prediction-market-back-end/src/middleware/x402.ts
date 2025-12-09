import { FastifyRequest, FastifyReply } from 'fastify';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { PaymentRequiredError } from '../utils/errors.js';

// x402 payment middleware for Fastify
export interface X402Options {
  price: number;
  currency: string;
}

// Default prices for different operations (in USDC)
export const X402_PRICES = {
  CREATE_MARKET: 1.0,
  SWAP: 0.01,
  MINT: 0.01,
  REDEEM: 0.01,
};

/**
 * Create x402 payment middleware for a specific price
 */
export function requirePayment(price: number = 1.0) {
  return async function x402Middleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const paymentHeader = request.headers['x-payment'] as string | undefined;

    // If no payment header, return 402 Payment Required
    if (!paymentHeader) {
      logger.debug('No payment header, returning 402');

      return reply.status(402).send({
        success: false,
        error: {
          code: 'PAYMENT_REQUIRED',
          message: 'Payment required',
          payment: {
            network: config.solana.network === 'devnet' ? 'solana-devnet' : 'solana',
            paymentAddress: config.x402.paymentAddress,
            amount: price.toString(),
            currency: 'USDC',
            facilitatorUrl: config.x402.facilitatorUrl,
          },
        },
      });
    }

    // Validate and process payment
    try {
      const isValid = await validatePayment(paymentHeader, price);

      if (!isValid) {
        throw new PaymentRequiredError('Invalid payment transaction');
      }

      // Submit the payment transaction
      const signature = await submitPayment(paymentHeader);

      // Attach payment info to request for later use
      (request as any).paymentSignature = signature;

      logger.info({ signature }, 'Payment processed successfully');
    } catch (error) {
      logger.error({ error }, 'Payment validation failed');
      throw new PaymentRequiredError(
        error instanceof Error ? error.message : 'Payment validation failed'
      );
    }
  };
}

/**
 * Validate a payment transaction
 */
async function validatePayment(
  paymentHeader: string,
  expectedAmount: number
): Promise<boolean> {
  try {
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    const transactionBuffer = Buffer.from(paymentHeader, 'base64');
    const transaction = Transaction.from(transactionBuffer);

    // Verify the transaction is signed
    if (!transaction.signatures.length) {
      logger.warn('Transaction has no signatures');
      return false;
    }

    // Verify the transaction has not been submitted yet
    const signature = transaction.signatures[0].signature;
    if (signature) {
      try {
        const status = await connection.getSignatureStatus(
          Buffer.from(signature).toString('base64')
        );
        if (status.value !== null) {
          logger.warn('Transaction already submitted');
          return false;
        }
      } catch {
        // Signature not found, which is expected for new transactions
      }
    }

    // Verify payment destination and amount
    // This is a simplified check - in production you'd parse the instructions
    // to verify the exact transfer details
    const paymentAddress = new PublicKey(config.x402.paymentAddress);

    // Check if any instruction involves the payment address
    const hasPaymentInstruction = transaction.instructions.some((ix) => {
      return ix.keys.some(
        (key) => key.pubkey.equals(paymentAddress) && key.isWritable
      );
    });

    if (!hasPaymentInstruction) {
      logger.warn('Transaction does not include payment to expected address');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to validate payment');
    return false;
  }
}

/**
 * Submit a payment transaction
 */
async function submitPayment(paymentHeader: string): Promise<string> {
  const connection = new Connection(config.solana.rpcUrl, 'confirmed');
  const transactionBuffer = Buffer.from(paymentHeader, 'base64');

  const signature = await connection.sendRawTransaction(transactionBuffer, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // Wait for confirmation
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return signature;
}
