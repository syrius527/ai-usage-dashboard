'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trash2, Pencil, RefreshCw, Zap } from 'lucide-react';
import type { AccountWithUsage, AccountStatus } from '@/types/account';

interface AccountCardProps {
  account: AccountWithUsage;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
  refreshing: boolean;
}

function getStatusBadge(status: AccountStatus) {
  switch (status) {
    case 'connected':
      return <Badge variant="default">Connected</Badge>;
    case 'expired':
      return <Badge variant="destructive">Expired</Badge>;
    case 'error':
      return <Badge variant="destructive">Error</Badge>;
  }
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function AccountCard({
  account,
  onRefresh,
  onEdit,
  onDelete,
  refreshing,
}: AccountCardProps) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{account.name}</span>
              {getStatusBadge(account.status)}
              {account.hasRefreshToken && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Zap className="h-3 w-3" />
                  Auto
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground font-mono">{account.tokenHint}</div>
            {account.status === 'error' && account.lastError && (
              <div className="text-sm text-destructive mt-1">Error: {account.lastError}</div>
            )}
            {account.status === 'expired' && (
              <div className="text-sm text-destructive mt-1">
                {account.hasRefreshToken
                  ? 'Refresh token expired. Please update tokens.'
                  : 'Token expired. Please update with a new token.'}
              </div>
            )}
            {account.usage && (
              <div className="text-xs text-muted-foreground mt-2 flex gap-4">
                {account.usage.fiveHour && (
                  <span>5h: {account.usage.fiveHour.utilization.toFixed(0)}%</span>
                )}
                {account.usage.sevenDay && (
                  <span>7d: {account.usage.sevenDay.utilization.toFixed(0)}%</span>
                )}
              </div>
            )}
            {account.lastSyncAt && (
              <div className="text-xs text-muted-foreground mt-1">
                Last sync: {formatRelativeTime(account.lastSyncAt)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh usage"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit account">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Delete account">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
