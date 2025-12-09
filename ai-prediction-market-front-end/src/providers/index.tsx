'use client';

import { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { WalletProvider } from './WalletProvider';
import { ToastProvider } from './ToastProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <WalletProvider>
        {children}
        <ToastProvider />
      </WalletProvider>
    </QueryProvider>
  );
}

export { QueryProvider } from './QueryProvider';
export { WalletProvider } from './WalletProvider';
export { ToastProvider } from './ToastProvider';
