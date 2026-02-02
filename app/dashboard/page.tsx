'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/dashboard/Header';
import { UsageCardGrid } from '@/components/dashboard/UsageCardGrid';
import { useUsage } from '@/hooks/useUsage';

export default function DashboardPage() {
  const { accounts, loading, refreshing, lastUpdated, error, refreshAll, refreshOne } = useUsage();
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const handleRefreshOne = useCallback(
    async (accountId: string) => {
      setRefreshingIds((prev) => new Set(prev).add(accountId));
      await refreshOne(accountId);
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    },
    [refreshOne]
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header onRefresh={refreshAll} refreshing={refreshing} lastUpdated={lastUpdated} />

      <main className="flex-1 p-6 space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">{error}</div>
        )}

        <UsageCardGrid
          accounts={accounts}
          loading={loading}
          onRefreshOne={handleRefreshOne}
          refreshingIds={refreshingIds}
        />
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Claude Usage Monitor v3.0
      </footer>
    </div>
  );
}
