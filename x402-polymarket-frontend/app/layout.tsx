import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppKitProvider } from '@/app/providers/AppKitProvider'
import { SolanaWalletProviderComponent, ChainTypeProvider } from '@/app/providers'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { Header } from '@/components/layout'
import { ToastProvider } from '@/components/providers/ToastProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'X402 Market - Multi-Chain Prediction Markets',
  description: 'Decentralized prediction market platform powered by x402 protocol supporting EVM and Solana.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ChainTypeProvider>
          <AppKitProvider>
            <SolanaWalletProviderComponent
              network={WalletAdapterNetwork.Devnet}
              autoConnect={true}
            >
              <Header />
              <main className="min-h-screen">
                {children}
              </main>
              <ToastProvider />
            </SolanaWalletProviderComponent>
          </AppKitProvider>
        </ChainTypeProvider>
      </body>
    </html>
  )
}
