'use client';

import { useState } from 'react';
import type { MarketCategory, ProposeRequest } from '../types';

const CATEGORIES: { value: MarketCategory; label: string }[] = [
  { value: 'technology', label: 'Technology' },
  { value: 'politics', label: 'Politics' },
  { value: 'finance', label: 'Finance' },
  { value: 'sports', label: 'Sports' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'misc', label: 'Other' },
];

interface ProposalFormProps {
  onSubmit: (data: ProposeRequest) => void;
  isLoading?: boolean;
}

export function ProposalForm({ onSubmit, isLoading }: ProposalFormProps) {
  const [proposalText, setProposalText] = useState('');
  const [categoryHint, setCategoryHint] = useState<MarketCategory | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalText.trim()) return;

    onSubmit({
      proposal_text: proposalText.trim(),
      category_hint: categoryHint || undefined,
    });
  };

  const charCount = proposalText.length;
  const isValidLength = charCount >= 10 && charCount <= 500;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="proposal"
          className="block text-sm font-medium text-gray-200 mb-2"
        >
          What do you want to predict?
        </label>
        <textarea
          id="proposal"
          value={proposalText}
          onChange={(e) => setProposalText(e.target.value)}
          placeholder="e.g., Will Apple release iPhone 16 before October 2024?"
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={4}
          maxLength={500}
          disabled={isLoading}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className={charCount < 10 ? 'text-yellow-500' : 'text-gray-500'}>
            {charCount < 10 ? `${10 - charCount} more characters needed` : ''}
          </span>
          <span className={charCount > 450 ? 'text-yellow-500' : 'text-gray-500'}>
            {charCount}/500
          </span>
        </div>
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-gray-200 mb-2"
        >
          Category (optional)
        </label>
        <select
          id="category"
          value={categoryHint}
          onChange={(e) => setCategoryHint(e.target.value as MarketCategory | '')}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        >
          <option value="">Auto-detect</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Our AI will suggest the best category if you leave this empty
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || !isValidLength}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          'Submit Proposal'
        )}
      </button>
    </form>
  );
}
