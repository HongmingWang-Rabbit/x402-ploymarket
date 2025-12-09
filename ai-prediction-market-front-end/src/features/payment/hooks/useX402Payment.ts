import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { toast } from 'react-toastify';
import {
  PaymentQuote,
  requestPaymentQuote,
  createPaymentTransaction,
  executeWithPayment,
} from '../x402';

type PaymentStep = 'idle' | 'quote' | 'signing' | 'submitting' | 'complete' | 'error';

interface UseX402PaymentOptions {
  onSuccess?: (signature: string) => void;
  onError?: (error: string) => void;
}

export function useX402Payment(options: UseX402PaymentOptions = {}) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [step, setStep] = useState<PaymentStep>('idle');
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setQuote(null);
    setError(null);
  }, []);

  const pay = useCallback(
    async (endpoint: string, params: Record<string, unknown>) => {
      if (!publicKey || !signTransaction) {
        toast.error('Please connect your wallet first');
        return null;
      }

      try {
        setStep('quote');
        setError(null);

        // Request payment quote
        const paymentQuote = await requestPaymentQuote(endpoint, params);

        if (!paymentQuote) {
          // No payment required, proceed normally
          setStep('submitting');
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error?.message || 'Request failed');
          }

          setStep('complete');
          options.onSuccess?.(data.data?.signature || '');
          return data.data;
        }

        setQuote(paymentQuote);
        setStep('signing');

        // Create and sign payment transaction
        const paymentTx = await createPaymentTransaction(
          { publicKey, signTransaction },
          paymentQuote,
          connection
        );

        if (!paymentTx) {
          throw new Error('Failed to create payment transaction');
        }

        setStep('submitting');

        // Execute with payment
        const result = await executeWithPayment(endpoint, params, paymentTx);

        if (!result.success) {
          throw new Error(result.error || 'Payment failed');
        }

        setStep('complete');
        toast.success('Payment successful!');
        options.onSuccess?.(result.transactionSignature || '');

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Payment failed';
        setError(errorMessage);
        setStep('error');
        toast.error(errorMessage);
        options.onError?.(errorMessage);
        return null;
      }
    },
    [publicKey, signTransaction, connection, options]
  );

  return {
    pay,
    reset,
    step,
    quote,
    error,
    isLoading: step !== 'idle' && step !== 'complete' && step !== 'error',
    isComplete: step === 'complete',
    isError: step === 'error',
  };
}
