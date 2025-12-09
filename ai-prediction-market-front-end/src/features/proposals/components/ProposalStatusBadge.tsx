'use client';

import type { ProposalStatus } from '../types';

const STATUS_CONFIG: Record<
  ProposalStatus,
  { color: string; bgColor: string; label: string; animate?: boolean }
> = {
  pending: { color: 'text-gray-400', bgColor: 'bg-gray-700', label: 'Pending' },
  processing: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/50',
    label: 'Processing...',
    animate: true,
  },
  matched: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900/50',
    label: 'Similar Market Found',
  },
  draft_created: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/50',
    label: 'Draft Created',
  },
  approved: {
    color: 'text-green-400',
    bgColor: 'bg-green-900/50',
    label: 'Approved',
  },
  rejected: {
    color: 'text-red-400',
    bgColor: 'bg-red-900/50',
    label: 'Rejected',
  },
  needs_human: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/50',
    label: 'Under Review',
  },
  published: {
    color: 'text-green-400',
    bgColor: 'bg-green-900/50',
    label: 'Published',
  },
};

interface ProposalStatusBadgeProps {
  status: ProposalStatus;
}

export function ProposalStatusBadge({ status }: ProposalStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}
    >
      {config.animate && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      {config.label}
    </span>
  );
}
