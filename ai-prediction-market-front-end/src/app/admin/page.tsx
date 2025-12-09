'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, Button } from '@/components/ui';
import { useIsAdmin } from '@/features/admin/hooks/useIsAdmin';
import { adminPanelConfig, getAccessibleItems } from '@/features/admin/config';
import type { AdminPanelItem, AdminPanelSection } from '@/features/admin/types';

function AdminItemCard({ item }: { item: AdminPanelItem }) {
  const isDisabled = item.disabled || item.comingSoon;

  const content = (
    <Card
      variant="bordered"
      className={`transition-shadow ${!isDisabled ? 'hover:shadow-md cursor-pointer' : 'opacity-60'}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              {item.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {item.description}
            </p>
          </div>
          {item.comingSoon && (
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
              Coming Soon
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (item.href && !isDisabled) {
    return <Link href={item.href}>{content}</Link>;
  }

  if (item.action && !isDisabled) {
    return <div onClick={item.action}>{content}</div>;
  }

  return content;
}

function AdminSection({ section }: { section: AdminPanelSection }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {section.title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {section.items.map((item) => (
          <AdminItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { isAdmin, isWhitelisted, isLoading, walletAddress } = useIsAdmin();

  // Filter sections based on user permissions
  const accessibleSections = getAccessibleItems(adminPanelConfig, {
    isAdmin,
    isWhitelisted,
  });

  // If not connected, show connect message
  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage the prediction market protocol
          </p>
        </div>

        <Card variant="bordered">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please connect your wallet to access the admin panel.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Checking permissions...
          </p>
        </div>
      </div>
    );
  }

  // If no access, show unauthorized message
  if (!isAdmin && !isWhitelisted) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage the prediction market protocol
          </p>
        </div>

        <Card variant="bordered">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Your wallet does not have admin or whitelist access.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Connected: {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/')}
            >
              Back to Markets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Admin Panel
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage the prediction market protocol
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isAdmin
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
              {isAdmin ? 'Admin' : 'Whitelisted'}
            </span>
          </div>
        </div>
      </div>

      {accessibleSections.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No admin actions available.
            </p>
          </CardContent>
        </Card>
      ) : (
        accessibleSections.map((section) => (
          <AdminSection key={section.id} section={section} />
        ))
      )}
    </div>
  );
}
