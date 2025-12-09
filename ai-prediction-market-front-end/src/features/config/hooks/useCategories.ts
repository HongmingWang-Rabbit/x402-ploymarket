'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, type Category } from '@/lib/api/client';

// Fallback categories if backend is unavailable
const FALLBACK_CATEGORIES: Category[] = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'science', label: 'Science & Tech' },
  { id: 'finance', label: 'Finance' },
  { id: 'world', label: 'World Events' },
  { id: 'other', label: 'Other' },
];

export function useCategories() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['config', 'categories'],
    queryFn: async () => {
      const response = await apiClient.getConfig();
      if (response.success && response.data?.categories) {
        return response.data.categories;
      }
      return FALLBACK_CATEGORIES;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - categories rarely change
    retry: 1,
  });

  return {
    categories: data || FALLBACK_CATEGORIES,
    isLoading,
    error,
  };
}
