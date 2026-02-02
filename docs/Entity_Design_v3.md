# Entity Design Document v3

## Claude Usage Monitor - OAuth-based Usage Tracking

**Version**: 3.0  
**Date**: 2026-02-01  
**Author**: Engineering Team

---

## 1. Overview

v3에서는 Admin API 기반 데이터 모델에서 **OAuth 기반 사용량 추적**으로 전환합니다.
데이터 구조가 크게 단순화되며, 퍼센트 기반 사용량과 리셋 시간만 저장합니다.

### 1.1 Entity Categories

| Category | v2 | v3 |
|----------|----|----|
| **Persisted Entities** | Account (API Key) | Account (OAuth Token) + UsageCache |
| **External API Types** | Admin API Response | OAuth Usage Response |
| **View Entities** | Dashboard, Timeline, UserTable | UsageCard |

### 1.2 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Database Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   accounts                         usage_cache                   │
│   ┌──────────────────┐            ┌──────────────────┐          │
│   │ id (PK)          │───────────<│ account_id (FK)  │          │
│   │ name             │      1:1   │ five_hour_*      │          │
│   │ token_encrypted  │            │ seven_day_*      │          │
│   │ token_hint       │            │ seven_day_opus_* │          │
│   │ status           │            │ fetched_at       │          │
│   │ last_error       │            └──────────────────┘          │
│   │ last_sync_at     │                                          │
│   │ created_at       │                                          │
│   │ updated_at       │                                          │
│   └──────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ fetch & cache
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Anthropic OAuth API                           │
│                                                                  │
│   GET /api/oauth/usage                                          │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ {                                                         │  │
│   │   "five_hour": { "utilization": 40.0, "resets_at": ... }, │  │
│   │   "seven_day": { "utilization": 76.0, "resets_at": ... }, │  │
│   │   "seven_day_opus": { "utilization": 0.0, ... }           │  │
│   │ }                                                         │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Persisted Entities

### 2.1 Account

OAuth Token을 저장하는 계정 엔티티.

```typescript
// types/account.ts

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
```

### 2.2 UsageCache

계정별 사용량 캐시.

```typescript
// types/usage.ts

export interface UsageCache {
  id: string;
  accountId: string;
  
  fiveHourUtilization: number | null;
  fiveHourResetsAt: Date | null;
  
  sevenDayUtilization: number | null;
  sevenDayResetsAt: Date | null;
  
  sevenDayOpusUtilization: number | null;
  sevenDayOpusResetsAt: Date | null;
  
  fetchedAt: Date;
}
```

### 2.3 Drizzle Schema

```typescript
// lib/db/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tokenEncrypted: text('token_encrypted').notNull(),
  tokenHint: text('token_hint').notNull(),
  status: text('status', { enum: ['connected', 'error', 'expired'] })
    .notNull()
    .default('connected'),
  lastError: text('last_error'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const usageCache = sqliteTable('usage_cache', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  
  fiveHourUtilization: real('five_hour_utilization'),
  fiveHourResetsAt: integer('five_hour_resets_at', { mode: 'timestamp' }),
  
  sevenDayUtilization: real('seven_day_utilization'),
  sevenDayResetsAt: integer('seven_day_resets_at', { mode: 'timestamp' }),
  
  sevenDayOpusUtilization: real('seven_day_opus_utilization'),
  sevenDayOpusResetsAt: integer('seven_day_opus_resets_at', { mode: 'timestamp' }),
  
  fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
});

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type UsageCacheRow = typeof usageCache.$inferSelect;
export type NewUsageCacheRow = typeof usageCache.$inferInsert;
```

### 2.4 Field Specifications

#### accounts table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK, UUID v4 | 고유 식별자 |
| `name` | TEXT | NOT NULL | 사용자 지정 별칭 |
| `token_encrypted` | TEXT | NOT NULL | AES-256-GCM 암호화된 OAuth Token |
| `token_hint` | TEXT | NOT NULL | 마스킹된 토큰 (sk-ant-oat01-***...***xyz) |
| `status` | TEXT | NOT NULL, ENUM | 'connected' \| 'error' \| 'expired' |
| `last_error` | TEXT | NULLABLE | 마지막 에러 메시지 |
| `last_sync_at` | INTEGER | NULLABLE, TIMESTAMP | 마지막 성공적 동기화 |
| `created_at` | INTEGER | NOT NULL, TIMESTAMP | 생성 시간 |
| `updated_at` | INTEGER | NOT NULL, TIMESTAMP | 수정 시간 |

#### usage_cache table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK, UUID v4 | 고유 식별자 |
| `account_id` | TEXT | FK → accounts.id, CASCADE | 계정 참조 |
| `five_hour_utilization` | REAL | NULLABLE | 5시간 사용률 (0-100) |
| `five_hour_resets_at` | INTEGER | NULLABLE, TIMESTAMP | 5시간 리셋 시간 |
| `seven_day_utilization` | REAL | NULLABLE | 7일 사용률 (0-100) |
| `seven_day_resets_at` | INTEGER | NULLABLE, TIMESTAMP | 7일 리셋 시간 |
| `seven_day_opus_utilization` | REAL | NULLABLE | Opus 사용률 (0-100) |
| `seven_day_opus_resets_at` | INTEGER | NULLABLE, TIMESTAMP | Opus 리셋 시간 |
| `fetched_at` | INTEGER | NOT NULL, TIMESTAMP | 데이터 수집 시간 |

---

## 3. External API Types

### 3.1 Anthropic OAuth Usage Response

```typescript
// lib/anthropic/types.ts

export interface UsageLimit {
  utilization: number;  // 0-100 percentage
  resets_at: string | null;  // ISO 8601 datetime
}

export interface AnthropicUsageResponse {
  five_hour: UsageLimit | null;
  seven_day: UsageLimit | null;
  seven_day_oauth_apps: UsageLimit | null;
  seven_day_opus: UsageLimit | null;
  iguana_necktie: unknown;  // Unknown field, ignore
}
```

### 3.2 Parsed Usage

```typescript
// lib/anthropic/types.ts

export interface UsageLimitParsed {
  utilization: number;
  resetsAt: Date | null;
}

export interface ParsedUsage {
  fiveHour: UsageLimitParsed | null;
  sevenDay: UsageLimitParsed | null;
  sevenDayOpus: UsageLimitParsed | null;
}
```

---

## 4. API Response Types

### 4.1 Account with Usage

```typescript
// types/api.ts

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
  lastError: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  usage: UsageData | null;
}

export interface AccountListResponse {
  accounts: AccountWithUsage[];
}
```

### 4.2 Create/Update Account

```typescript
// types/api.ts

export interface CreateAccountRequest {
  name: string;
  token: string;
}

export interface CreateAccountResponse {
  success: true;
  account: AccountWithUsage;
}

export interface UpdateAccountRequest {
  name?: string;
  token?: string;
}

export interface UpdateAccountResponse {
  success: true;
  account: AccountWithUsage;
}

export interface DeleteAccountResponse {
  success: true;
}
```

### 4.3 Token Verification

```typescript
// types/api.ts

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
```

### 4.4 Refresh Usage

```typescript
// types/api.ts

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
```

### 4.5 Error Response

```typescript
// types/api.ts

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
```

---

## 5. View Entities

### 5.1 UsageCardView

대시보드 카드 표시용 데이터.

```typescript
// types/view.ts

export interface UsageLimitView {
  utilization: number;
  resetsAt: Date | null;
  resetsIn: string;  // "2h 30m", "5 days"
  status: 'normal' | 'warning' | 'critical';  // <80%, 80-95%, >95%
}

export interface UsageCardView {
  id: string;
  name: string;
  status: AccountStatus;
  statusLabel: string;
  statusColor: 'green' | 'red' | 'yellow';
  lastError: string | null;
  lastSyncFormatted: string | null;
  
  fiveHour: UsageLimitView | null;
  sevenDay: UsageLimitView | null;
  sevenDayOpus: UsageLimitView | null;
  
  fetchedAt: Date | null;
  fetchedAgo: string | null;  // "2 mins ago"
}
```

### 5.2 DashboardView

대시보드 전체 상태.

```typescript
// types/view.ts

export interface DashboardView {
  accounts: UsageCardView[];
  lastUpdated: Date | null;
  lastUpdatedFormatted: string | null;
  isRefreshing: boolean;
  hasAccounts: boolean;
  connectedCount: number;
  errorCount: number;
}
```

---

## 6. Data Transformation

### 6.1 API Response → UsageCache

```typescript
// lib/anthropic/transform.ts

import { AnthropicUsageResponse, ParsedUsage } from './types';

export function parseUsageResponse(response: AnthropicUsageResponse): ParsedUsage {
  return {
    fiveHour: response.five_hour ? {
      utilization: response.five_hour.utilization,
      resetsAt: response.five_hour.resets_at 
        ? new Date(response.five_hour.resets_at) 
        : null,
    } : null,
    sevenDay: response.seven_day ? {
      utilization: response.seven_day.utilization,
      resetsAt: response.seven_day.resets_at 
        ? new Date(response.seven_day.resets_at) 
        : null,
    } : null,
    sevenDayOpus: response.seven_day_opus ? {
      utilization: response.seven_day_opus.utilization,
      resetsAt: response.seven_day_opus.resets_at 
        ? new Date(response.seven_day_opus.resets_at) 
        : null,
    } : null,
  };
}
```

### 6.2 Account + UsageCache → AccountWithUsage

```typescript
// lib/db/transform.ts

import { AccountRow, UsageCacheRow } from './schema';
import { AccountWithUsage } from '@/types/api';

export function toAccountWithUsage(
  account: AccountRow,
  usage: UsageCacheRow | null
): AccountWithUsage {
  return {
    id: account.id,
    name: account.name,
    tokenHint: account.tokenHint,
    status: account.status,
    lastError: account.lastError,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    usage: usage ? {
      fiveHour: usage.fiveHourUtilization !== null ? {
        utilization: usage.fiveHourUtilization,
        resetsAt: usage.fiveHourResetsAt?.toISOString() ?? null,
      } : null,
      sevenDay: usage.sevenDayUtilization !== null ? {
        utilization: usage.sevenDayUtilization,
        resetsAt: usage.sevenDayResetsAt?.toISOString() ?? null,
      } : null,
      sevenDayOpus: usage.sevenDayOpusUtilization !== null ? {
        utilization: usage.sevenDayOpusUtilization,
        resetsAt: usage.sevenDayOpusResetsAt?.toISOString() ?? null,
      } : null,
      fetchedAt: usage.fetchedAt.toISOString(),
    } : null,
  };
}
```

### 6.3 AccountWithUsage → UsageCardView

```typescript
// lib/view/transform.ts

import { AccountWithUsage } from '@/types/api';
import { UsageCardView, UsageLimitView } from '@/types/view';

function getUtilizationStatus(util: number): 'normal' | 'warning' | 'critical' {
  if (util >= 95) return 'critical';
  if (util >= 80) return 'warning';
  return 'normal';
}

function formatResetsIn(resetsAt: string | null): string {
  if (!resetsAt) return 'No reset';
  
  const date = new Date(resetsAt);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff < 0) return 'Reset pending';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  
  return `${hours}h ${minutes}m`;
}

function toUsageLimitView(
  data: { utilization: number; resetsAt: string | null } | null
): UsageLimitView | null {
  if (!data) return null;
  
  return {
    utilization: data.utilization,
    resetsAt: data.resetsAt ? new Date(data.resetsAt) : null,
    resetsIn: formatResetsIn(data.resetsAt),
    status: getUtilizationStatus(data.utilization),
  };
}

export function toUsageCardView(account: AccountWithUsage): UsageCardView {
  const statusConfig = {
    connected: { label: 'Connected', color: 'green' as const },
    error: { label: 'Error', color: 'red' as const },
    expired: { label: 'Expired', color: 'yellow' as const },
  };

  const status = statusConfig[account.status];

  return {
    id: account.id,
    name: account.name,
    status: account.status,
    statusLabel: status.label,
    statusColor: status.color,
    lastError: account.lastError,
    lastSyncFormatted: account.lastSyncAt 
      ? formatRelativeTime(new Date(account.lastSyncAt))
      : null,
    
    fiveHour: toUsageLimitView(account.usage?.fiveHour ?? null),
    sevenDay: toUsageLimitView(account.usage?.sevenDay ?? null),
    sevenDayOpus: toUsageLimitView(account.usage?.sevenDayOpus ?? null),
    
    fetchedAt: account.usage?.fetchedAt 
      ? new Date(account.usage.fetchedAt)
      : null,
    fetchedAgo: account.usage?.fetchedAt
      ? formatRelativeTime(new Date(account.usage.fetchedAt))
      : null,
  };
}
```

---

## 7. Token Validation

```typescript
// lib/validation.ts

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateOAuthToken(token: string): ValidationResult {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: 'Token is required' };
  }

  const trimmed = token.trim();

  if (!trimmed.startsWith('sk-ant-oat')) {
    return { 
      valid: false, 
      error: 'Invalid token format. OAuth tokens start with sk-ant-oat...' 
    };
  }

  if (trimmed.length < 50) {
    return { valid: false, error: 'Token appears to be incomplete' };
  }

  return { valid: true };
}

export function validateAccountName(name: string): ValidationResult {
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
  const prefix = token.slice(0, 14);  // "sk-ant-oat01-" or similar
  const suffix = token.slice(-4);
  return `${prefix}***...***${suffix}`;
}
```

---

## 8. Type Index

```typescript
// types/index.ts

// Account
export type {
  Account,
  NewAccount,
  UpdateAccount,
  AccountStatus,
} from './account';

// Usage
export type {
  UsageCache,
} from './usage';

// API
export type {
  AccountWithUsage,
  AccountListResponse,
  CreateAccountRequest,
  CreateAccountResponse,
  UpdateAccountRequest,
  UpdateAccountResponse,
  DeleteAccountResponse,
  VerifyTokenRequest,
  VerifyTokenResponse,
  RefreshResponse,
  RefreshAllResponse,
  UsageData,
  ErrorCode,
  ErrorResponse,
} from './api';

// View
export type {
  UsageLimitView,
  UsageCardView,
  DashboardView,
} from './view';

// Anthropic
export type {
  UsageLimit,
  AnthropicUsageResponse,
  ParsedUsage,
} from '@/lib/anthropic/types';
```

---

## 9. Migration from v2

### 9.1 Schema Changes

```sql
-- Backup and drop v2 tables
ALTER TABLE accounts RENAME TO accounts_v2_backup;

-- Create v3 accounts table
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_encrypted TEXT NOT NULL,
  token_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  last_error TEXT,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create usage_cache table
CREATE TABLE usage_cache (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  five_hour_utilization REAL,
  five_hour_resets_at INTEGER,
  seven_day_utilization REAL,
  seven_day_resets_at INTEGER,
  seven_day_opus_utilization REAL,
  seven_day_opus_resets_at INTEGER,
  fetched_at INTEGER NOT NULL
);

CREATE INDEX idx_usage_cache_account ON usage_cache(account_id);
```

### 9.2 Data Migration

v2의 Admin API Key 기반 계정은 v3의 OAuth Token과 호환되지 않습니다.
사용자가 새로운 OAuth Token으로 계정을 다시 등록해야 합니다.

```typescript
// lib/db/migrate-v3.ts

export async function migrateToV3(): Promise<void> {
  // 1. Create new tables
  await createV3Tables();
  
  // 2. v2 data cannot be migrated (different auth method)
  // User must re-register accounts with OAuth tokens
  
  // 3. Drop v2 tables (optional, after user confirmation)
  // await dropV2Tables();
}
```
