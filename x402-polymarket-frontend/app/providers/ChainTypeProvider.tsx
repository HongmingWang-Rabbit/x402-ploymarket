'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BlockchainType } from '@/app/utils/wallet';

interface ChainTypeContextValue {
  chainType: BlockchainType;
  setChainType: (type: BlockchainType) => void;
}

const ChainTypeContext = createContext<ChainTypeContextValue | undefined>(undefined);

export function ChainTypeProvider({ children }: { children: ReactNode }) {
  const [chainType, setChainType] = useState<BlockchainType>(BlockchainType.EVM);

  const handleSetChainType = (type: BlockchainType) => {
    console.log('🔄 Switching chain type from', chainType, 'to', type);
    setChainType(type);
  };

  return (
    <ChainTypeContext.Provider value={{ chainType, setChainType: handleSetChainType }}>
      {children}
    </ChainTypeContext.Provider>
  );
}

export function useChainType() {
  const context = useContext(ChainTypeContext);
  if (!context) {
    throw new Error('useChainType must be used within ChainTypeProvider');
  }
  return context;
}
