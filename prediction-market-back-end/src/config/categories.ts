// Market categories configuration
// Add/remove categories here as needed

export const MARKET_CATEGORIES = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'science', label: 'Science & Tech' },
  { id: 'finance', label: 'Finance' },
  { id: 'world', label: 'World Events' },
  { id: 'other', label: 'Other' },
] as const;

export type CategoryId = typeof MARKET_CATEGORIES[number]['id'];
