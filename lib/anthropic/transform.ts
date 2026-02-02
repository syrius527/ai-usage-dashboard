import type { AnthropicUsageResponse, ParsedUsage } from './types';

export function parseUsageResponse(response: AnthropicUsageResponse): ParsedUsage {
  return {
    fiveHour: response.five_hour
      ? {
          utilization: response.five_hour.utilization,
          resetsAt: response.five_hour.resets_at ? new Date(response.five_hour.resets_at) : null,
        }
      : null,
    sevenDay: response.seven_day
      ? {
          utilization: response.seven_day.utilization,
          resetsAt: response.seven_day.resets_at ? new Date(response.seven_day.resets_at) : null,
        }
      : null,
    sevenDayOpus: response.seven_day_opus
      ? {
          utilization: response.seven_day_opus.utilization,
          resetsAt: response.seven_day_opus.resets_at
            ? new Date(response.seven_day_opus.resets_at)
            : null,
        }
      : null,
  };
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  const seconds = Math.abs(diff) / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  const isFuture = diff > 0;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';

  if (days >= 1) {
    const d = Math.floor(days);
    return `${prefix}${d} day${d > 1 ? 's' : ''}${suffix}`;
  }
  if (hours >= 1) {
    const h = Math.floor(hours);
    const m = Math.floor(minutes % 60);
    return `${prefix}${h}h ${m}m${suffix}`;
  }
  if (minutes >= 1) {
    const m = Math.floor(minutes);
    return `${prefix}${m} min${m > 1 ? 's' : ''}${suffix}`;
  }
  return 'just now';
}
