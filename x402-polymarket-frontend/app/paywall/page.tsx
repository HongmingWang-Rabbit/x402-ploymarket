"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/app/hooks/wallet";
import { BlockchainType } from "@/app/utils/wallet";
import { verifyPayment } from "../actions";
import { PaymentRequirements, PaymentPayload } from "x402/types";
import { preparePaymentHeader } from "x402/client";
import { getNetworkId } from "x402/shared";
import { exact } from "x402/schemes";
import { useSignTypedData } from "wagmi";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

/**
 * Payment configuration for different content types
 */
interface PaymentConfig {
  amount: string;
  description: string;
  recipient: string;
}

const DEFAULT_CONFIG: PaymentConfig = {
  amount: "0.01",
  description: "Custom payment",
  recipient: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
};

/**
 * EVM Payment Form Component
 */
function EVMPaymentForm({
  paymentRequirements,
  amount,
  description,
  onSuccess,
}: {
  paymentRequirements: PaymentRequirements;
  amount: string;
  description: string;
  onSuccess: () => void;
}) {
  const { evmWallet } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const { signTypedDataAsync } = useSignTypedData();

  const handlePayment = async () => {
    if (!evmWallet.address) {
      setError("Please connect your EVM wallet");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Prepare unsigned payment header
      const unSignedPaymentHeader = preparePaymentHeader(
        evmWallet.address,
        1,
        paymentRequirements
      );

      // Prepare EIP-712 data for signing
      const eip712Data = {
        types: {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        domain: {
          name: paymentRequirements.extra?.name,
          version: paymentRequirements.extra?.version,
          chainId: getNetworkId(paymentRequirements.network),
          verifyingContract: paymentRequirements.asset as `0x${string}`,
        },
        primaryType: "TransferWithAuthorization" as const,
        message: unSignedPaymentHeader.payload.authorization,
      };

      // Sign the payment
      const signature = await signTypedDataAsync(eip712Data);

      // Create payment payload
      const paymentPayload: PaymentPayload = {
        ...unSignedPaymentHeader,
        payload: {
          ...unSignedPaymentHeader.payload,
          signature,
        },
      };

      // Encode payment
      const payment: string = exact.evm.encodePayment(paymentPayload);

      // Verify payment on server with dynamic amount and description
      const result = await verifyPayment(payment, amount, description);

      if (result.startsWith("Error")) {
        throw new Error(result);
      }

      console.log("Payment verified:", result);
      onSuccess();
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">EVM Payment Details</h3>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600 dark:text-gray-400">Amount:</span>{" "}
            ${amount} USD
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">To:</span>{" "}
            {paymentRequirements.payTo.slice(0, 10)}...
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">Network:</span>{" "}
            {paymentRequirements.network}
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">
              Description:
            </span>{" "}
            {description}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        disabled={!evmWallet.address || isProcessing}
        onClick={handlePayment}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          !evmWallet.address || isProcessing
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {isProcessing ? "Processing Payment..." : "Pay with EVM Wallet"}
      </button>
    </div>
  );
}

/**
 * Solana Payment Form Component
 */
function SolanaPaymentForm({
  amount,
  description,
  recipient,
  onSuccess,
}: {
  amount: string;
  description: string;
  recipient: string;
  onSuccess: () => void;
}) {
  const { solanaWallet } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");

  const handlePayment = async () => {
    if (!solanaWallet.publicKey || !solanaWallet.connection) {
      setError("Please connect your Solana wallet");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Convert amount to lamports
      const amountInSol = parseFloat(amount);
      const lamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);

      // For demo purposes, we'll use a fixed recipient address
      // In production, you'd want to verify this is a valid Solana address
      const recipientPubkey = new PublicKey(
        "11111111111111111111111111111111" // System program - replace with actual recipient
      );

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: solanaWallet.publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash } = await solanaWallet.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = solanaWallet.publicKey;

      // Send transaction
      const signature = await solanaWallet.sendTransaction(transaction);

      console.log("Solana payment signature:", signature);
      console.log("Payment good - Amount:", amount, "SOL, Description:", description);

      // In a real app, you'd verify this payment on your backend
      // For now, we'll just show success
      onSuccess();
    } catch (err) {
      console.error("Solana payment error:", err);
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Solana Payment Details</h3>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600 dark:text-gray-400">Amount:</span>{" "}
            {amount} SOL
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">To:</span>{" "}
            {recipient.slice(0, 10)}...
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">Network:</span>{" "}
            Solana Devnet
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">
              Description:
            </span>{" "}
            {description}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        disabled={!solanaWallet.publicKey || isProcessing}
        onClick={handlePayment}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          !solanaWallet.publicKey || isProcessing
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
      >
        {isProcessing ? "Processing Payment..." : "Pay with Solana Wallet"}
      </button>
    </div>
  );
}

/**
 * Main Paywall Component
 */
export default function Paywall() {
  const { chainType, isConnected, address } = useWallet();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const searchParams = useSearchParams();

  // Get dynamic amount and description from URL params
  const amount = searchParams.get("amount") || DEFAULT_CONFIG.amount;
  const description = searchParams.get("description") || DEFAULT_CONFIG.description;

  // Convert amount to USDC with 6 decimals (for EVM)
  const amountInUSDC = Math.floor(parseFloat(amount) * 1_000_000).toString();

  // EVM payment requirements for x402 with dynamic amount
  const evmPaymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: amountInUSDC, // Dynamic amount in USDC (6 decimals)
    resource: "https://example.com",
    description: description,
    mimeType: "text/html",
    payTo: DEFAULT_CONFIG.recipient,
    maxTimeoutSeconds: 60,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    outputSchema: undefined,
    extra: {
      name: "USDC",
      version: "2",
    },
  };

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    // Redirect after short delay
    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  };

  if (paymentSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-12 max-w-md text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Redirecting you to the content...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Payment Required</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet using the header and proceed with payment
          </p>
        </div>

        {/* Current Chain Display */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Selected Chain:
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              chainType === BlockchainType.EVM
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
            }`}>
              {chainType === BlockchainType.EVM ? 'EVM' : 'Solana'}
            </span>
          </div>
          {isConnected && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Connected: {chainType === BlockchainType.EVM
                  ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                  : `${address?.slice(0, 6)}...${address?.slice(-4)}`
                }
              </span>
            </div>
          )}
        </div>

        {/* Payment Form */}
        {isConnected ? (
          <div>
            {chainType === BlockchainType.EVM ? (
              <EVMPaymentForm
                paymentRequirements={evmPaymentRequirements}
                amount={amount}
                description={description}
                onSuccess={handlePaymentSuccess}
              />
            ) : (
              <SolanaPaymentForm
                amount={amount}
                description={description}
                recipient={DEFAULT_CONFIG.recipient}
                onSuccess={handlePaymentSuccess}
              />
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please connect your wallet to proceed with payment
            </p>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {chainType === BlockchainType.EVM
              ? "Powered by x402 Protocol on Base Sepolia"
              : "Powered by Solana Devnet"}
          </p>
        </div>
      </div>
    </div>
  );
}
