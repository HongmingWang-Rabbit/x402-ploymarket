import type { MarketMetadata } from '@/types';

// Raw metadata from various sources (backend may use 'name' instead of 'question')
interface RawMetadata {
  question?: string;
  name?: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
  resolutionDate?: string;
  imageUrl?: string;
}

/**
 * Normalize raw metadata to MarketMetadata format
 * Handles field name differences between backend formats
 */
function normalizeMetadata(raw: RawMetadata): MarketMetadata {
  return {
    question: raw.question || raw.name || '',
    description: raw.description,
    category: raw.category,
    resolutionSource: raw.resolutionSource,
    resolutionDate: raw.resolutionDate,
    imageUrl: raw.imageUrl,
  };
}

/**
 * Parse and fetch market metadata from various URI formats
 * Supports:
 * - data:application/json;base64,... (base64 encoded JSON)
 * - http(s):// URLs (fetched)
 * - /api/... relative URLs (fetched)
 */
export async function fetchMarketMetadata(metadataUri: string): Promise<MarketMetadata | null> {
  if (!metadataUri) return null;

  try {
    let raw: RawMetadata | null = null;

    // Handle data URIs (base64 encoded JSON)
    if (metadataUri.startsWith('data:application/json;base64,')) {
      const base64Data = metadataUri.replace('data:application/json;base64,', '');
      const jsonString = atob(base64Data);
      raw = JSON.parse(jsonString);
    }
    // Handle data URIs (URL encoded JSON)
    else if (metadataUri.startsWith('data:application/json,')) {
      const jsonString = decodeURIComponent(metadataUri.replace('data:application/json,', ''));
      raw = JSON.parse(jsonString);
    }
    // Handle HTTP(S) URLs and relative API URLs
    else if (metadataUri.startsWith('http') || metadataUri.startsWith('/api')) {
      const response = await fetch(metadataUri, {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        console.warn(`Failed to fetch metadata from ${metadataUri}: ${response.status}`);
        return null;
      }
      raw = await response.json();
    }

    if (!raw) return null;

    return normalizeMetadata(raw);
  } catch (error) {
    console.warn(`Error fetching metadata from ${metadataUri}:`, error);
    return null;
  }
}

/**
 * Fetch metadata for multiple markets in parallel
 */
export async function fetchMarketsMetadata(
  markets: Array<{ metadataUri: string }>
): Promise<Map<string, MarketMetadata | null>> {
  const results = await Promise.all(
    markets.map(async (market) => {
      const metadata = await fetchMarketMetadata(market.metadataUri);
      return [market.metadataUri, metadata] as const;
    })
  );

  return new Map(results);
}
