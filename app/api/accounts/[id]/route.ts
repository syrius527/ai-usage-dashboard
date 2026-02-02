import { NextResponse } from 'next/server';
import {
  getAccountWithUsage,
  updateAccount,
  deleteAccount,
  refreshAccountUsage,
} from '@/lib/db/accounts';
import {
  validateAccountName,
  validateOAuthToken,
  maskToken,
  type UpdateAccountRequest,
  type UpdateAccountResponse,
  type DeleteAccountResponse,
} from '@/types/account';
import { validateRefreshToken } from '@/lib/anthropic';
import { handleApiError } from '@/lib/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateAccountRequest;

    const existing = await getAccountWithUsage(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } },
        { status: 404 }
      );
    }

    if (body.name !== undefined) {
      const validation = validateAccountName(body.name);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TOKEN', message: validation.error } },
          { status: 400 }
        );
      }
    }

    if (body.token !== undefined) {
      const validation = validateOAuthToken(body.token);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TOKEN', message: validation.error } },
          { status: 400 }
        );
      }
    }

    if (body.refreshToken !== undefined) {
      const validation = validateRefreshToken(body.refreshToken);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TOKEN', message: validation.error } },
          { status: 400 }
        );
      }
    }

    await updateAccount(id, {
      name: body.name,
      token: body.token,
      tokenHint: body.token ? maskToken(body.token) : undefined,
      refreshToken: body.refreshToken,
      tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : undefined,
    });

    if (body.token) {
      try {
        await refreshAccountUsage(id);
      } catch {}
    }

    const updated = await getAccountWithUsage(id);

    const response: UpdateAccountResponse = {
      success: true,
      account: updated!,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await getAccountWithUsage(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } },
        { status: 404 }
      );
    }

    await deleteAccount(id);

    const response: DeleteAccountResponse = { success: true };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
