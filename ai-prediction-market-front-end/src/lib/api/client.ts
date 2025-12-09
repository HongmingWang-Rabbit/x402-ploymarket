import { config } from '@/config';
import type {
  ApiResponse,
  ListMarketsResponse,
  CreateMarketRequest,
  CreateMarketResponse,
  SwapRequest,
  SwapResponse,
  MintRedeemRequest,
  MintRedeemResponse,
  AddLiquidityRequest,
  WithdrawLiquidityRequest,
  LiquidityResponse,
  Market,
  MarketMetadata,
} from '@/types';

// Metadata types
export interface CreateMetadataRequest {
  chainId?: string; // e.g., 'solana-devnet', 'ethereum-mainnet'
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
}

export interface CreateMetadataResponse {
  id: string;
  url: string;
}

// Config types
export interface Category {
  id: string;
  label: string;
}

export interface ChainContract {
  chainId: string;
  chainName: string;
  network: string;
  programId: string;
  rpcUrl: string;
  explorerUrl: string;
  usdcMint?: string;
  enabled: boolean;
}

export interface AppConfigResponse {
  categories: Category[];
}

export interface ContractsResponse {
  contracts: ChainContract[];
}

// Worker types
export interface WorkerHeartbeat {
  id: string;
  worker_type: string;
  worker_instance_id: string;
  status: 'starting' | 'running' | 'idle' | 'error' | 'stopped';
  last_heartbeat: string;
  messages_processed: number;
  messages_failed: number;
  current_queue_size: number | null;
  last_error: string | null;
  last_error_at: string | null;
  consecutive_errors: number;
  hostname: string | null;
  pid: number | null;
  started_at: string;
}

export interface WorkerConfig {
  id: string;
  worker_type: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  poll_interval_ms: number | null;
  cron_expression: string | null;
  input_queue: string | null;
  output_queue: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerStatus extends WorkerConfig {
  heartbeats: WorkerHeartbeat[];
  is_healthy: boolean;
  active_instances: number;
}

export interface WorkersResponse {
  workers: WorkerStatus[];
  summary: {
    total: number;
    enabled: number;
    healthy: number;
    unhealthy: number;
  };
}

export interface WorkerDetail extends WorkerConfig {
  heartbeats: WorkerHeartbeat[];
  is_healthy: boolean;
  active_instances: number;
  metrics: {
    total_processed_24h: number;
    total_failed_24h: number;
    success_rate: string;
  };
}

class APIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.error?.code || 'UNKNOWN_ERROR',
            message: data.error?.message || 'An error occurred',
          },
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  // Markets
  async listMarkets(limit = 10, offset = 0): Promise<ApiResponse<ListMarketsResponse>> {
    return this.request<ListMarketsResponse>(
      `/api/markets?limit=${limit}&offset=${offset}`
    );
  }

  async getMarket(address: string): Promise<ApiResponse<Market>> {
    return this.request<Market>(`/api/markets/${address}`);
  }

  async createMarket(
    params: CreateMarketRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<CreateMarketResponse>> {
    return this.request<CreateMarketResponse>('/api/markets/create', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  // Trading
  async swap(
    params: SwapRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<SwapResponse>> {
    return this.request<SwapResponse>('/api/trading/swap', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  async mintCompleteSet(
    params: MintRedeemRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<MintRedeemResponse>> {
    return this.request<MintRedeemResponse>('/api/trading/mint', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  async redeemCompleteSet(
    params: MintRedeemRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<MintRedeemResponse>> {
    return this.request<MintRedeemResponse>('/api/trading/redeem', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  // Liquidity
  async addLiquidity(
    params: AddLiquidityRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<LiquidityResponse>> {
    return this.request<LiquidityResponse>('/api/liquidity/add', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  async withdrawLiquidity(
    params: WithdrawLiquidityRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<LiquidityResponse>> {
    return this.request<LiquidityResponse>('/api/liquidity/withdraw', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Metadata
  async createMetadata(
    params: CreateMetadataRequest
  ): Promise<ApiResponse<CreateMetadataResponse>> {
    return this.request<CreateMetadataResponse>('/api/metadata', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getMetadataByMarket(
    marketAddress: string
  ): Promise<ApiResponse<MarketMetadata>> {
    return this.request<MarketMetadata>(`/api/metadata/market/${marketAddress}`);
  }

  async linkMetadataToMarket(
    metadataId: string,
    marketAddress: string
  ): Promise<ApiResponse<{ id: string; marketAddress: string }>> {
    return this.request(`/api/metadata/${metadataId}/link`, {
      method: 'PATCH',
      body: JSON.stringify({ marketAddress }),
    });
  }

  // Config
  async getConfig(): Promise<ApiResponse<AppConfigResponse>> {
    return this.request<AppConfigResponse>('/api/config');
  }

  // Contracts
  async getContracts(): Promise<ApiResponse<ContractsResponse>> {
    return this.request<ContractsResponse>('/api/config/contracts');
  }

  async getContractByChainId(chainId: string): Promise<ApiResponse<ChainContract>> {
    return this.request<ChainContract>(`/api/config/contracts/${chainId}`);
  }

  // Worker Management
  async getWorkers(): Promise<ApiResponse<WorkersResponse>> {
    return this.request<WorkersResponse>('/api/v1/admin/workers');
  }

  async getWorker(workerType: string): Promise<ApiResponse<WorkerDetail>> {
    return this.request<WorkerDetail>(`/api/v1/admin/workers/${workerType}`);
  }

  async updateWorker(
    workerType: string,
    enabled: boolean
  ): Promise<ApiResponse<WorkerConfig & { message: string }>> {
    return this.request(`/api/v1/admin/workers/${workerType}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  }
}

// Singleton instance
export const apiClient = new APIClient();
