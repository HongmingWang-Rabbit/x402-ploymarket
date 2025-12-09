'use client';

import Link from 'next/link';
import { TwitterIcon, DiscordIcon, GithubIcon } from '@/components/icons';
import { LANDING_CONFIG } from './constants';

export function Footer() {
  const { brand, footer } = LANDING_CONFIG;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-800 pt-12 pb-8 mt-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-white font-bold text-lg">{brand.name}</span>
          </div>
          <p className="text-gray-400 text-sm">
            Decentralized prediction markets powered by Solana and AI technology.
          </p>
        </div>

        {/* Platform links */}
        <div>
          <h4 className="text-white font-semibold mb-4">Platform</h4>
          <ul className="space-y-2">
            {footer.sections.platform.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support links */}
        <div>
          <h4 className="text-white font-semibold mb-4">Support</h4>
          <ul className="space-y-2">
            {footer.sections.support.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Social */}
        <div>
          <h4 className="text-white font-semibold mb-4">Community</h4>
          <div className="flex gap-4">
            <a
              href={footer.social.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <TwitterIcon className="w-5 h-5" />
            </a>
            <a
              href={footer.social.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Discord"
            >
              <DiscordIcon className="w-5 h-5" />
            </a>
            <a
              href={footer.social.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <GithubIcon className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="text-center text-gray-500 text-sm">
        &copy; {currentYear} {brand.name}. All rights reserved.
      </div>
    </footer>
  );
}
