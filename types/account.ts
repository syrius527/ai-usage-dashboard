export type AccountStatus = 'connected' | 'error' | 'expired';

export interface Account {
  id: string;
  name: string;
  tokenEncrypted: string;
  tokenHint: string;
  status: AccountStatus;
  lastError: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAccount {
  name: string;
  token: string;
}

export interface UpdateAccount {
  name?: string;
  token?: string;
}

export interface UsageData {
  fiveHour: {
    utilization: number;
    resetsAt: string | null;
  } | null;
  sevenDay: {
    utilization: number;
    resetsAt: string | null;
  } | null;
  sevenDayOpus: {
    utilization: number;
    resetsAt: string | null;
  } | null;
  fetchedAt: string;
}

export interface AccountWithUsage {
  id: string;
  name: string;
  tokenHint: string;
  status: AccountStatus;
  hasRefreshToken: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  usage: UsageData | null;
}

export interface AccountListResponse {
  accounts: AccountWithUsage[];
}

export interface CreateAccountRequest {
  name: string;
  token: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

export interface CreateAccountResponse {
  success: true;
  account: AccountWithUsage;
}

export interface UpdateAccountRequest {
  name?: string;
  token?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

export interface UpdateAccountResponse {
  success: true;
  account: AccountWithUsage;
}

export interface DeleteAccountResponse {
  success: true;
}

export interface VerifyTokenRequest {
  token: string;
}

export interface VerifyTokenSuccess {
  success: true;
  usage: {
    fiveHour: { utilization: number; resetsAt: string | null } | null;
    sevenDay: { utilization: number; resetsAt: string | null } | null;
  };
}

export interface VerifyTokenError {
  success: false;
  error: {
    code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'NETWORK_ERROR';
    message: string;
  };
}

export type VerifyTokenResponse = VerifyTokenSuccess | VerifyTokenError;

export interface RefreshResponse {
  success: true;
  usage: UsageData;
}

export interface RefreshAllResponse {
  success: true;
  results: Array<{
    accountId: string;
    success: boolean;
    error?: string;
  }>;
}

export type ErrorCode =
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'ACCOUNT_NOT_FOUND'
  | 'ENCRYPTION_ERROR'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED';

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export function validateOAuthToken(token: string): { valid: boolean; error?: string } {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: 'Token is required' };
  }

  const trimmed = token.trim();

  if (!trimmed.startsWith('sk-ant-oat')) {
    return {
      valid: false,
      error: 'Invalid token format. OAuth tokens start with sk-ant-oat...',
    };
  }

  if (trimmed.length < 50) {
    return { valid: false, error: 'Token appears to be incomplete' };
  }

  return { valid: true };
}

export function validateAccountName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Account name is required' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Account name must be 50 characters or less' };
  }

  return { valid: true };
}

export function maskToken(token: string): string {
  if (token.length < 20) return '***';
  const prefix = token.slice(0, 14);
  const suffix = token.slice(-4);
  return `${prefix}***...***${suffix}`;
}
