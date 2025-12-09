import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className = '' }: EmptyStateProps) {
  return (
    <Card variant="bordered" className={className}>
      <CardContent className="text-center py-8">
        {icon && (
          <div className="mb-4 flex justify-center text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {description}
          </p>
        )}
        {action && (
          <div className="mt-4">
            {action}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
