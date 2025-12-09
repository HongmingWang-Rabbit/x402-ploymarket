import { apiClient } from '@/lib/api/client';
import { getSolanaAdapter } from '@/lib/blockchain';
import type { CreateMarketParams, MarketMetadata } from '@/types';
import type { MarketWithMetadata } from './types';

// Fetch metadata by market address from backend
// Returns null for markets without linked metadata (404 is expected for old markets)
async function fetchMetadataByMarketAddress(marketAddress: string): Promise<MarketMetadata | null> {
  try {
    const response = await apiClient.getMetadataByMarket(marketAddress);
    if (response.success && response.data) {
      return response.data;
    }
    // 404 is expected for markets without linked metadata - not an error
    return null;
  } catch {
    // Network errors are silently ignored - metadata is optional
    return null;
  }
}

// Fetch markets from blockchain directly, with metadata from backend
export async function fetchMarkets(limit = 10, offset = 0): Promise<{
  markets: MarketWithMetadata[];
  total: number;
}> {
  const adapter = getSolanaAdapter();

  const [markets, total] = await Promise.all([
    adapter.getMarkets(limit, offset),
    adapter.getMarketsCount(),
  ]);

  // Fetch metadata for all markets in parallel (by market address)
  const marketsWithMetadata = await Promise.all(
    markets.map(async (market): Promise<MarketWithMetadata> => {
      const metadata = await fetchMetadataByMarketAddress(market.address);
      return { ...market, metadata: metadata || undefined };
    })
  );

  return { markets: marketsWithMetadata, total };
}

// Fetch single market with metadata
export async function fetchMarket(address: string): Promise<MarketWithMetadata | null> {
  const adapter = getSolanaAdapter();
  const market = await adapter.getMarket(address);

  if (!market) return null;

  const metadata = await fetchMetadataByMarketAddress(address);
  return { ...market, metadata: metadata || undefined };
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
