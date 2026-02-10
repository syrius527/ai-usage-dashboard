'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AccountList } from '@/components/settings/AccountList';
import { AddAccountModal } from '@/components/settings/AddAccountModal';
import { EditAccountModal } from '@/components/settings/EditAccountModal';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';
import { ArrowLeft, Plus, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AccountWithUsage } from '@/types/account';

export default function SettingsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountWithUsage | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<AccountWithUsage | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await fetch(`/api/accounts/${id}/refresh`, { method: 'POST' });
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to refresh account:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h1 className="text-xl font-semibold">Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Accounts</h2>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg border bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <AccountList
            accounts={accounts}
            refreshingId={refreshingId}
            onRefresh={handleRefresh}
            onEdit={setEditAccount}
            onDelete={setDeleteAccount}
          />
        )}
      </div>

      <AddAccountModal open={showAdd} onOpenChange={setShowAdd} onSuccess={fetchAccounts} />

      <EditAccountModal
        open={!!editAccount}
        account={editAccount}
        onOpenChange={(open) => {
          if (!open) setEditAccount(null);
        }}
        onSuccess={fetchAccounts}
      />

      <DeleteAccountModal
        open={!!deleteAccount}
        account={deleteAccount}
        onOpenChange={(open) => {
          if (!open) setDeleteAccount(null);
        }}
        onSuccess={fetchAccounts}
      />
    </div>
  );
}
