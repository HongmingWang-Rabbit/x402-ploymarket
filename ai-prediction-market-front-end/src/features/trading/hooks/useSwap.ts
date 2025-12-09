import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useBlockchain } from '@/lib/blockchain';
import { marketKeys } from '@/features/markets/types';
import type { SwapParams } from '@/types';

export function useSwap() {
  const queryClient = useQueryClient();
  const { adapter } = useBlockchain();

  return useMutation({
    mutationFn: async (params: SwapParams) => {
      const result = await adapter.swap(params);

      if (!result.success) {
        throw new Error(result.error || 'Swap failed');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate market data to refresh prices
      queryClient.invalidateQueries({
        queryKey: marketKeys.detail(variables.marketAddress),
      });
      toast.success(
        `Successfully ${variables.direction === 'buy' ? 'bought' : 'sold'} ${variables.tokenType.toUpperCase()} tokens!`
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Swap failed');
    },
  });
}
