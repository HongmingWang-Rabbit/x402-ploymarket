'use client';

import type { DraftMarket, RulesSummary } from '../types';
import { ProposalStatusBadge } from './ProposalStatusBadge';
import type { ProposalStatus } from '../types';

interface DraftPreviewProps {
  draft: DraftMarket;
  validationStatus?: string;
  rulesSummary?: RulesSummary;
}

export function DraftPreview({ draft, validationStatus, rulesSummary }: DraftPreviewProps) {
  const confidencePercent = Math.round(draft.confidence_score * 100);

  return (
    <div className="mt-6 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-white">{draft.title}</h3>
        {validationStatus && (
          <ProposalStatusBadge status={validationStatus as ProposalStatus} />
        )}
      </div>

      <p className="text-gray-300 mb-4">{draft.description}</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">Category</span>
          <p className="text-sm text-gray-200 capitalize">
            {draft.category.replace('_', ' ')}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            AI Confidence
          </span>
          <div className="flex items-center gap-2">
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
      </div>

      {draft.resolution && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-200 mb-2">Resolution Details</h4>
          <p className="text-sm text-gray-400 mb-3">{draft.resolution.exact_question}</p>

          {draft.resolution.expiry && (
            <div className="text-xs text-gray-500 mb-3">
              Expires: {new Date(draft.resolution.expiry).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}
        </div>
      )}

      {rulesSummary && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-200 mb-3">Resolution Rules</h4>

          {rulesSummary.must_meet_all.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-green-400 uppercase tracking-wide">
                Must Meet All
              </span>
              <ul className="mt-1 space-y-1">
                {rulesSummary.must_meet_all.map((rule, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-green-400">+</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rulesSummary.must_not_count.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-red-400 uppercase tracking-wide">
                Does Not Count
              </span>
              <ul className="mt-1 space-y-1">
                {rulesSummary.must_not_count.map((rule, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-red-400">-</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rulesSummary.allowed_sources.length > 0 && (
            <div>
              <span className="text-xs text-blue-400 uppercase tracking-wide">
                Official Sources
              </span>
              <ul className="mt-1 space-y-1">
                {rulesSummary.allowed_sources.map((source, i) => (
                  <li key={i} className="text-sm text-gray-300">
                    {source}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {draft.market_address && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <a
            href={`/markets/${draft.market_address}`}
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            View Market
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
