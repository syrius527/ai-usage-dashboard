import { NextResponse } from 'next/server';
import {
  getAllAccountsWithUsage,
  createAccount,
  refreshAccountUsage,
  getAccountWithUsage,
} from '@/lib/db/accounts';
import {
  validateOAuthToken,
  validateAccountName,
  maskToken,
  type AccountListResponse,
  type CreateAccountRequest,
  type CreateAccountResponse,
} from '@/types/account';
import { validateRefreshToken } from '@/lib/anthropic';
import { handleApiError } from '@/lib/api-error';

export async function GET() {
  try {
    const accounts = await getAllAccountsWithUsage();

    const response: AccountListResponse = {
      accounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAccountRequest;
    const { name, agentType, plan, token, refreshToken, tokenExpiresAt } = body;

    const nameValidation = validateAccountName(name);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: nameValidation.error } },
        { status: 400 }
      );
    }

    const tokenValidation = validateOAuthToken(token);
    if (!tokenValidation.valid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: tokenValidation.error } },
        { status: 400 }
      );
    }

    if (refreshToken) {
      const refreshValidation = validateRefreshToken(refreshToken);
      if (!refreshValidation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TOKEN', message: refreshValidation.error } },
          { status: 400 }
        );
      }
    }

    const tokenHint = maskToken(token);
    const expiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : undefined;
    const account = await createAccount(
      name,
      token,
      tokenHint,
      agentType ?? 'claude-code',
      plan,
      refreshToken,
      expiresAt
    );

    try {
      await refreshAccountUsage(account.id);
    } catch {}

    const updatedAccount = await getAccountWithUsage(account.id);

    const response: CreateAccountResponse = {
      success: true,
      account: updatedAccount!,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
