'use client';

import { UsageCard } from './UsageCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccountWithUsage } from '@/types/account';

interface UsageCardGridProps {
  accounts: AccountWithUsage[];
  loading: boolean;
  onRefreshOne: (accountId: string) => void;
  refreshingIds: Set<string>;
}

export function UsageCardGrid({
  accounts,
  loading,
  onRefreshOne,
  refreshingIds,
}: UsageCardGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No accounts configured</p>
        <p className="text-sm">Add an account in Settings to start monitoring usage</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => (
        <UsageCard
          key={account.id}
          account={account}
          onRefresh={() => onRefreshOne(account.id)}
          refreshing={refreshingIds.has(account.id)}
        />
      ))}
    </div>
  );
}
