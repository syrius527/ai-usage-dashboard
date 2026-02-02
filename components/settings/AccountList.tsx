'use client';

import { AccountCard } from './AccountCard';
import type { AccountWithUsage } from '@/types/account';

interface AccountListProps {
  accounts: AccountWithUsage[];
  refreshingId: string | null;
  onRefresh: (id: string) => void;
  onEdit: (account: AccountWithUsage) => void;
  onDelete: (account: AccountWithUsage) => void;
}

export function AccountList({
  accounts,
  refreshingId,
  onRefresh,
  onEdit,
  onDelete,
}: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No accounts configured</p>
        <p className="text-sm">Add an account to start monitoring usage</p>
      </div>
    );
  }

  return (
    <div>
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          refreshing={refreshingId === account.id}
          onRefresh={() => onRefresh(account.id)}
          onEdit={() => onEdit(account)}
          onDelete={() => onDelete(account)}
        />
      ))}
    </div>
  );
}
