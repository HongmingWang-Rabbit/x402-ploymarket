import { useQuery } from '@tanstack/react-query';
import { getProposal } from '../api';
import { proposalKeys } from '../types';

interface UseProposalOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useProposal(proposalId: string | null, options: UseProposalOptions = {}) {
  const { enabled = true, refetchInterval = false } = options;

  return useQuery({
    queryKey: proposalKeys.detail(proposalId || ''),
    queryFn: () => getProposal(proposalId!),
    enabled: enabled && !!proposalId,
    refetchInterval,
    staleTime: 1000 * 30, // 30 seconds
  });
}
