"use client";

import { useState } from "react";
import { useWallet } from "@/app/hooks/wallet";
import { BlockchainType } from "@/app/utils/wallet";
import { WalletButton, ChainSwitcher } from "@/components/wallet";
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

const PAYMENT_CONFIGS: Record<string, PaymentConfig> = {
  cheap: {
    amount: "0.01",
    description: "Access to cheap content",
    recipient: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  },
  expensive: {
    amount: "0.25",
    description: "Access to expensive content",
    recipient: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  },
};

/**
 * EVM Payment Form Component
 */
function EVMPaymentForm({
  paymentRequirements,
  onSuccess,
}: {
  paymentRequirements: PaymentRequirements;
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

      // Verify payment on server
      const result = await verifyPayment(payment);

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
            {paymentRequirements.maxAmountRequired} USDC
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
            {paymentRequirements.description}
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
  config,
  onSuccess,
}: {
  config: PaymentConfig;
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
      const amountInSol = parseFloat(config.amount);
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
            {config.amount} SOL
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">To:</span>{" "}
            {config.recipient.slice(0, 10)}...
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">Network:</span>{" "}
            Solana Devnet
          </p>
          <p>
            <span className="text-gray-600 dark:text-gray-400">
              Description:
            </span>{" "}
            {config.description}
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
  const { chainType, isConnected } = useWallet();
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Get payment config (you can make this dynamic based on URL params)
  const config = PAYMENT_CONFIGS.cheap;

  // EVM payment requirements for x402
  const evmPaymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "10000", // USDC has 6 decimals, so this is 0.01 USDC
    resource: "https://example.com",
    description: config.description,
    mimeType: "text/html",
    payTo: config.recipient,
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
      window.location.href = "/content/cheap";
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
            Choose your preferred payment method
          </p>
        </div>

        {/* Chain Switcher */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Select Blockchain
          </label>
          <ChainSwitcher className="w-full" />
        </div>

        {/* Wallet Connection */}
        <div className="mb-6">
          <WalletButton className="w-full" />
        </div>

        {/* Payment Form */}
        {isConnected ? (
          <div>
            {chainType === BlockchainType.EVM ? (
              <EVMPaymentForm
                paymentRequirements={evmPaymentRequirements}
                onSuccess={handlePaymentSuccess}
              />
            ) : (
              <SolanaPaymentForm
                config={config}
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
