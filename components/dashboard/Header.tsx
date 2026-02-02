'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw, LogOut, Settings } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdated: Date | null;
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function Header({ onRefresh, refreshing, lastUpdated }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">Claude Usage Monitor</h1>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-1">
            Updated {formatLastUpdated(lastUpdated)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/settings')}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </header>
  );
}
