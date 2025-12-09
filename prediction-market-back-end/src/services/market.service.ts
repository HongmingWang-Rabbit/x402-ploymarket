import { getSolanaClient } from '../blockchain/solana/client.js';
import type { CreateMarketParams } from '../blockchain/types.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class MarketService {
  private get solanaClient() {
    return getSolanaClient();
  }

  async listMarkets(limit: number, offset: number) {
    logger.debug({ limit, offset }, 'Listing markets');

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
