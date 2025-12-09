import Link from 'next/link';

interface BackLinkProps {
  href: string;
  label?: string;
  className?: string;
}

export function BackLink({ href, label = 'Back', className = '' }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline ${className}`}
    >
      <svg
        className="w-4 h-4 mr-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      {label}
    </Link>
  );
}
