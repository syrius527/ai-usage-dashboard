'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { UsageProgress } from './UsageProgress';
import type { AccountWithUsage, AccountStatus } from '@/types/account';

interface UsageCardProps {
  account: AccountWithUsage;
  onRefresh: () => void;
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

export function UsageCard({ account, onRefresh, refreshing }: UsageCardProps) {
  const { usage, status, lastError } = account;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{account.name}</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge(status)}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-mono">{account.tokenHint}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === 'error' && lastError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{lastError}</span>
          </div>
        )}

        {status === 'expired' && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Token expired. Please update in Settings.</span>
          </div>
        )}

        {usage ? (
          <>
            {usage.fiveHour && (
              <UsageProgress
                label="5-Hour Limit"
                utilization={usage.fiveHour.utilization}
                resetsAt={usage.fiveHour.resetsAt}
              />
            )}
            {usage.sevenDay && (
              <UsageProgress
                label="7-Day Limit"
                utilization={usage.sevenDay.utilization}
                resetsAt={usage.sevenDay.resetsAt}
              />
            )}
            {usage.sevenDayOpus && usage.sevenDayOpus.utilization > 0 && (
              <UsageProgress
                label="7-Day Opus"
                utilization={usage.sevenDayOpus.utilization}
                resetsAt={usage.sevenDayOpus.resetsAt}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No usage data available</p>
        )}
      </CardContent>
    </Card>
  );
}
