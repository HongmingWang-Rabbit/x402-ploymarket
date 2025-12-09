import { ReactNode } from 'react';

// Admin panel item type
export interface AdminPanelItem {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  href?: string;
  action?: () => void;
  // Access control
  requireAdmin?: boolean;      // Only for contract authority
  requireWhitelist?: boolean;  // For whitelisted creators
  disabled?: boolean;
  comingSoon?: boolean;
}

// Admin panel section
export interface AdminPanelSection {
  id: string;
  title: string;
  items: AdminPanelItem[];
}

// Query keys for admin
export const adminKeys = {
  all: ['admin'] as const,
  config: () => [...adminKeys.all, 'config'] as const,
  whitelist: (address: string) => [...adminKeys.all, 'whitelist', address] as const,
};
