import type { AnthropicUsageResponse, OAuthErrorCode } from './types';

const ANTHROPIC_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const ANTHROPIC_BETA = 'oauth-2025-04-20';
const USER_AGENT = 'claude-usage-monitor/1.0';

export class OAuthError extends Error {
  constructor(
    public code: OAuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export async function fetchUsage(oauthToken: string): Promise<AnthropicUsageResponse> {
  try {
    const response = await fetch(ANTHROPIC_USAGE_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oauthToken}`,
        'anthropic-beta': ANTHROPIC_BETA,
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new OAuthError('TOKEN_EXPIRED', 'OAuth token has expired');
      }
      if (response.status === 403) {
        throw new OAuthError('TOKEN_INVALID', 'OAuth token is invalid');
      }
      throw new OAuthError('API_ERROR', `API returned ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof OAuthError) {
      throw error;
    }
    throw new OAuthError('NETWORK_ERROR', error instanceof Error ? error.message : 'Network error');
  }
}
