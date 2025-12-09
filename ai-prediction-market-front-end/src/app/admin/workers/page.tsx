'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { config } from '@/config';

interface WorkerHeartbeat {
  id: string;
  worker_type: string;
  worker_instance_id: string;
  status: 'starting' | 'running' | 'idle' | 'error' | 'stopped';
  last_heartbeat: string;
  messages_processed: number;
  messages_failed: number;
  current_queue_size: number | null;
  last_error: string | null;
  last_error_at: string | null;
  consecutive_errors: number;
  hostname: string | null;
  pid: number | null;
  started_at: string;
}

interface WorkerStatus {
  id: string;
  worker_type: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  poll_interval_ms: number | null;
  cron_expression: string | null;
  input_queue: string | null;
  output_queue: string | null;
  created_at: string;
  updated_at: string;
  heartbeats: WorkerHeartbeat[];
  is_healthy: boolean;
  active_instances: number;
}

interface WorkersSummary {
  total: number;
  enabled: number;
  healthy: number;
  unhealthy: number;
}

async function getWorkers(): Promise<{ workers: WorkerStatus[]; summary: WorkersSummary }> {
  const response = await fetch(`${config.api.baseUrl}/api/v1/admin/workers`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch workers');
  }
  const result = await response.json();
  return result.data;
}

async function updateWorker(workerType: string, enabled: boolean): Promise<void> {
  const response = await fetch(`${config.api.baseUrl}/api/v1/admin/workers/${workerType}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update worker');
  }
}

function StatusBadge({ status, enabled }: { status: 'healthy' | 'unhealthy' | 'disabled'; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-700 text-gray-400">
        Disabled
      </span>
    );
  }
  if (status === 'healthy') {
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-900/50 text-green-400 border border-green-700">
        Healthy
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-900/50 text-red-400 border border-red-700">
      Unhealthy
    </span>
  );
}

function WorkerCard({
  worker,
  onToggle,
  isUpdating,
}: {
  worker: WorkerStatus;
  onToggle: (workerType: string, enabled: boolean) => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-400';
      case 'idle':
        return 'text-blue-400';
      case 'starting':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'stopped':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return `${Math.floor(diffSecs / 86400)}d ago`;
  };

  return (
    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{worker.display_name}</h3>
            <StatusBadge
              status={worker.is_healthy ? 'healthy' : 'unhealthy'}
              enabled={worker.enabled}
            />
          </div>
          <p className="text-sm text-gray-400 mt-1">{worker.description}</p>

          {/* Queue Info */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            {worker.input_queue && (
              <span>Input: <code className="text-gray-400">{worker.input_queue}</code></span>
            )}
            {worker.output_queue && (
              <span>Output: <code className="text-gray-400">{worker.output_queue}</code></span>
            )}
            {worker.poll_interval_ms && (
              <span>Poll: {worker.poll_interval_ms / 1000}s</span>
            )}
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{worker.enabled ? 'Enabled' : 'Disabled'}</span>
          <button
            onClick={() => onToggle(worker.worker_type, !worker.enabled)}
            disabled={isUpdating}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              worker.enabled ? 'bg-blue-600' : 'bg-gray-600'
            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                worker.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Active Instances Summary */}
      {worker.enabled && (
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Active Instances: <span className="text-white font-medium">{worker.active_instances}</span>
          </span>
          {worker.heartbeats.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {expanded ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>
      )}

      {/* Expanded Heartbeat Details */}
      {expanded && worker.heartbeats.length > 0 && (
        <div className="mt-4 space-y-2">
          {worker.heartbeats.map((hb) => (
            <div
              key={hb.id}
              className="p-3 bg-gray-900/50 border border-gray-700 rounded text-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`font-medium ${getStatusColor(hb.status)}`}>
                    {hb.status.toUpperCase()}
                  </span>
                  <span className="text-gray-500">
                    Instance: {hb.worker_instance_id.slice(0, 8)}...
                  </span>
                </div>
                <span className="text-gray-500">
                  Last heartbeat: {formatTimeAgo(hb.last_heartbeat)}
                </span>
              </div>

              <div className="flex items-center gap-6 mt-2 text-xs text-gray-400">
                <span>Processed: {hb.messages_processed}</span>
                <span>Failed: {hb.messages_failed}</span>
                {hb.current_queue_size !== null && (
                  <span>Queue Size: {hb.current_queue_size}</span>
                )}
                {hb.hostname && <span>Host: {hb.hostname}</span>}
                {hb.pid && <span>PID: {hb.pid}</span>}
              </div>

              {hb.last_error && (
                <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400">
                  <span className="font-medium">Error:</span> {hb.last_error}
                  {hb.last_error_at && (
                    <span className="ml-2 text-gray-500">
                      ({formatTimeAgo(hb.last_error_at)})
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Heartbeats Warning */}
      {worker.enabled && worker.heartbeats.length === 0 && (
        <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-sm text-yellow-400">
          No heartbeats received in the last 5 minutes. Worker may be stopped or not responding.
        </div>
      )}
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [summary, setSummary] = useState<WorkersSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingWorker, setUpdatingWorker] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadWorkers = useCallback(async () => {
    try {
      const { workers, summary } = await getWorkers();
      setWorkers(workers);
      setSummary(summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadWorkers();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, loadWorkers]);

  const handleToggle = async (workerType: string, enabled: boolean) => {
    setUpdatingWorker(workerType);
    try {
      await updateWorker(workerType, enabled);
      await loadWorkers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update worker');
    } finally {
      setUpdatingWorker(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Loading workers...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Worker Monitor</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor and manage background workers</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={loadWorkers}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{summary.total}</div>
            <div className="text-sm text-gray-400">Total Workers</div>
          </div>
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-400">{summary.enabled}</div>
            <div className="text-sm text-gray-400">Enabled</div>
          </div>
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-400">{summary.healthy}</div>
            <div className="text-sm text-gray-400">Healthy</div>
          </div>
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-400">{summary.unhealthy}</div>
            <div className="text-sm text-gray-400">Unhealthy</div>
          </div>
        </div>
      )}

      {/* Worker Pipeline Visualization */}
      <div className="mb-6 p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Pipeline Flow</h2>
        <div className="flex items-center justify-between text-xs overflow-x-auto pb-2">
          {['crawler', 'extractor', 'generator', 'validator', 'publisher'].map((type, index) => {
            const worker = workers.find((w) => w.worker_type === type);
            const isHealthy = worker?.is_healthy && worker?.enabled;
            return (
              <div key={type} className="flex items-center">
                <div
                  className={`px-3 py-2 rounded ${
                    isHealthy
                      ? 'bg-green-900/50 border border-green-700 text-green-400'
                      : worker?.enabled
                      ? 'bg-red-900/50 border border-red-700 text-red-400'
                      : 'bg-gray-700 border border-gray-600 text-gray-400'
                  }`}
                >
                  {worker?.display_name || type}
                </div>
                {index < 4 && (
                  <svg className="w-6 h-6 text-gray-600 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Workers List */}
      <div className="space-y-4">
        {workers.map((worker) => (
          <WorkerCard
            key={worker.id}
            worker={worker}
            onToggle={handleToggle}
            isUpdating={updatingWorker === worker.worker_type}
          />
        ))}
      </div>

      {workers.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No workers configured. Run the database migration to seed default workers.
        </div>
      )}
    </div>
  );
}
