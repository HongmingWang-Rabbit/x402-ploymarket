'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  listAdminProposals,
  reviewProposal,
  type AdminProposal,
} from '@/features/admin/api';

type StatusFilter = 'needs_human' | 'approved' | 'rejected' | 'all';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'needs_human', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function ProposalCard({
  proposal,
  onReview,
}: {
  proposal: AdminProposal;
  onReview: (id: string, decision: 'approve' | 'reject') => void;
}) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const confidencePercent = proposal.confidence_score
    ? Math.round(proposal.confidence_score * 100)
    : null;

  const handleApprove = async () => {
    setIsReviewing(true);
    try {
      await onReview(proposal.id, 'approve');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsReviewing(true);
    try {
      await reviewProposal(proposal.id, {
        decision: 'reject',
        reason: rejectReason,
      });
      setShowRejectModal(false);
      window.location.reload();
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-white mb-1">
            {proposal.draft_title || 'Processing...'}
          </h3>
          <p className="text-sm text-gray-400 line-clamp-2">{proposal.proposal_text}</p>
        </div>
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            proposal.status === 'needs_human'
              ? 'bg-orange-900/50 text-orange-400'
              : proposal.status === 'approved'
              ? 'bg-green-900/50 text-green-400'
              : 'bg-red-900/50 text-red-400'
          }`}
        >
          {proposal.status === 'needs_human' ? 'Pending' : proposal.status}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        {proposal.category_hint && (
          <span className="capitalize">{proposal.category_hint.replace('_', ' ')}</span>
        )}
        {confidencePercent !== null && (
          <span>Confidence: {confidencePercent}%</span>
        )}
        <span>{new Date(proposal.created_at).toLocaleDateString()}</span>
      </div>

      {proposal.validation_decision?.reason && (
        <div className="text-xs text-gray-400 bg-gray-900/50 p-2 rounded mb-3">
          <span className="text-gray-500">Reason: </span>
          {proposal.validation_decision.reason}
        </div>
      )}

      {proposal.status === 'needs_human' && (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/proposals/${proposal.id}`}
            className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300"
          >
            View Details
          </Link>
          <button
            onClick={handleApprove}
            disabled={isReviewing}
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isReviewing}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded transition-colors"
          >
            Reject
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Reject Proposal</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || isReviewing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<AdminProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('needs_human');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const status = statusFilter === 'all' ? undefined : statusFilter;
        const result = await listAdminProposals({ status, limit: 50 });
        setProposals(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposals');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  const handleReview = async (id: string, decision: 'approve' | 'reject') => {
    try {
      await reviewProposal(id, { decision, reason: 'Approved by admin' });
      // Refresh list
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const result = await listAdminProposals({ status, limit: 50 });
      setProposals(result.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to review proposal');
    }
  };

  const pendingCount = proposals.filter((p) => p.status === 'needs_human').length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Proposal Review</h1>
          {pendingCount > 0 && statusFilter === 'needs_human' && (
            <p className="text-sm text-orange-400 mt-1">
              {pendingCount} proposal{pendingCount !== 1 ? 's' : ''} pending review
            </p>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm rounded-t transition-colors ${
              statusFilter === tab.value
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading proposals...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-blue-400 hover:text-blue-300"
          >
            Try again
          </button>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No proposals found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onReview={handleReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
