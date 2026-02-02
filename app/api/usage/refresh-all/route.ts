import { NextResponse } from 'next/server';
import { getAllAccountsWithUsage, refreshAccountUsage } from '@/lib/db/accounts';
import type { RefreshAllResponse } from '@/types/account';
import { handleApiError } from '@/lib/api-error';

export async function POST() {
  try {
    const accounts = await getAllAccountsWithUsage();

    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        await refreshAccountUsage(account.id);
        return { accountId: account.id, success: true as const };
      })
    );

    const response: RefreshAllResponse = {
      success: true,
      results: results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        return {
          accountId: accounts[index].id,
          success: false,
          error: 'Refresh failed',
        };
      }),
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
