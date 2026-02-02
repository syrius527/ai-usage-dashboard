import { NextResponse } from 'next/server';
import { fetchUsage, parseUsageResponse, OAuthError } from '@/lib/anthropic';
import { checkRateLimit, getClientIp, VERIFY_LIMIT } from '@/lib/rate-limit';
import {
  validateOAuthToken,
  type VerifyTokenRequest,
  type VerifyTokenResponse,
} from '@/types/account';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`verify:${ip}`, VERIFY_LIMIT);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const body = (await request.json()) as VerifyTokenRequest;
    const { token } = body;

    const validation = validateOAuthToken(token);
    if (!validation.valid) {
      const response: VerifyTokenResponse = {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: validation.error!,
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const rawUsage = await fetchUsage(token);
    const parsed = parseUsageResponse(rawUsage);

    const response: VerifyTokenResponse = {
      success: true,
      usage: {
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
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof OAuthError) {
      const response: VerifyTokenResponse = {
        success: false,
        error: {
          code: error.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          message: error.message,
        },
      };
      return NextResponse.json(response, { status: 401 });
    }

    const response: VerifyTokenResponse = {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to verify token',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
