import { NextResponse } from 'next/server';
import { OAuthError } from '@/lib/anthropic';
import type { ErrorResponse, ErrorCode } from '@/types/account';

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('ENCRYPTION_KEY')) return 'Server encryption not configured';
    if (error.message.includes('SQLITE')) return 'Database error';
    return error.message;
  }
  return 'Internal server error';
}

export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  if (error instanceof OAuthError) {
    const code: ErrorCode =
      error.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';

    return NextResponse.json(
      { success: false as const, error: { code, message: error.message } },
      { status: 401 }
    );
  }

  const message = sanitizeErrorMessage(error);
  const isEncryptionError =
    error instanceof Error && error.message.includes('ENCRYPTION_KEY');

  return NextResponse.json(
    {
      success: false as const,
      error: {
        code: (isEncryptionError ? 'ENCRYPTION_ERROR' : 'NETWORK_ERROR') as ErrorCode,
        message,
      },
    },
    { status: 500 }
  );
}
