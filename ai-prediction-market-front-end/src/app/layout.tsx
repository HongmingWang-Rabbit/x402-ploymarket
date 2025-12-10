import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/providers";
import { BlockchainProvider } from "@/lib/blockchain";
import { Header } from "@/components/layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PredictX - Decentralized Prediction Markets on Solana",
  description:
    "Trade on future events with multi-chain payments. Powered by AI market generation and secured by blockchain technology.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 min-h-screen`}
        suppressHydrationWarning
      >
        <Providers>
          <BlockchainProvider>
            <Header />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </BlockchainProvider>
        </Providers>
      </body>
    </html>
  );
}
