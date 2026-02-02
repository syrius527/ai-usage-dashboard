# Software Design Document (SDD) v3

## Claude Usage Monitor - OAuth-based Usage Tracking

**Version**: 3.0  
**Date**: 2026-02-01  
**Author**: Engineering Team

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Next.js Frontend                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │  Login Page │  │  Dashboard  │  │  Settings   │        │  │
│  │  │  (/)        │  │ (/dashboard)│  │ (/settings) │        │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │
│  │                          │                                  │  │
│  │                    UsageCards                               │  │
│  │                    (auto-refresh)                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /api/auth    │  │ /api/accounts│  │ /api/usage   │          │
│  │ - login      │  │ - CRUD       │  │ - refresh    │          │
│  │ - logout     │  │ - verify     │  │ - refresh-all│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│   SQLite DB      │ │  Encryption  │ │   Anthropic OAuth API    │
│  ┌────────────┐  │ │    Layer     │ │                          │
│  │  accounts  │  │ │              │ │  GET /api/oauth/usage    │
│  │  usage     │  │ │  AES-256-GCM │ │  Authorization: Bearer   │
│  └────────────┘  │ │              │ │                          │
└──────────────────┘ └──────────────┘ └──────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 14 (App Router) | 유지 |
| **Language** | TypeScript | 유지 |
| **Styling** | Tailwind CSS | 유지 |
| **UI Components** | shadcn/ui | 유지 |
| **Database** | SQLite + Drizzle ORM | 유지 |
| **Encryption** | Node.js crypto (AES-256-GCM) | 유지 |
| **HTTP Client** | Native fetch | Anthropic API 호출 |

### 1.3 Key Changes from v2

| Component | v2 | v3 |
|-----------|----|----|
| Auth Type | Admin API Key | OAuth Token |
| API Endpoint | Admin API | `/api/oauth/usage` |
| Data Model | tokens, costs, users | utilization %, reset times |
| Providers | Claude + OpenAI | Claude only |
| Dashboard | Tabs + Charts + Tables | Usage Cards Grid |

---

## 2. Project Structure

```
claude-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Login
│   ├── globals.css
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   └── page.tsx                # Usage Cards Grid (v3 NEW)
│   ├── settings/
│   │   ├── layout.tsx
│   │   └── page.tsx                # Account Management
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── verify/route.ts
│       ├── accounts/
│       │   ├── route.ts            # GET (list+usage), POST (create)
│       │   ├── [id]/route.ts       # PUT, DELETE
│       │   ├── [id]/refresh/route.ts  # POST (refresh single)
│       │   └── verify/route.ts     # POST (verify token)
│       └── usage/
│           └── refresh-all/route.ts   # POST (refresh all accounts)
├── components/
│   ├── ui/
│   ├── dashboard/
│   │   ├── UsageCard.tsx           # v3 NEW
│   │   ├── UsageCardGrid.tsx       # v3 NEW
│   │   ├── UsageProgress.tsx       # v3 NEW
│   │   └── Header.tsx              # Modified
│   ├── auth/
│   └── settings/
│       ├── AccountList.tsx         # Modified
│       ├── AccountCard.tsx         # Modified
│       └── AddAccountModal.tsx     # Modified (OAuth token input)
├── lib/
│   ├── anthropic/                  # v3 NEW
│   │   ├── oauth.ts                # OAuth usage API client
│   │   └── types.ts                # API response types
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts               # Modified
│   │   └── accounts.ts             # Modified
│   ├── crypto.ts
│   ├── auth.ts
│   ├── config.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useAccounts.ts              # Modified
│   └── useUsage.ts                 # v3 NEW (replaces useUsageData)
├── types/
│   ├── index.ts
│   └── account.ts                  # Modified
├── data/
│   └── dashboard.db
└── ...
```

---

## 3. Database Design

### 3.1 Schema (Drizzle)

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
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  
  fiveHourUtilization: real('five_hour_utilization'),
  fiveHourResetsAt: integer('five_hour_resets_at', { mode: 'timestamp' }),
  
  sevenDayUtilization: real('seven_day_utilization'),
  sevenDayResetsAt: integer('seven_day_resets_at', { mode: 'timestamp' }),
  
  sevenDayOpusUtilization: real('seven_day_opus_utilization'),
  sevenDayOpusResetsAt: integer('seven_day_opus_resets_at', { mode: 'timestamp' }),
  
  fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
});

export type AccountRow = typeof accounts.$inferSelect;
export type UsageCacheRow = typeof usageCache.$inferSelect;
```

### 3.2 Schema Migration (v2 → v3)

```sql
-- Drop v2 tables
DROP TABLE IF EXISTS accounts;

-- Create v3 accounts table
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_encrypted TEXT NOT NULL,
  token_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK(status IN ('connected', 'error', 'expired')),
  last_error TEXT,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create usage cache table
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

---

## 4. Anthropic OAuth API Client

### 4.1 API Module

```typescript
// lib/anthropic/oauth.ts

import { AnthropicUsageResponse } from './types';

const ANTHROPIC_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const ANTHROPIC_BETA = 'oauth-2025-04-20';
const USER_AGENT = 'claude-usage-monitor/1.0';

export async function fetchUsage(oauthToken: string): Promise<AnthropicUsageResponse> {
  const response = await fetch(ANTHROPIC_USAGE_URL, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${oauthToken}`,
      'anthropic-beta': ANTHROPIC_BETA,
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new OAuthError('TOKEN_EXPIRED', 'OAuth token has expired');
    }
    if (response.status === 403) {
      throw new OAuthError('TOKEN_INVALID', 'OAuth token is invalid');
    }
    throw new OAuthError('API_ERROR', `API returned ${response.status}`);
  }

  return response.json();
}

export class OAuthError extends Error {
  constructor(
    public code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'API_ERROR' | 'NETWORK_ERROR',
    message: string
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}
```

### 4.2 Type Definitions

```typescript
// lib/anthropic/types.ts

export interface UsageLimit {
  utilization: number;  // 0-100
  resets_at: string | null;  // ISO 8601 datetime
}

export interface AnthropicUsageResponse {
  five_hour: UsageLimit | null;
  seven_day: UsageLimit | null;
  seven_day_oauth_apps: UsageLimit | null;
  seven_day_opus: UsageLimit | null;
  iguana_necktie: unknown;  // Unknown field, ignore
}

export interface ParsedUsage {
  fiveHour: {
    utilization: number;
    resetsAt: Date | null;
  } | null;
  sevenDay: {
    utilization: number;
    resetsAt: Date | null;
  } | null;
  sevenDayOpus: {
    utilization: number;
    resetsAt: Date | null;
  } | null;
}

export function parseUsageResponse(response: AnthropicUsageResponse): ParsedUsage {
  return {
    fiveHour: response.five_hour ? {
      utilization: response.five_hour.utilization,
      resetsAt: response.five_hour.resets_at ? new Date(response.five_hour.resets_at) : null,
    } : null,
    sevenDay: response.seven_day ? {
      utilization: response.seven_day.utilization,
      resetsAt: response.seven_day.resets_at ? new Date(response.seven_day.resets_at) : null,
    } : null,
    sevenDayOpus: response.seven_day_opus ? {
      utilization: response.seven_day_opus.utilization,
      resetsAt: response.seven_day_opus.resets_at ? new Date(response.seven_day_opus.resets_at) : null,
    } : null,
  };
}
```

---

## 5. API Design

### 5.1 Account Endpoints

#### GET /api/accounts

```typescript
interface AccountWithUsage {
  id: string;
  name: string;
  tokenHint: string;
  status: 'connected' | 'error' | 'expired';
  lastError: string | null;
  lastSyncAt: string | null;
  usage: {
    fiveHour: { utilization: number; resetsAt: string | null } | null;
    sevenDay: { utilization: number; resetsAt: string | null } | null;
    sevenDayOpus: { utilization: number; resetsAt: string | null } | null;
    fetchedAt: string;
  } | null;
}

interface AccountListResponse {
  accounts: AccountWithUsage[];
}
```

#### POST /api/accounts

```typescript
interface CreateAccountRequest {
  name: string;
  token: string;
}

interface CreateAccountResponse {
  success: true;
  account: AccountWithUsage;
}
```

#### POST /api/accounts/verify

```typescript
interface VerifyTokenRequest {
  token: string;
}

interface VerifyTokenResponse {
  success: true;
  usage: {
    fiveHour: { utilization: number; resetsAt: string | null } | null;
    sevenDay: { utilization: number; resetsAt: string | null } | null;
  };
}
```

#### POST /api/accounts/:id/refresh

```typescript
interface RefreshResponse {
  success: true;
  usage: { ... };
}
```

### 5.2 Usage Endpoints

#### POST /api/usage/refresh-all

```typescript
interface RefreshAllResponse {
  success: true;
  results: Array<{
    accountId: string;
    success: boolean;
    error?: string;
  }>;
}
```

---

## 6. Component Design

### 6.1 Dashboard Component Hierarchy

```
DashboardPage (page.tsx)
├── Header
│   ├── Title
│   ├── LastUpdated
│   ├── RefreshButton
│   └── SettingsLink
└── UsageCardGrid
    └── UsageCard (multiple)
        ├── AccountHeader
        │   ├── Name
        │   └── StatusBadge
        ├── UsageProgress (5-hour)
        │   ├── ProgressBar
        │   ├── Percentage
        │   └── ResetTime
        ├── UsageProgress (7-day)
        └── UsageProgress (7-day Opus, optional)
```

### 6.2 UsageCard Component

```typescript
// components/dashboard/UsageCard.tsx

interface UsageCardProps {
  account: {
    id: string;
    name: string;
    status: 'connected' | 'error' | 'expired';
    lastError: string | null;
  };
  usage: {
    fiveHour: { utilization: number; resetsAt: Date | null } | null;
    sevenDay: { utilization: number; resetsAt: Date | null } | null;
    sevenDayOpus: { utilization: number; resetsAt: Date | null } | null;
    fetchedAt: Date;
  } | null;
  onRefresh: () => void;
  refreshing: boolean;
}
```

### 6.3 UsageProgress Component

```typescript
// components/dashboard/UsageProgress.tsx

interface UsageProgressProps {
  label: string;
  utilization: number;  // 0-100
  resetsAt: Date | null;
  variant?: 'default' | 'opus';
}

function getProgressColor(utilization: number): string {
  if (utilization >= 95) return 'bg-red-500';
  if (utilization >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

function formatResetTime(resetsAt: Date | null): string {
  if (!resetsAt) return 'No reset scheduled';
  
  const now = new Date();
  const diff = resetsAt.getTime() - now.getTime();
  
  if (diff < 0) return 'Reset pending';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Resets in ${days} day${days > 1 ? 's' : ''}`;
  }
  
  return `Resets in ${hours}h ${minutes}m`;
}
```

---

## 7. Data Flow

### 7.1 Usage Refresh Flow

```
User clicks "Refresh" or Auto-refresh timer
                │
                ▼
┌───────────────────────────┐
│  POST /api/usage/         │
│       refresh-all         │
└───────────────────────────┘
                │
                ▼
┌───────────────────────────┐
│  For each account:        │
│  1. Load from DB          │
│  2. Decrypt token         │
│  3. Call Anthropic API    │
│  4. Update usage_cache    │
│  5. Update account status │
└───────────────────────────┘
                │
                ▼
┌───────────────────────────┐
│  Return aggregated        │
│  results to client        │
└───────────────────────────┘
                │
                ▼
┌───────────────────────────┐
│  Client updates UI        │
│  with new usage data      │
└───────────────────────────┘
```

### 7.2 Add Account Flow

```
User enters OAuth token
        │
        ▼
┌───────────────────────────┐
│  POST /api/accounts/verify│
│  - Call Anthropic API     │
│  - Return usage preview   │
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│  Show verification result │
│  - Success: Show usage %  │
│  - Error: Show message    │
└───────────────────────────┘
        │
User clicks "Save"
        │
        ▼
┌───────────────────────────┐
│  POST /api/accounts       │
│  - Encrypt token          │
│  - Save to DB             │
│  - Fetch initial usage    │
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│  Redirect to dashboard    │
│  with new account visible │
└───────────────────────────┘
```

---

## 8. Auto-Refresh Mechanism

### 8.1 Client-Side Polling

```typescript
// hooks/useUsage.ts

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useUsage() {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAccounts = useCallback(async () => {
    const response = await fetch('/api/accounts');
    const data = await response.json();
    setAccounts(data.accounts);
    setLastUpdated(new Date());
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetch('/api/usage/refresh-all', { method: 'POST' });
    await fetchAccounts();
    setLoading(false);
  }, [fetchAccounts]);

  // Initial fetch
  useEffect(() => {
    fetchAccounts().then(() => setLoading(false));
  }, [fetchAccounts]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(refreshAll, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshAll]);

  return { accounts, loading, lastUpdated, refreshAll };
}
```

---

## 9. Error Handling

### 9.1 OAuth Token Errors

| Error | Status | Handling |
|-------|--------|----------|
| Token expired | `expired` | Show "Token expired" badge, prompt re-auth |
| Token invalid | `error` | Show error message |
| Rate limited | `error` | Retry after delay |
| Network error | `error` | Show connection error |

### 9.2 Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'NOT_FOUND' | 'NETWORK_ERROR';
    message: string;
  };
}
```

---

## 10. Security

### 10.1 Token Protection

| Layer | Protection |
|-------|------------|
| Transport | HTTPS only |
| Storage | AES-256-GCM encryption |
| Memory | Token decrypted only during API call |
| Response | Never return full token |
| Logs | Token redaction |

### 10.2 Token Validation

```typescript
function validateOAuthToken(token: string): { valid: boolean; error?: string } {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: 'Token is required' };
  }

  if (!token.startsWith('sk-ant-oat')) {
    return { valid: false, error: 'Invalid token format. Expected sk-ant-oat...' };
  }

  if (token.length < 50) {
    return { valid: false, error: 'Token appears to be incomplete' };
  }

  return { valid: true };
}
```

---

## Appendix

### A. Token Hint Generation

```typescript
function maskToken(token: string): string {
  if (token.length < 20) return '***';
  const prefix = token.slice(0, 14);  // "sk-ant-oat01-"
  const suffix = token.slice(-4);
  return `${prefix}***...***${suffix}`;
}

// Example: "sk-ant-oat01-***...***xyz1"
```

### B. Relative Time Formatting

```typescript
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  const seconds = Math.abs(diff) / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  
  const isFuture = diff > 0;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';
  
  if (days >= 1) {
    const d = Math.floor(days);
    return `${prefix}${d} day${d > 1 ? 's' : ''}${suffix}`;
  }
  if (hours >= 1) {
    const h = Math.floor(hours);
    const m = Math.floor(minutes % 60);
    return `${prefix}${h}h ${m}m${suffix}`;
  }
  if (minutes >= 1) {
    const m = Math.floor(minutes);
    return `${prefix}${m} min${m > 1 ? 's' : ''}${suffix}`;
  }
  return 'just now';
}
```
