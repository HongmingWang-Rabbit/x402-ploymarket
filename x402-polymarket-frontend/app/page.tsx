"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [amount, setAmount] = useState('0.01');
  const [description, setDescription] = useState('Custom payment');

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    // Navigate to paywall with amount and description as query params
    const params = new URLSearchParams({
      amount: amount,
      description: description,
    });
    router.push(`/paywall?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center py-16 px-6 sm:px-8">
        <div className="w-full space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              X402 Market
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Multi-chain prediction markets powered by x402 protocol. Trade on your predictions using EVM or Solana.
            </p>
          </div>

          {/* Dynamic Payment Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold mb-2">Try the Payment System</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Test the multi-chain payment flow with a custom amount
            </p>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium mb-2">
                  Amount (in USD for EVM / SOL for Solana)
                </label>
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-neutral-800 dark:bg-gray-800 dark:text-white"
                  placeholder="Enter amount (e.g., 0.01)"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-neutral-800 dark:bg-gray-800 dark:text-white"
                  placeholder="What is this payment for?"
                />
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Proceed to Payment 💳
              </button>
            </form>

            {/* Quick Amount Buttons */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Quick Presets:</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setAmount('0.01');
                    setDescription('Small payment');
                  }}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="text-lg">🪣</div>
                  <div className="text-xs mt-1">$0.01</div>
                </button>
                <button
                  onClick={() => {
                    setAmount('0.25');
                    setDescription('Medium payment');
                  }}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="text-lg">💰</div>
                  <div className="text-xs mt-1">$0.25</div>
                </button>
                <button
                  onClick={() => {
                    setAmount('1.00');
                    setDescription('Large payment');
                  }}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="text-lg">💎</div>
                  <div className="text-xs mt-1">$1.00</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
