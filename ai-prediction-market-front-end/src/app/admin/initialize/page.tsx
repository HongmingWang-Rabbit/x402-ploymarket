'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { toast } from 'react-toastify';

export default function InitializePage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const handleInitialize = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);

    try {
      // Initialize protocol logic would go here
      toast.success('Protocol initialized successfully!');
      router.push('/admin');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to initialize'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Initialize Protocol
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Set up the prediction market protocol
        </p>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Protocol Initialization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Warning:</strong> This action can only be performed once.
                Make sure you are the intended protocol administrator.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Connected Wallet:</strong>{' '}
                {publicKey?.toBase58() || 'Not connected'}
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                onClick={handleInitialize}
                isLoading={isLoading}
                disabled={!connected}
              >
                {connected ? 'Initialize Protocol' : 'Connect Wallet First'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
