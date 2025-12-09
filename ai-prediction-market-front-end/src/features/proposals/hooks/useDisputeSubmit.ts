'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface DisputeSubmitParams {
  market_address: string;
  user_address: string;
  reason: string;
  evidence_urls?: string[];
  user_token_balance: {
    yes_tokens: number;
    no_tokens: number;
  };
}

export interface DisputeSubmitResponse {
  dispute_id: string;
  status: string;
  message: string;
}

async function submitDispute(params: DisputeSubmitParams): Promise<DisputeSubmitResponse> {
  const response = await fetch(`${API_BASE}/api/v1/disputes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();

    // Handle specific error codes
    if (response.status === 429) {
      throw new Error(error.error?.message || 'Rate limit exceeded. Please try again later.');
    }
    if (response.status === 400) {
      throw new Error(error.error?.message || 'Invalid dispute request');
    }
    if (response.status === 404) {
      throw new Error(error.error?.message || 'Market not found');
    }

    throw new Error(error.error?.message || 'Failed to submit dispute');
  }

  const result = await response.json();
  return result.data;
}

export function useDisputeSubmit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitDispute,
    onSuccess: (data, variables) => {
      // Invalidate market details to refresh disputes list
      queryClient.invalidateQueries({
        queryKey: ['ai-market', variables.market_address],
      });
    },
  });
}

export default useDisputeSubmit;
