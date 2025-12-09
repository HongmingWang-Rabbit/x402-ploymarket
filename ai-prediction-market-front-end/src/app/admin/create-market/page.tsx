'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useCreateMarket, formValuesToParams } from '@/features/markets/hooks';
import { useIsAdmin } from '@/features/admin/hooks/useIsAdmin';
import { useCategories } from '@/features/config/hooks';
import type { CreateMarketFormValues } from '@/features/markets/types';

export default function CreateMarketPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { canCreateMarket, isLoading: isCheckingPermissions } = useIsAdmin();
  const { mutate: createMarket, isPending } = useCreateMarket();
  const { categories } = useCategories();

  const [formValues, setFormValues] = useState<CreateMarketFormValues>({
    question: '',
    yesSymbol: '',
    initialYesProb: 50, // Default 50%
    description: '',
    category: '',
    resolutionSource: '',
    startDate: '',
    endDate: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  const handleChange = (field: keyof CreateMarketFormValues, value: string | number) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formValues.question.trim()) {
      newErrors.question = 'Question is required';
    } else if (formValues.question.length > 64) {
      newErrors.question = 'Question must be 64 characters or less';
    }

    if (!formValues.yesSymbol.trim()) {
      newErrors.yesSymbol = 'Token symbol is required';
    } else if (formValues.yesSymbol.length > 10) {
      newErrors.yesSymbol = 'Symbol must be 10 characters or less';
    }

    if (formValues.initialYesProb < 20 || formValues.initialYesProb > 80) {
      newErrors.initialYesProb = 'Initial probability must be between 20% and 80%';
    }

    // Validate end date is after start date if both provided
    if (formValues.startDate && formValues.endDate) {
      const start = new Date(formValues.startDate);
      const end = new Date(formValues.endDate);
      if (end <= start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;
    if (!connected) {
      setErrors({ submit: 'Please connect your wallet first' });
      return;
    }
    if (!canCreateMarket) {
      setErrors({ submit: 'You do not have permission to create markets' });
      return;
    }

    try {
      // formValuesToParams is now async (stores metadata in backend)
      const { params, metadataId } = await formValuesToParams(formValues);

      createMarket(
        { params, metadataId },
        {
          onSuccess: (data) => {
            if (data?.marketAddress) {
              router.push(`/markets/${data.marketAddress}`);
            } else {
              router.push('/');
            }
          },
        }
      );
    } catch {
      setErrors({ submit: 'Failed to prepare market data' });
    }
  };

  // Check permissions
  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block"
          >
            &larr; Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Market
          </h1>
        </div>
        <Card variant="bordered">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Please connect your wallet to create a market.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCheckingPermissions) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block"
          >
            &larr; Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Market
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Checking permissions...
          </p>
        </div>
      </div>
    );
  }

  if (!canCreateMarket) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block"
          >
            &larr; Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Market
          </h1>
        </div>
        <Card variant="bordered">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You do not have permission to create markets.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Contact an admin to get whitelisted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block"
        >
          &larr; Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Create Market
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create a new prediction market for others to trade on
        </p>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Market Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contract Required Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Contract Fields (Required)
              </h3>

              <Input
                label="Question"
                placeholder="Will X happen by Y date?"
                value={formValues.question}
                onChange={(e) => handleChange('question', e.target.value)}
                error={errors.question}
                helperText={`Market question - sent to contract (${formValues.question.length}/64 characters)`}
              />

              <Input
                label="Token Symbol"
                placeholder="e.g., YES-BTC, TRUMP-WIN"
                value={formValues.yesSymbol}
                onChange={(e) => handleChange('yesSymbol', e.target.value.toUpperCase())}
                error={errors.yesSymbol}
                helperText="Symbol for the YES token - sent to contract (max 10 characters)"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Initial YES Probability: {formValues.initialYesProb}%
                </label>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={formValues.initialYesProb}
                  onChange={(e) => handleChange('initialYesProb', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>20%</span>
                  <span>50%</span>
                  <span>80%</span>
                </div>
                {errors.initialYesProb && (
                  <p className="text-red-500 text-sm mt-1">{errors.initialYesProb}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Starting probability - sent to contract (must be 20-80%)
                </p>
              </div>
            </div>

            {/* Contract Optional Fields */}
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Contract Fields (Optional)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Trading Start Date"
                  type="datetime-local"
                  value={formValues.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  helperText="Converted to slot - sent to contract"
                />

                <Input
                  label="Trading End Date"
                  type="datetime-local"
                  value={formValues.endDate}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  error={errors.endDate}
                  helperText="Converted to slot - sent to contract"
                />
              </div>
            </div>

            {/* Metadata Fields - Accordion */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Additional Info (optional)
                  </h3>
                  <div className="relative group">
                    <svg
                      className="w-4 h-4 text-gray-400 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <path strokeWidth="2" d="M12 16v-4M12 8h.01" />
                    </svg>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                      These fields are stored in the database (not on-chain). A URL to this data is passed to the contract as metadata.
                    </div>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${showAdditionalInfo ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAdditionalInfo && (
                <div className="space-y-4 pt-4">
                  <Input
                    label="Description"
                    placeholder="Additional context about this market..."
                    value={formValues.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={formValues.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Resolution Source"
                    placeholder="How will this market be resolved?"
                    value={formValues.resolutionSource}
                    onChange={(e) => handleChange('resolutionSource', e.target.value)}
                  />
                </div>
              )}
            </div>

            {errors.submit && (
              <p className="text-red-500 text-sm">{errors.submit}</p>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isPending}
                disabled={!connected || !canCreateMarket}
              >
                Create Market
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
