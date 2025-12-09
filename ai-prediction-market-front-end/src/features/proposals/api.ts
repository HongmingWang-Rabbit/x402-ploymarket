import { config } from '@/config';
import type { ProposeRequest, ProposeResponse, Proposal } from './types';

const API_BASE = config.api.baseUrl;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

// Submit a new proposal
export async function submitProposal(
  request: ProposeRequest
): Promise<ProposeResponse> {
  const response = await fetch(`${API_BASE}/api/v1/propose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data: ApiResponse<ProposeResponse> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to submit proposal');
  }

  return data.data!;
}

// Get proposal by ID
export async function getProposal(proposalId: string): Promise<Proposal> {
  const response = await fetch(`${API_BASE}/api/v1/propose/${proposalId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data: ApiResponse<Proposal> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch proposal');
  }

  return data.data!;
}

// Poll proposal status until terminal state or timeout
export async function pollProposalStatus(
  proposalId: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onStatusChange?: (status: string) => void;
  } = {}
): Promise<Proposal> {
  const { maxAttempts = 60, intervalMs = 2000, onStatusChange } = options;

  const terminalStates = ['matched', 'approved', 'rejected', 'needs_human', 'published'];
  let attempts = 0;
  let lastStatus = '';

  while (attempts < maxAttempts) {
    const proposal = await getProposal(proposalId);

    if (proposal.status !== lastStatus) {
      lastStatus = proposal.status;
      onStatusChange?.(proposal.status);
    }

    if (terminalStates.includes(proposal.status)) {
      return proposal;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error('Proposal processing timed out');
}
