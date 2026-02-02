import { db } from '@/lib/db';
import { accounts, usageCache } from '@/lib/db/schema';
import { decrypt, encrypt } from '@/lib/crypto';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import {
  fetchUsage,
  parseUsageResponse,
  OAuthError,
  refreshOAuthToken,
  isTokenExpiredOrNearExpiry,
} from '@/lib/anthropic';
import type { AccountWithUsage, UsageData, AccountStatus, AgentType } from '@/types/account';

export interface ResolvedAccount {
  id: string;
  token: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

export async function resolveAccountToken(accountId: string): Promise<ResolvedAccount> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, accountId));

  if (rows.length === 0) {
    throw new Error('Account not found');
  }

  const account = rows[0];
  const token = decrypt(account.tokenEncrypted);
  const refreshToken = account.refreshTokenEncrypted
    ? decrypt(account.refreshTokenEncrypted)
    : null;

  return {
    id: account.id,
    token,
    refreshToken,
    tokenExpiresAt: account.tokenExpiresAt,
  };
}

export async function getAllAccountsWithUsage(): Promise<AccountWithUsage[]> {
  const accountRows = await db.select().from(accounts).orderBy(accounts.name);

  const result: AccountWithUsage[] = [];

  for (const account of accountRows) {
    const usageRows = await db
      .select()
      .from(usageCache)
      .where(eq(usageCache.accountId, account.id))
      .limit(1);

    const usage = usageRows[0];

    result.push({
      id: account.id,
      name: account.name,
      agentType: (account.agentType ?? 'claude-code') as AgentType,
      plan: account.plan,
      tokenHint: account.tokenHint,
      status: account.status as AccountStatus,
      hasRefreshToken: !!account.refreshTokenEncrypted,
      lastError: account.lastError,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      usage: usage
        ? {
            fiveHour: usage.fiveHourUtilization !== null
              ? {
                  utilization: usage.fiveHourUtilization,
                  resetsAt: usage.fiveHourResetsAt?.toISOString() ?? null,
                }
              : null,
            sevenDay: usage.sevenDayUtilization !== null
              ? {
                  utilization: usage.sevenDayUtilization,
                  resetsAt: usage.sevenDayResetsAt?.toISOString() ?? null,
                }
              : null,
            sevenDayOpus: usage.sevenDayOpusUtilization !== null
              ? {
                  utilization: usage.sevenDayOpusUtilization,
                  resetsAt: usage.sevenDayOpusResetsAt?.toISOString() ?? null,
                }
              : null,
            fetchedAt: usage.fetchedAt.toISOString(),
          }
        : null,
    });
  }

  return result;
}

export async function getAccountWithUsage(accountId: string): Promise<AccountWithUsage | null> {
  const accountRows = await db.select().from(accounts).where(eq(accounts.id, accountId));

  if (accountRows.length === 0) {
    return null;
  }

  const account = accountRows[0];
  const usageRows = await db
    .select()
    .from(usageCache)
    .where(eq(usageCache.accountId, account.id))
    .limit(1);

  const usage = usageRows[0];

  return {
    id: account.id,
    name: account.name,
    agentType: (account.agentType ?? 'claude-code') as AgentType,
    plan: account.plan,
    tokenHint: account.tokenHint,
    status: account.status as AccountStatus,
    hasRefreshToken: !!account.refreshTokenEncrypted,
    lastError: account.lastError,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    usage: usage
      ? {
          fiveHour: usage.fiveHourUtilization !== null
            ? {
                utilization: usage.fiveHourUtilization,
                resetsAt: usage.fiveHourResetsAt?.toISOString() ?? null,
              }
            : null,
          sevenDay: usage.sevenDayUtilization !== null
            ? {
                utilization: usage.sevenDayUtilization,
                resetsAt: usage.sevenDayResetsAt?.toISOString() ?? null,
              }
            : null,
          sevenDayOpus: usage.sevenDayOpusUtilization !== null
            ? {
                utilization: usage.sevenDayOpusUtilization,
                resetsAt: usage.sevenDayOpusResetsAt?.toISOString() ?? null,
              }
            : null,
          fetchedAt: usage.fetchedAt.toISOString(),
        }
      : null,
  };
}

export async function createAccount(
  name: string,
  token: string,
  tokenHint: string,
  agentType: AgentType = 'claude-code',
  plan?: string,
  refreshToken?: string,
  tokenExpiresAt?: Date
): Promise<AccountWithUsage> {
  const now = new Date();
  const accountId = uuid();

  await db.insert(accounts).values({
    id: accountId,
    name: name.trim(),
    agentType,
    plan: plan ?? null,
    tokenEncrypted: encrypt(token),
    tokenHint,
    refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
    tokenExpiresAt: tokenExpiresAt ?? null,
    status: 'connected',
    lastError: null,
    lastSyncAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const account = await getAccountWithUsage(accountId);
  return account!;
}

export async function updateAccountStatus(
  accountId: string,
  status: AccountStatus,
  error?: string
): Promise<void> {
  await db
    .update(accounts)
    .set({
      status,
      lastError: error ?? null,
      lastSyncAt: status === 'connected' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));
}

export async function updateUsageCache(
  accountId: string,
  usage: {
    fiveHour: { utilization: number; resetsAt: Date | null } | null;
    sevenDay: { utilization: number; resetsAt: Date | null } | null;
    sevenDayOpus: { utilization: number; resetsAt: Date | null } | null;
  }
): Promise<void> {
  const existing = await db
    .select()
    .from(usageCache)
    .where(eq(usageCache.accountId, accountId))
    .limit(1);

  const now = new Date();
  const values = {
    fiveHourUtilization: usage.fiveHour?.utilization ?? null,
    fiveHourResetsAt: usage.fiveHour?.resetsAt ?? null,
    sevenDayUtilization: usage.sevenDay?.utilization ?? null,
    sevenDayResetsAt: usage.sevenDay?.resetsAt ?? null,
    sevenDayOpusUtilization: usage.sevenDayOpus?.utilization ?? null,
    sevenDayOpusResetsAt: usage.sevenDayOpus?.resetsAt ?? null,
    fetchedAt: now,
  };

  if (existing.length > 0) {
    await db.update(usageCache).set(values).where(eq(usageCache.accountId, accountId));
  } else {
    await db.insert(usageCache).values({
      id: uuid(),
      accountId,
      ...values,
    });
  }
}

async function updateAccountTokens(
  accountId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  await db
    .update(accounts)
    .set({
      tokenEncrypted: encrypt(accessToken),
      refreshTokenEncrypted: encrypt(refreshToken),
      tokenExpiresAt: expiresAt,
      status: 'connected',
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));
}

export async function refreshAccountUsage(accountId: string): Promise<UsageData> {
  let resolved = await resolveAccountToken(accountId);

  if (isTokenExpiredOrNearExpiry(resolved.tokenExpiresAt) && resolved.refreshToken) {
    try {
      const refreshed = await refreshOAuthToken(resolved.refreshToken);
      await updateAccountTokens(
        accountId,
        refreshed.accessToken,
        refreshed.refreshToken,
        refreshed.expiresAt
      );
      resolved = { ...resolved, token: refreshed.accessToken };
    } catch (error) {
      if (error instanceof OAuthError && error.code === 'REFRESH_TOKEN_INVALID') {
        await updateAccountStatus(accountId, 'expired', 'Refresh token expired. Please re-authenticate.');
      }
      throw error;
    }
  }

  try {
    const response = await fetchUsage(resolved.token);
    const parsed = parseUsageResponse(response);

    await updateUsageCache(accountId, parsed);
    await updateAccountStatus(accountId, 'connected');

    return {
      fiveHour: parsed.fiveHour
        ? {
            utilization: parsed.fiveHour.utilization,
            resetsAt: parsed.fiveHour.resetsAt?.toISOString() ?? null,
          }
        : null,
      sevenDay: parsed.sevenDay
        ? {
            utilization: parsed.sevenDay.utilization,
            resetsAt: parsed.sevenDay.resetsAt?.toISOString() ?? null,
          }
        : null,
      sevenDayOpus: parsed.sevenDayOpus
        ? {
            utilization: parsed.sevenDayOpus.utilization,
            resetsAt: parsed.sevenDayOpus.resetsAt?.toISOString() ?? null,
          }
        : null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof OAuthError) {
      const status = error.code === 'TOKEN_EXPIRED' ? 'expired' : 'error';
      await updateAccountStatus(accountId, status, error.message);
    } else {
      await updateAccountStatus(accountId, 'error', error instanceof Error ? error.message : 'Unknown error');
    }
    throw error;
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  await db.delete(accounts).where(eq(accounts.id, accountId));
}

export async function updateAccount(
  accountId: string,
  updates: {
    name?: string;
    agentType?: AgentType;
    plan?: string;
    token?: string;
    tokenHint?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
  }
): Promise<void> {
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) {
    updateValues.name = updates.name.trim();
  }

  if (updates.agentType !== undefined) {
    updateValues.agentType = updates.agentType;
  }

  if (updates.plan !== undefined) {
    updateValues.plan = updates.plan;
  }

  if (updates.token !== undefined) {
    updateValues.tokenEncrypted = encrypt(updates.token);
    updateValues.tokenHint = updates.tokenHint;
    updateValues.status = 'connected';
    updateValues.lastError = null;
  }

  if (updates.refreshToken !== undefined) {
    updateValues.refreshTokenEncrypted = encrypt(updates.refreshToken);
  }

  if (updates.tokenExpiresAt !== undefined) {
    updateValues.tokenExpiresAt = updates.tokenExpiresAt;
  }

  await db.update(accounts).set(updateValues).where(eq(accounts.id, accountId));
}
