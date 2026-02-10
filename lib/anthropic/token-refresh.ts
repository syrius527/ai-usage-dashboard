import { OAuthError } from './oauth';

const TOKEN_REFRESH_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const PRE_EXPIRY_BUFFER_30MIN_MS = 30 * 60 * 1000;

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export function isTokenExpiredOrNearExpiry(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  const now = Date.now();
  const expiryTime = expiresAt.getTime();
  return now >= expiryTime - PRE_EXPIRY_BUFFER_30MIN_MS;
}

export async function refreshOAuthToken(refreshToken: string): Promise<TokenRefreshResult> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  try {
    const response = await fetch(TOKEN_REFRESH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        throw new OAuthError('REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired');
      }
      throw new OAuthError('API_ERROR', `Token refresh failed with status ${response.status}`);
    }

    const data: TokenRefreshResponse = await response.json();

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (error) {
    if (error instanceof OAuthError) {
      throw error;
    }
    throw new OAuthError('NETWORK_ERROR', error instanceof Error ? error.message : 'Token refresh failed');
  }
}

export function validateRefreshToken(token: string): { valid: boolean; error?: string } {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: 'Refresh token is required for auto-refresh' };
  }

  const trimmed = token.trim();

  if (!trimmed.startsWith('sk-ant-ort')) {
    return {
      valid: false,
      error: 'Invalid refresh token format. Refresh tokens start with sk-ant-ort...',
    };
  }

  if (trimmed.length < 50) {
    return { valid: false, error: 'Refresh token appears to be incomplete' };
  }

  return { valid: true };
}
