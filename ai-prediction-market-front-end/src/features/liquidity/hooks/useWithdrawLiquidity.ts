import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useBlockchain } from '@/lib/blockchain';
import { marketKeys } from '@/features/markets/types';
import type { WithdrawLiquidityParams } from '@/types';

export function useWithdrawLiquidity() {
  const queryClient = useQueryClient();
  const { adapter } = useBlockchain();

  return useMutation({
    mutationFn: async (params: WithdrawLiquidityParams) => {
      const result = await adapter.withdrawLiquidity(params);

      if (!result.success) {
        throw new Error(result.error || 'Withdraw liquidity failed');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: marketKeys.detail(variables.marketAddress),
      });
      toast.success('Successfully withdrew liquidity!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Withdraw liquidity failed');
    },
  });
}
