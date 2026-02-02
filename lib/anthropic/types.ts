export interface UsageLimit {
  utilization: number;
  resets_at: string | null;
}

export interface AnthropicUsageResponse {
  five_hour: UsageLimit | null;
  seven_day: UsageLimit | null;
  seven_day_oauth_apps: UsageLimit | null;
  seven_day_opus: UsageLimit | null;
}

export interface ParsedUsage {
  fiveHour: {
    utilization: number;
    resetsAt: Date | null;
  } | null;
  sevenDay: {
    utilization: number;
    resetsAt: Date | null;
  } | null;
  sevenDayOpus: {
    utilization: number;
    resetsAt: Date | null;
  } | null;
}

export type OAuthErrorCode = 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'REFRESH_TOKEN_INVALID' | 'API_ERROR' | 'NETWORK_ERROR';
