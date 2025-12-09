'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectButton } from '@/components/wallet';
import { useIsAdmin } from '@/features/admin/hooks/useIsAdmin';
import { AdminIcon } from '@/components/icons';
import { NAV_LINKS } from '@/components/landing/constants';
import { cn } from '@/lib/utils';

interface IconButtonProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
}

function IconButton({ href, icon: Icon, label, isActive }: IconButtonProps) {
  return (
    <Link href={href} className="relative group">
      <div
        className={cn(
          'p-2 rounded-lg transition-all duration-200',
          'hover:bg-gray-800',
          isActive
            ? 'bg-purple-900/50 text-purple-400'
            : 'text-gray-400 hover:text-gray-200'
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
        {label}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-800 rotate-45" />
      </div>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { connected } = useWallet();
  const { isAdmin, isWhitelisted } = useIsAdmin();

  const showAdminButton = connected && (isAdmin || isWhitelisted);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/95 backdrop-blur supports-[backdrop-filter]:bg-gray-950/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-white">PredictX</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-white',
                  pathname === link.href ? 'text-white' : 'text-gray-400'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: Chain indicator, Admin, Wallet */}
          <div className="flex items-center gap-3">
            {/* Solana chain indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-gray-300">Solana</span>
            </div>

            {/* Admin icon - only show for admin/whitelisted */}
            {showAdminButton && (
              <IconButton
                href="/admin"
                icon={AdminIcon}
                label="Admin Panel"
                isActive={pathname.startsWith('/admin')}
              />
            )}

            {/* Wallet */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
