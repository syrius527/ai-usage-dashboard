'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AccountWithUsage } from '@/types/account';

const REFRESH_INTERVAL = 5 * 60 * 1000;

export function useUsage() {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      if (data.accounts) {
        setAccounts(data.accounts);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/usage/refresh-all', { method: 'POST' });
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }, [fetchAccounts]);

  const refreshOne = useCallback(
    async (accountId: string) => {
      try {
        await fetch(`/api/accounts/${accountId}/refresh`, { method: 'POST' });
        await fetchAccounts();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh account');
      }
    },
    [fetchAccounts]
  );

  useEffect(() => {
    fetchAccounts().then(() => setLoading(false));
  }, [fetchAccounts]);

  useEffect(() => {
    const interval = setInterval(refreshAll, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshAll]);

  return {
    accounts,
    loading,
    refreshing,
    lastUpdated,
    error,
    refreshAll,
    refreshOne,
  };
}
