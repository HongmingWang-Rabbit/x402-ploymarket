'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ProposalForm,
  DraftPreview,
  ExistingMarketMatch,
  ProcessingIndicator,
  useSubmitProposal,
  type ProposeRequest,
  type ProposeResponse,
} from '@/features/proposals';

export default function ProposePage() {
  const { mutate: submit, isPending, isError, error, reset } = useSubmitProposal();
  const [result, setResult] = useState<ProposeResponse | null>(null);

  const handleSubmit = (data: ProposeRequest) => {
    setResult(null);
    submit(data, {
      onSuccess: (response) => {
        setResult(response);
      },
    });
  };

  const handleReset = () => {
    setResult(null);
    reset();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Markets
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Propose a Market</h1>
        <p className="text-gray-400">
          Describe what you want to predict, and our AI will create a market with
          clear, deterministic resolution rules.
        </p>
      </div>

      {/* Tips */}
      <div className="mb-8 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
        <h3 className="text-sm font-medium text-blue-400 mb-2">Tips for good proposals</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>- Be specific about dates and conditions</li>
          <li>- Focus on events with verifiable outcomes</li>
          <li>- Avoid subjective or opinion-based questions</li>
          <li>- Include relevant context (company, product, person)</li>
        </ul>
      </div>

      {/* Form */}
      {!result && (
        <ProposalForm onSubmit={handleSubmit} isLoading={isPending} />
      )}

      {/* Processing */}
      {isPending && <ProcessingIndicator />}

      {/* Error */}
      {isError && (
        <div className="mt-6 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-red-400 font-medium">Failed to submit proposal</h3>
              <p className="text-sm text-gray-400 mt-1">
                {error?.message || 'An unexpected error occurred. Please try again.'}
              </p>
              <button
                onClick={handleReset}
                className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Matched Market */}
          {result.status === 'matched' && result.existing_market && (
            <ExistingMarketMatch market={result.existing_market} />
          )}

          {/* Draft Preview */}
          {result.draft_market && (
            <DraftPreview
              draft={result.draft_market}
              validationStatus={result.validation_status}
              rulesSummary={result.rules_summary}
            />
          )}

          {/* Needs Human Review Notice */}
          {result.validation_status === 'needs_human' && (
            <div className="p-4 bg-orange-900/20 border border-orange-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="text-orange-400 font-medium">Under Review</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Your proposal requires human review before it can be published.
                    This usually takes 1-2 business days. We&apos;ll notify you when
                    it&apos;s approved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rejected Notice */}
          {result.validation_status === 'rejected' && (
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-red-400 font-medium">Proposal Rejected</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    This proposal couldn&apos;t be converted to a valid prediction market.
                    Common reasons include ambiguous outcomes, forbidden topics, or
                    missing verifiable sources.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Another */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={handleReset}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Submit another proposal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
