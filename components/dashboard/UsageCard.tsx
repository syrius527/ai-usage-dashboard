'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { UsageProgress } from './UsageProgress';
import { AgentLogo } from '@/components/ui/agent-logo';
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

function formatPlanName(plan: string | null): string | null {
  if (!plan) return null;
  return plan
    .replace(/^default_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function UsageCard({ account, onRefresh, refreshing }: UsageCardProps) {
  const { usage, status, lastError } = account;
  const formattedPlan = formatPlanName(account.plan);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AgentLogo type={account.agentType} size={28} />
            <div>
              <CardTitle className="text-lg">{account.name}</CardTitle>
              {formattedPlan && (
                <Badge variant="secondary" className="mt-1 text-xs font-normal">
                  {formattedPlan}
                </Badge>
              )}
            </div>
          </div>
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
        <p className="text-xs text-muted-foreground font-mono mt-1">{account.tokenHint}</p>
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
