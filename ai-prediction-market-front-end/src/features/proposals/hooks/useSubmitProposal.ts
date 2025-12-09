import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitProposal } from '../api';
import { proposalKeys, type ProposeRequest, type ProposeResponse } from '../types';

export function useSubmitProposal() {
  const queryClient = useQueryClient();

  return useMutation<ProposeResponse, Error, ProposeRequest>({
    mutationFn: submitProposal,
    onSuccess: () => {
      // Invalidate proposal list cache
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
    },
  });
}
