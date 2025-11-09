'use client';

import { useEffect, useState } from 'react';

/**
 * ClientOnly Component
 * Ensures children only render on the client side, preventing SSR hydration issues
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
