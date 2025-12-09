'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type DisputeStatus = 'pending' | 'reviewing' | 'upheld' | 'overturned' | 'escalated';

interface AdminDispute {
  id: string;
  market_address: string;
  market_title: string;
  original_result: 'YES' | 'NO';
  user_address: string;
  user_token_balance: {
    yes_tokens: number;
    no_tokens: number;
  };
  reason: string;
  evidence_urls: string[];
  status: DisputeStatus;
  ai_review: {
    decision: string;
    confidence: number;
    reasoning: string;
  } | null;
  admin_review: {
    decision: string;
    reason: string;
    reviewed_by: string;
    reviewed_at: string;
  } | null;
  created_at: string;
  resolved_at: string | null;
}

type StatusFilter = 'escalated' | 'pending' | 'reviewing' | 'all';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'escalated', label: 'Escalated' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'all', label: 'All' },
];

async function listAdminDisputes(options: {
  status?: DisputeStatus;
  limit?: number;
}): Promise<{ data: AdminDispute[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', options.limit.toString());

  const response = await fetch(`${API_BASE}/api/v1/admin/disputes?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch disputes');
  }
  const result = await response.json();
  return { data: result.data, hasMore: result.meta?.has_more || false };
}

async function reviewDispute(
  id: string,
  decision: { decision: 'uphold' | 'overturn'; new_result?: 'YES' | 'NO'; reason: string }
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/admin/disputes/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decision),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to review dispute');
  }
}

function DisputeCard({
  dispute,
}: {
  dispute: AdminDispute;
}) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [reviewReason, setReviewReason] = useState('');

  const handleReview = async (decision: 'uphold' | 'overturn', newResult?: 'YES' | 'NO') => {
    if (!reviewReason.trim()) return;
    setIsReviewing(true);
    try {
      await reviewDispute(dispute.id, { decision, new_result: newResult, reason: reviewReason });
      setShowModal(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to review');
    } finally {
      setIsReviewing(false);
    }
  };

  const statusColors: Record<DisputeStatus, string> = {
    pending: 'bg-yellow-900/50 text-yellow-400',
    reviewing: 'bg-blue-900/50 text-blue-400',
    escalated: 'bg-orange-900/50 text-orange-400',
    upheld: 'bg-red-900/50 text-red-400',
    overturned: 'bg-green-900/50 text-green-400',
  };

  return (
    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-white mb-1">{dispute.market_title}</h3>
          <p className="text-sm text-gray-400">
            Original Result: <span className="font-medium">{dispute.original_result}</span>
          </p>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[dispute.status]}`}>
          {dispute.status}
        </span>
      </div>

      <div className="mb-3 p-3 bg-gray-900/50 rounded">
        <p className="text-sm text-gray-300">{dispute.reason}</p>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span>Disputant: {dispute.user_address.slice(0, 8)}...</span>
        <span>
          Tokens: {dispute.user_token_balance.yes_tokens} YES / {dispute.user_token_balance.no_tokens} NO
        </span>
        <span>{new Date(dispute.created_at).toLocaleDateString()}</span>
      </div>

      {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-gray-500">Evidence:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {dispute.evidence_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Source {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {dispute.ai_review && (
        <div className="mb-3 p-2 bg-blue-900/20 border border-blue-800 rounded text-xs">
          <span className="text-blue-400 font-medium">AI Review: </span>
          <span className="text-gray-300">{dispute.ai_review.decision}</span>
          <span className="text-gray-500 ml-2">({Math.round(dispute.ai_review.confidence * 100)}% confidence)</span>
          {dispute.ai_review.reasoning && (
            <p className="text-gray-400 mt-1">{dispute.ai_review.reasoning}</p>
          )}
        </div>
      )}

      {['pending', 'reviewing', 'escalated'].includes(dispute.status) && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
          <button
            onClick={() => setShowModal(true)}
            disabled={isReviewing}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors"
          >
            Review
          </button>
        </div>
      )}

      {/* Review Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Review Dispute</h3>

            <div className="mb-4 p-3 bg-gray-900/50 rounded">
              <p className="text-sm text-gray-300">
                <strong>Market:</strong> {dispute.market_title}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                <strong>Original Result:</strong> {dispute.original_result}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                <strong>Dispute Reason:</strong> {dispute.reason.slice(0, 100)}...
              </p>
            </div>

            <textarea
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              placeholder="Reason for your decision..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 resize-none mb-4"
              rows={3}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview('uphold')}
                disabled={!reviewReason.trim() || isReviewing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded"
              >
                Uphold (Keep {dispute.original_result})
              </button>
              <button
                onClick={() => handleReview('overturn', dispute.original_result === 'YES' ? 'NO' : 'YES')}
                disabled={!reviewReason.trim() || isReviewing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded"
              >
                Overturn (Change to {dispute.original_result === 'YES' ? 'NO' : 'YES'})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('escalated');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const status = statusFilter === 'all' ? undefined : statusFilter;
        const result = await listAdminDisputes({ status: status as DisputeStatus, limit: 50 });
        setDisputes(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load disputes');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  const escalatedCount = disputes.filter((d) => d.status === 'escalated').length;

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
          <h1 className="text-2xl font-bold text-white">Dispute Review</h1>
          {escalatedCount > 0 && statusFilter === 'escalated' && (
            <p className="text-sm text-orange-400 mt-1">
              {escalatedCount} dispute{escalatedCount !== 1 ? 's' : ''} need review
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
          <p className="text-gray-400">Loading disputes...</p>
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
      ) : disputes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No disputes found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} />
          ))}
        </div>
      )}
    </div>
  );
}
