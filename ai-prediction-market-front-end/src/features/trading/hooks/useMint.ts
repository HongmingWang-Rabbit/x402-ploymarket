import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useBlockchain } from '@/lib/blockchain';
import { marketKeys } from '@/features/markets/types';
import type { MintRedeemParams } from '@/types';

export function useMintCompleteSet() {
  const queryClient = useQueryClient();
  const { adapter } = useBlockchain();

  return useMutation({
    mutationFn: async (params: MintRedeemParams) => {
      const result = await adapter.mintCompleteSet(params);

      if (!result.success) {
        throw new Error(result.error || 'Mint failed');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: marketKeys.detail(variables.marketAddress),
      });
      toast.success('Successfully minted complete set!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Mint failed');
    },
  });
}
