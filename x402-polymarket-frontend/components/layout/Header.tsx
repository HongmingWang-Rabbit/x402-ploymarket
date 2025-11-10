'use client';

import React from 'react';
import Link from 'next/link';
import { WalletButton, ChainSwitcher, WalletStatus } from '@/components/wallet';
import { useWallet } from '@/app/hooks/wallet';

export function Header() {
  const { isConnected } = useWallet();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-gray-950/95">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            X402 Market
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/"
            className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors"
          >
            Markets
          </Link>
          <Link
            href="/portfolio"
            className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors"
          >
            Portfolio
          </Link>
        </nav>

        {/* Wallet Controls */}
        <div className="flex items-center space-x-3">
          {/* Chain Switcher - Only show when NOT connected */}
          {!isConnected && (
            <ChainSwitcher className="hidden sm:inline-flex" />
          )}

          {/* Wallet Button - Shows compact view when connected, modal on click */}
          <WalletButton className="wallet-button-custom" />
        </div>
      </div>
    </header>
  );
}
