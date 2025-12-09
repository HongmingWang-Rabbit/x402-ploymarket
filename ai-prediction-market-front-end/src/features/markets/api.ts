import { apiClient } from '@/lib/api/client';
import { getSolanaAdapter } from '@/lib/blockchain';
import type { CreateMarketParams, MarketMetadata } from '@/types';
import type { MarketWithMetadata } from './types';

// Fetch markets from backend API (database-backed for fast loading)
export async function fetchMarkets(limit = 10, offset = 0): Promise<{
  markets: MarketWithMetadata[];
  total: number;
}> {
  try {
    // Use backend API which reads from database (fast)
    const response = await apiClient.listMarkets(limit, offset);

    if (response.success && response.data) {
      // Backend already includes metadata in the response
      const marketsWithMetadata: MarketWithMetadata[] = response.data.markets.map((market: any) => ({
        ...market,
        metadata: market.metadata || undefined,
      }));

      return {
        markets: marketsWithMetadata,
        total: response.data.total,
      };
    }
  } catch (error) {
    console.warn('Failed to fetch markets from backend, falling back to on-chain:', error);
  }

  // Fallback to on-chain if backend fails
  const adapter = getSolanaAdapter();
  const [markets, total] = await Promise.all([
    adapter.getMarkets(limit, offset),
    adapter.getMarketsCount(),
  ]);

  return { markets: markets.map((m) => ({ ...m })), total };
}

// Fetch single market from backend (with on-chain enrichment for live data)
export async function fetchMarket(address: string): Promise<MarketWithMetadata | null> {
  try {
    // Use backend API which merges database metadata with on-chain data
    const response = await apiClient.getMarket(address);

    if (response.success && response.data) {
      const market = response.data as any;
      return {
        ...market,
        metadata: market.metadata || undefined,
      };
    }
  } catch (error) {
    console.warn('Failed to fetch market from backend, falling back to on-chain:', error);
  }

  // Fallback to pure on-chain
  const adapter = getSolanaAdapter();
  const market = await adapter.getMarket(address);
  return market ? { ...market } : null;
}

// Link metadata to market after creation
export async function linkMetadataToMarket(metadataId: string, marketAddress: string): Promise<void> {
  await apiClient.linkMetadataToMarket(metadataId, marketAddress);
}

// Create market via backend (for x402 payment)
export async function createMarketViaBackend(
  params: CreateMarketParams & { creatorAddress?: string },
  paymentHeader?: string
) {
  const response = await apiClient.createMarket(
    {
      yesSymbol: params.yesSymbol,
      yesUri: params.yesUri,
      displayName: params.displayName,
      initialYesProb: params.initialYesProb,
      startSlot: params.startSlot,
      endingSlot: params.endingSlot,
      creatorAddress: params.creatorAddress,
    },
    paymentHeader
  );

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create market');
  }

  return response.data;
}

// Create market directly via wallet
export async function createMarketDirect(params: CreateMarketParams) {
  const adapter = getSolanaAdapter();
  const result = await adapter.createMarket(params);

  if (!result.success) {
    throw new Error(result.error || 'Failed to create market');
  }

  return result;
}
