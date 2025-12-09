import { getDb, isDatabaseConfigured } from '../db/client.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

// Supported chain IDs
// Format: {chain}-{network}
// Examples: solana-devnet, solana-mainnet, ethereum-mainnet, cardano-mainnet
export type ChainId =
  | 'solana-devnet'
  | 'solana-mainnet'
  | 'ethereum-mainnet'
  | 'ethereum-sepolia'
  | 'base-mainnet'
  | 'base-sepolia'
  | 'cardano-mainnet'
  | 'cardano-testnet'
  | string; // Allow custom chain IDs

export interface MarketMetadata {
  id: string;
  chainId: ChainId;
  marketAddress?: string;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
  createdAt: Date;
}

export interface CreateMetadataParams {
  chainId?: ChainId; // Defaults to 'solana-devnet'
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
}

export class MetadataService {
  async create(params: CreateMetadataParams): Promise<MarketMetadata> {
    if (!isDatabaseConfigured()) {
      throw new BadRequestError('Database not configured');
    }

    const sql = getDb();
    const chainId = params.chainId || 'solana-devnet';

    const [row] = await sql`
      INSERT INTO market_metadata (chain_id, name, symbol, description, category, resolution_source)
      VALUES (${chainId}, ${params.name}, ${params.symbol}, ${params.description || null}, ${params.category || null}, ${params.resolutionSource || null})
      RETURNING id, chain_id, name, symbol, description, category, resolution_source, created_at
    `;

    return this.mapRow(row);
  }

  async getById(id: string): Promise<MarketMetadata> {
    if (!isDatabaseConfigured()) {
      throw new BadRequestError('Database not configured');
    }

    const sql = getDb();

    const [row] = await sql`
      SELECT id, chain_id, market_address, name, symbol, description, category, resolution_source, created_at
      FROM market_metadata
      WHERE id = ${id}
    `;

    if (!row) {
      throw new NotFoundError(`Metadata with id ${id} not found`);
    }

    return this.mapRow(row);
  }

  async getByMarketAddress(marketAddress: string): Promise<MarketMetadata | null> {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const sql = getDb();

    const [row] = await sql`
      SELECT id, chain_id, market_address, name, symbol, description, category, resolution_source, created_at
      FROM market_metadata
      WHERE market_address = ${marketAddress}
    `;

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  async linkToMarket(metadataId: string, marketAddress: string): Promise<MarketMetadata> {
    if (!isDatabaseConfigured()) {
      throw new BadRequestError('Database not configured');
    }

    const sql = getDb();

    const [row] = await sql`
      UPDATE market_metadata
      SET market_address = ${marketAddress}
      WHERE id = ${metadataId}
      RETURNING id, chain_id, market_address, name, symbol, description, category, resolution_source, created_at
    `;

    if (!row) {
      throw new NotFoundError(`Metadata with id ${metadataId} not found`);
    }

    return this.mapRow(row);
  }

  private mapRow(row: any): MarketMetadata {
    return {
      id: row.id,
      chainId: row.chain_id,
      marketAddress: row.market_address || undefined,
      name: row.name,
      symbol: row.symbol,
      description: row.description || undefined,
      category: row.category || undefined,
      resolutionSource: row.resolution_source || undefined,
      createdAt: row.created_at,
    };
  }
}

export const metadataService = new MetadataService();
