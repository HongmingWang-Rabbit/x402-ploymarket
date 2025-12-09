import type { AdminPanelSection } from './types';

// Define all admin panel sections and items
// This is modular - add new items/sections here as needed
export const adminPanelConfig: AdminPanelSection[] = [
  {
    id: 'ai-moderation',
    title: 'AI Moderation',
    items: [
      {
        id: 'review-proposals',
        title: 'Review Proposals',
        description: 'Review and approve/reject AI-generated market proposals',
        href: '/admin/proposals',
        requireAdmin: true,
      },
      {
        id: 'review-disputes',
        title: 'Review Disputes',
        description: 'Handle disputed market resolutions',
        href: '/admin/disputes',
        requireAdmin: true,
      },
      {
        id: 'ai-config',
        title: 'AI Configuration',
        description: 'Manage AI model settings, rate limits, and categories',
        href: '/admin/ai-config',
        requireAdmin: true,
      },
      {
        id: 'worker-monitor',
        title: 'Worker Monitor',
        description: 'Monitor and enable/disable background worker processes',
        href: '/admin/workers',
        requireAdmin: true,
      },
    ],
  },
  {
    id: 'market-management',
    title: 'Market Management',
    items: [
      {
        id: 'create-market',
        title: 'Create Market',
        description: 'Create a new prediction market for users to trade on',
        href: '/admin/create-market',
        requireWhitelist: true,
      },
      {
        id: 'resolve-market',
        title: 'Resolve Market',
        description: 'Resolve a market and distribute winnings to holders',
        href: '/admin/resolve-market',
        requireAdmin: true,
        comingSoon: true,
      },
      {
        id: 'pause-market',
        title: 'Pause/Unpause Market',
        description: 'Temporarily pause trading on a specific market',
        href: '/admin/pause-market',
        requireAdmin: true,
        comingSoon: true,
      },
    ],
  },
  {
    id: 'protocol-settings',
    title: 'Protocol Settings',
    items: [
      {
        id: 'initialize',
        title: 'Initialize Protocol',
        description: 'One-time setup to initialize the prediction market protocol',
        href: '/admin/initialize',
        requireAdmin: true,
      },
      {
        id: 'update-fees',
        title: 'Update Fees',
        description: 'Modify platform and LP fee settings',
        href: '/admin/fees',
        requireAdmin: true,
        comingSoon: true,
      },
      {
        id: 'update-config',
        title: 'Update Config',
        description: 'Modify protocol configuration parameters',
        href: '/admin/config',
        requireAdmin: true,
        comingSoon: true,
      },
    ],
  },
  {
    id: 'access-control',
    title: 'Access Control',
    items: [
      {
        id: 'whitelist',
        title: 'Manage Whitelist',
        description: 'Add or remove addresses from the market creator whitelist',
        href: '/admin/whitelist',
        requireAdmin: true,
        comingSoon: true,
      },
      {
        id: 'transfer-authority',
        title: 'Transfer Authority',
        description: 'Transfer protocol ownership to a new address',
        href: '/admin/transfer-authority',
        requireAdmin: true,
        comingSoon: true,
      },
    ],
  },
  {
    id: 'treasury',
    title: 'Treasury',
    items: [
      {
        id: 'withdraw-fees',
        title: 'Withdraw Platform Fees',
        description: 'Withdraw accumulated platform fees to team wallet',
        href: '/admin/withdraw-fees',
        requireAdmin: true,
        comingSoon: true,
      },
      {
        id: 'insurance-pool',
        title: 'Insurance Pool',
        description: 'Manage the LP insurance pool settings',
        href: '/admin/insurance',
        requireAdmin: true,
        comingSoon: true,
      },
    ],
  },
];

// Helper to filter items based on user permissions
export function getAccessibleItems(
  sections: AdminPanelSection[],
  { isAdmin, isWhitelisted }: { isAdmin: boolean; isWhitelisted: boolean }
): AdminPanelSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.requireAdmin && !isAdmin) return false;
        if (item.requireWhitelist && !isWhitelisted && !isAdmin) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}
