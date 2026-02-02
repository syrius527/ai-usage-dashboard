'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountWithUsage } from '@/types/account';

interface UseAccountsReturn {
  accounts: AccountWithUsage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refreshAccount: (id: string) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
}

export function useAccounts(): UseAccountsReturn {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/accounts');
      const data = await response.json();

      if (data.accounts) {
        setAccounts(data.accounts);
      } else if (data.error) {
        setError(data.error.message);
      }
    } catch {
      setError('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const refreshAccount = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/accounts/${id}/refresh`, {
          method: 'POST',
        });
        const data = await response.json();

        if (data.success) {
          await fetchAccounts();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fetchAccounts]
  );

  const deleteAccount = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/accounts/${id}`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (data.success) {
          await fetchAccounts();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fetchAccounts]
  );

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
    refreshAccount,
    deleteAccount,
  };
}

export function useConnectedAccounts(): AccountWithUsage[] {
  const { accounts } = useAccounts();
  return accounts.filter((a) => a.status === 'connected');
}
