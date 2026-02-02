import { NextResponse } from 'next/server';
import { getAccountWithUsage, refreshAccountUsage } from '@/lib/db/accounts';
import type { RefreshResponse, ErrorResponse } from '@/types/account';
import { handleApiError } from '@/lib/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await getAccountWithUsage(id);
    if (!existing) {
      const response: ErrorResponse = {
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const usage = await refreshAccountUsage(id);

    const response: RefreshResponse = {
      success: true,
      usage,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
