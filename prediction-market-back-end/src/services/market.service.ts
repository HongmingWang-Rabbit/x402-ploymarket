import { getSolanaClient } from '../blockchain/solana/client.js';
import type { CreateMarketParams } from '../blockchain/types.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getDb, isDatabaseConfigured } from '../db/client.js';

// Database market type
interface DbMarket {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  resolution: unknown;
  confidence_score: number | null;
  status: string;
  market_address: string;
  yes_token_mint: string | null;
  no_token_mint: string | null;
  published_at: Date | null;
  created_at: Date;
}

// API response market type (matches frontend expectations)
interface ApiMarket {
  address: string;
  name: string;
  metadataUri: string;
  creator: string;
  yesMint: string;
  noMint: string;
  collateralVault: string;
  status: 'active' | 'paused' | 'resolved';
  bParameter: number;
  totalLiquidity: number;
  poolYesReserve: number;
  poolNoReserve: number;
  totalLpShares: number;
  totalPoolValue: number;
  yesPrice: number;
  noPrice: number;
  createdAt: number;
  // Metadata fields from database
  metadata?: {
    question: string;
    description?: string;
    category?: string;
  };
}

export class MarketService {
  private get solanaClient() {
    return getSolanaClient();
  }

  /**
   * Convert database market to API market format
   */
  private dbMarketToApiMarket(dbMarket: DbMarket): ApiMarket {
    return {
      address: dbMarket.market_address,
      name: dbMarket.title,
      metadataUri: '', // Not stored in DB
      creator: '', // Could be added to DB schema later
      yesMint: dbMarket.yes_token_mint || '',
      noMint: dbMarket.no_token_mint || '',
      collateralVault: '', // Derived from on-chain, not critical for listing
      status: dbMarket.status === 'active' ? 'active' : dbMarket.status === 'resolved' ? 'resolved' : 'paused',
      bParameter: 100, // Default, could be added to DB schema
      // These values require on-chain data for accuracy
      // For now, return defaults - frontend can fetch on-chain for detail view
      totalLiquidity: 0,
      poolYesReserve: 0,
      poolNoReserve: 0,
      totalLpShares: 0,
      totalPoolValue: 0,
      yesPrice: 0.5,
      noPrice: 0.5,
      createdAt: dbMarket.published_at
        ? Math.floor(dbMarket.published_at.getTime() / 1000)
        : Math.floor(dbMarket.created_at.getTime() / 1000),
      metadata: {
        question: dbMarket.title,
        description: dbMarket.description || undefined,
        category: dbMarket.category || undefined,
      },
    };
  }

  async listMarkets(limit: number, offset: number) {
    logger.debug({ limit, offset }, 'Listing markets');

    // Try database first if configured
    if (isDatabaseConfigured()) {
      try {
        const sql = getDb();

        // Fetch published markets from database
        const dbMarkets = await sql<DbMarket[]>`
          SELECT
            id, title, description, category, resolution,
            confidence_score, status, market_address,
            yes_token_mint, no_token_mint, published_at, created_at
          FROM ai_markets
          WHERE market_address IS NOT NULL
            AND status = 'active'
          ORDER BY published_at DESC NULLS LAST, created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        const [countResult] = await sql`
          SELECT COUNT(*) as count
          FROM ai_markets
          WHERE market_address IS NOT NULL
            AND status = 'active'
        `;
        const total = parseInt(countResult?.count || '0', 10);

        logger.debug({ count: dbMarkets.length, total }, 'Fetched markets from database');

        return {
          markets: dbMarkets.map((m) => this.dbMarketToApiMarket(m)),
          total,
          limit,
          offset,
        };
      } catch (error) {
        logger.error({ error }, 'Failed to fetch markets from database, falling back to on-chain');
      }
    }

    // Fallback to on-chain (original behavior)
    const markets = await this.solanaClient.getMarkets(limit, offset);
    const total = await this.solanaClient.getMarketsCount();

    return {
      markets,
      total,
      limit,
      offset,
    };
  }

  async getMarket(address: string) {
    logger.debug({ address }, 'Getting market');

    // Try database first for basic info
    if (isDatabaseConfigured()) {
      try {
        const sql = getDb();
        const [dbMarket] = await sql<DbMarket[]>`
          SELECT
            id, title, description, category, resolution,
            confidence_score, status, market_address,
            yes_token_mint, no_token_mint, published_at, created_at
          FROM ai_markets
          WHERE market_address = ${address}
        `;

        if (dbMarket) {
          // For single market view, we still need on-chain data for prices/liquidity
          // Try to enrich with on-chain data
          try {
            const onChainMarket = await this.solanaClient.getMarket(address);
            if (onChainMarket) {
              // Merge DB metadata with on-chain data
              return {
                ...onChainMarket,
                metadata: {
                  question: dbMarket.title,
                  description: dbMarket.description || undefined,
                  category: dbMarket.category || undefined,
                },
              };
            }
          } catch (onChainError) {
            logger.warn({ address, error: onChainError }, 'Failed to fetch on-chain data, returning DB data only');
          }

          // Return DB data with defaults if on-chain fails
          return this.dbMarketToApiMarket(dbMarket);
        }
      } catch (error) {
        logger.error({ error, address }, 'Failed to fetch market from database');
      }
    }

    // Fallback to pure on-chain
    const market = await this.solanaClient.getMarket(address);

    if (!market) {
      throw new NotFoundError(`Market not found: ${address}`);
    }

    return market;
  }

  async createMarket(params: CreateMarketParams) {
    logger.info({ params }, 'Creating market');

    const result = await this.solanaClient.createMarket({
      name: params.name,
      metadataUri: params.metadataUri,
      bParameter: params.bParameter,
      creatorAddress: params.creatorAddress,
    });

    return result;
  }
}
