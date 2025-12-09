import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useBlockchain } from '@/lib/blockchain';
import { marketKeys } from '@/features/markets/types';
import type { AddLiquidityParams } from '@/types';

export function useAddLiquidity() {
  const queryClient = useQueryClient();
  const { adapter } = useBlockchain();

  return useMutation({
    mutationFn: async (params: AddLiquidityParams) => {
      const result = await adapter.addLiquidity(params);

      if (!result.success) {
        throw new Error(result.error || 'Add liquidity failed');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: marketKeys.detail(variables.marketAddress),
      });
      toast.success('Successfully added liquidity!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Add liquidity failed');
    },
  });
}
