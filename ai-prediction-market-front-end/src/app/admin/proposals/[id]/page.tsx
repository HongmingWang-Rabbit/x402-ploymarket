'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getAdminProposal,
  reviewProposal,
  type AdminProposalDetail,
} from '@/features/admin/api';

export default function AdminProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [proposal, setProposal] = useState<AdminProposalDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAdminProposal(id);
        setProposal(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposal');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  const handleApprove = async () => {
    setIsReviewing(true);
    try {
      await reviewProposal(id, { decision: 'approve', reason: 'Approved by admin' });
      router.push('/admin/proposals');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsReviewing(true);
    try {
      await reviewProposal(id, { decision: 'reject', reason: rejectReason });
      router.push('/admin/proposals');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Loading proposal...</p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-red-400">{error || 'Proposal not found'}</p>
        <Link href="/admin/proposals" className="mt-4 text-blue-400 hover:text-blue-300">
          Back to proposals
        </Link>
      </div>
    );
  }

  const confidencePercent = proposal.market_confidence
    ? Math.round(proposal.market_confidence * 100)
    : null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/proposals"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Proposals
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {proposal.market_title || 'Proposal Review'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">ID: {proposal.id}</p>
        </div>
        <span
          className={`px-3 py-1 text-sm rounded-full ${
            proposal.status === 'needs_human'
              ? 'bg-orange-900/50 text-orange-400'
              : proposal.status === 'approved'
              ? 'bg-green-900/50 text-green-400'
              : 'bg-red-900/50 text-red-400'
          }`}
        >
          {proposal.status === 'needs_human' ? 'Pending Review' : proposal.status}
        </span>
      </div>

      {/* Original Proposal */}
      <section className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Original Proposal
        </h2>
        <p className="text-white">{proposal.proposal_text}</p>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          {proposal.category_hint && (
            <span className="capitalize">{proposal.category_hint.replace('_', ' ')}</span>
          )}
          <span>Submitted: {new Date(proposal.created_at).toLocaleString()}</span>
        </div>
      </section>

      {/* Generated Market */}
      {proposal.market_title && (
        <section className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Generated Market
          </h2>

          <h3 className="text-lg font-semibold text-white mb-2">{proposal.market_title}</h3>
          <p className="text-gray-300 mb-4">{proposal.market_description}</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-xs text-gray-500 uppercase">Category</span>
              <p className="text-sm text-gray-200 capitalize">
                {proposal.market_category?.replace('_', ' ')}
              </p>
            </div>
            {confidencePercent !== null && (
              <div>
                <span className="text-xs text-gray-500 uppercase">AI Confidence</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        confidencePercent >= 70
                          ? 'bg-green-500'
                          : confidencePercent >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-200">{confidencePercent}%</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Resolution Rules */}
      {proposal.market_resolution && (
        <section className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Resolution Rules
          </h2>

          <div className="mb-4">
            <span className="text-xs text-gray-500 uppercase">Exact Question</span>
            <p className="text-sm text-white mt-1">{proposal.market_resolution.exact_question}</p>
          </div>

          {proposal.market_resolution.expiry && (
            <div className="mb-4">
              <span className="text-xs text-gray-500 uppercase">Expiry Date</span>
              <p className="text-sm text-white mt-1">
                {new Date(proposal.market_resolution.expiry).toLocaleString()}
              </p>
            </div>
          )}

          {proposal.market_resolution.criteria && (
            <>
              {proposal.market_resolution.criteria.must_meet_all?.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs text-green-400 uppercase">Must Meet All</span>
                  <ul className="mt-1 space-y-1">
                    {proposal.market_resolution.criteria.must_meet_all.map((rule, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400">+</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {proposal.market_resolution.criteria.must_not_count?.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs text-red-400 uppercase">Does Not Count</span>
                  <ul className="mt-1 space-y-1">
                    {proposal.market_resolution.criteria.must_not_count.map((rule, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-red-400">-</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {proposal.market_resolution.criteria.allowed_sources?.length > 0 && (
                <div>
                  <span className="text-xs text-blue-400 uppercase">Official Sources</span>
                  <ul className="mt-1 space-y-1">
                    {proposal.market_resolution.criteria.allowed_sources.map((source, i) => (
                      <li key={i} className="text-sm text-gray-300">
                        <span className="font-medium">{source.name}</span>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
                          >
                            {source.url}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Validation Details */}
      {proposal.validation_decision && (
        <section className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Validation Decision
          </h2>

          <div className="mb-2">
            <span className="text-xs text-gray-500 uppercase">Reason</span>
            <p className="text-sm text-white mt-1">{proposal.validation_decision.reason}</p>
          </div>

          {proposal.validation_decision.evidence?.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 uppercase">Evidence</span>
              <ul className="mt-1 space-y-1">
                {proposal.validation_decision.evidence.map((item, i) => (
                  <li key={i} className="text-sm text-gray-400">
                    - {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Action Buttons */}
      {proposal.status === 'needs_human' && (
        <div className="flex items-center gap-4 pt-6 border-t border-gray-700">
          <button
            onClick={handleApprove}
            disabled={isReviewing}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
          >
            Approve & Publish
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isReviewing}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
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
              rows={4}
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
                Reject Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
