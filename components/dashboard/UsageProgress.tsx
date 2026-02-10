'use client';

import { cn } from '@/lib/utils';

interface UsageProgressProps {
  label: string;
  utilization: number;
  resetsAt: string | null;
}

function getProgressColor(utilization: number): string {
  if (utilization >= 95) return 'bg-red-500';
  if (utilization >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

function formatResetTime(resetsAt: string | null): string {
  if (!resetsAt) return 'No reset scheduled';

  const resetDate = new Date(resetsAt);
  const now = new Date();
  const diff = resetDate.getTime() - now.getTime();

  if (diff < 0) return 'Reset pending';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Resets in ${days}d ${hours % 24}h`;
  }

  return `Resets in ${hours}h ${minutes}m`;
}

export function UsageProgress({ label, utilization, resetsAt }: UsageProgressProps) {
  const color = getProgressColor(utilization);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{utilization.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', color)}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">{formatResetTime(resetsAt)}</div>
    </div>
  );
}
