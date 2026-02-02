# Entity Design Document v2

## Multi-AI Usage Dashboard - Account Management

**Version**: 2.0  
**Date**: 2026-01-31  
**Author**: Engineering Team

---

## 1. Overview

v2에서는 **SQLite 데이터베이스**를 도입하여 계정 정보를 영구 저장합니다.
v1의 인터페이스 기반 엔티티는 그대로 유지하면서, 새로운 **Persisted Entity**가 추가됩니다.

### 1.1 Entity Categories (Updated)

| Category | Description | v1 | v2 |
|----------|-------------|----|----|
| **Persisted Entities** | DB에 저장되는 엔티티 | - | Account |
| **Domain Entities** | 비즈니스 도메인 모델 | Provider, User, Usage | 유지 |
| **API Entities** | 외부 API 응답 타입 | Anthropic, OpenAI | 유지 |
| **View Entities** | UI 컴포넌트용 데이터 | Dashboard, Timeline, UserTable | + Settings |

### 1.2 Entity Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      Persisted Layer (NEW)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Account ─────────────────────────────────────────────────────► │
│    │                                                             │
│    │  apiKeyEncrypted ◄──► Encryption Module                    │
│    │                                                             │
└────┼────────────────────────────────────────────────────────────┘
     │
     │ decrypted API Key (runtime only)
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Domain Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Provider ──────────────< UsageRecord                           │
│     │                         │                                  │
│     └──────< User >──────────┘                                  │
│                │                                                 │
│                └────────> UserUsageStats                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Transform
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         View Layer                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AccountListView (NEW)                                          │
│     │                                                            │
│     └──────> AccountCardView (NEW)                              │
│                                                                  │
│  AllProvidersData                                               │
│     │                                                            │
│     └──────> ProviderTabData                                    │
│                 │                                                │
│                 ├──> DashboardSummary                           │
│                 ├──> TimelineData                               │
│                 └──> UserTableData                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Persisted Entities (NEW)

### 2.1 Account

DB에 저장되는 AI 서비스 계정 엔티티.

```typescript
// types/account.ts

type ProviderType = 'claude' | 'openai';

type AccountStatus = 'connected' | 'error' | 'unknown';

interface Account {
  id: string;
  provider: ProviderType;
  name: string;
  apiKeyEncrypted: string;
  apiKeyHint: string;
  status: AccountStatus;
  lastError: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NewAccount {
  provider: ProviderType;
  name: string;
  apiKey: string;
}

interface UpdateAccount {
  name?: string;
  apiKey?: string;
}
```

### 2.2 Drizzle Schema

```typescript
// lib/db/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['claude', 'openai'] }).notNull(),
  name: text('name').notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  apiKeyHint: text('api_key_hint').notNull(),
  status: text('status', { enum: ['connected', 'error', 'unknown'] })
    .notNull()
    .default('unknown'),
  lastError: text('last_error'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
```

### 2.3 Field Specifications

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PK, UUID v4 | 고유 식별자 |
| `provider` | TEXT | NOT NULL, ENUM | 'claude' \| 'openai' |
| `name` | TEXT | NOT NULL | 사용자 지정 계정 별칭 |
| `api_key_encrypted` | TEXT | NOT NULL | AES-256-GCM 암호화된 API Key |
| `api_key_hint` | TEXT | NOT NULL | 마스킹된 키 (예: `sk-ant-admin-***...***xyz`) |
| `status` | TEXT | NOT NULL, DEFAULT 'unknown' | 연결 상태 |
| `last_error` | TEXT | NULLABLE | 마지막 에러 메시지 |
| `last_sync_at` | INTEGER | NULLABLE, TIMESTAMP | 마지막 성공적인 데이터 동기화 시간 |
| `created_at` | INTEGER | NOT NULL, TIMESTAMP | 계정 생성 시간 |
| `updated_at` | INTEGER | NOT NULL, TIMESTAMP | 계정 수정 시간 |

---

## 3. Encrypted Field Handling

### 3.1 Encryption Types

```typescript
// types/crypto.ts

interface EncryptedValue {
  iv: string;
  tag: string;
  ciphertext: string;
}

type EncryptedString = `${string}:${string}:${string}`;

interface DecryptionResult {
  success: true;
  value: string;
} | {
  success: false;
  error: string;
}
```

### 3.2 API Key Masking

```typescript
// types/crypto.ts

interface MaskedApiKey {
  prefix: string;
  suffix: string;
  full: string;
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) return '***';
  const prefix = apiKey.slice(0, 10);
  const suffix = apiKey.slice(-4);
  return `${prefix}***...***${suffix}`;
}
```

### 3.3 Encryption Flow

```
┌──────────────────┐
│   Plain API Key  │
│  (user input)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Validate       │
│   Format Check   │
└────────┬─────────┘
         │
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│   encrypt()      │          │   maskApiKey()   │
│   AES-256-GCM    │          │   Hint for UI    │
└────────┬─────────┘          └────────┬─────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│ apiKeyEncrypted  │          │   apiKeyHint     │
│ (stored in DB)   │          │  (stored in DB)  │
└──────────────────┘          └──────────────────┘
```

---

## 4. API Response Types (NEW)

### 4.1 Account API Responses

```typescript
// types/api/accounts.ts

interface AccountResponse {
  id: string;
  provider: ProviderType;
  name: string;
  apiKeyHint: string;
  status: AccountStatus;
  lastError: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountListResponse {
  accounts: AccountResponse[];
}

interface CreateAccountRequest {
  provider: ProviderType;
  name: string;
  apiKey: string;
}

interface CreateAccountResponse {
  success: true;
  account: AccountResponse;
}

interface UpdateAccountRequest {
  name?: string;
  apiKey?: string;
}

interface UpdateAccountResponse {
  success: true;
  account: AccountResponse;
}

interface DeleteAccountResponse {
  success: true;
}
```

### 4.2 Connection Test Types

```typescript
// types/api/accounts.ts

interface TestConnectionRequest {
  provider: ProviderType;
  apiKey: string;
}

interface TestConnectionSuccess {
  success: true;
  organization?: string;
  permissions?: string[];
}

interface TestConnectionError {
  success: false;
  error: {
    code: 'INVALID_KEY' | 'AUTH_FAILED' | 'INSUFFICIENT_PERMISSIONS' | 'NETWORK_ERROR';
    message: string;
  };
}

type TestConnectionResponse = TestConnectionSuccess | TestConnectionError;

interface TestExistingAccountResponse {
  success: true;
  status: AccountStatus;
  error?: string;
}
```

### 4.3 Error Response Types

```typescript
// types/api/accounts.ts

type AccountErrorCode =
  | 'INVALID_API_KEY_FORMAT'
  | 'DUPLICATE_ACCOUNT'
  | 'ACCOUNT_NOT_FOUND'
  | 'ENCRYPTION_ERROR'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR';

interface AccountErrorResponse {
  success: false;
  error: {
    code: AccountErrorCode;
    message: string;
    details?: unknown;
  };
}
```

---

## 5. View Entities (NEW for Settings)

### 5.1 AccountListView

Settings 페이지의 계정 목록 데이터.

```typescript
// types/view/settings.ts

interface AccountListView {
  grouped: Record<ProviderType, AccountCardView[]>;
  total: number;
  connectedCount: number;
  errorCount: number;
}
```

### 5.2 AccountCardView

단일 계정 카드 표시용 데이터.

```typescript
// types/view/settings.ts

interface AccountCardView {
  id: string;
  provider: ProviderType;
  providerName: string;
  providerIcon: string;
  name: string;
  apiKeyHint: string;
  status: AccountStatus;
  statusLabel: string;
  statusColor: 'green' | 'red' | 'gray';
  lastError: string | null;
  lastSyncFormatted: string | null;
  createdAtFormatted: string;
}
```

### 5.3 AddAccountFormState

계정 추가 모달의 폼 상태.

```typescript
// types/view/settings.ts

interface AddAccountFormState {
  provider: ProviderType;
  name: string;
  apiKey: string;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testError: string | null;
  testOrganization: string | null;
  saving: boolean;
  saveError: string | null;
}

interface EditAccountFormState {
  name: string;
  apiKey: string;
  hasApiKeyChange: boolean;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testError: string | null;
  saving: boolean;
  saveError: string | null;
}
```

### 5.4 AccountSelectorView

대시보드의 계정 선택 드롭다운용 데이터.

```typescript
// types/view/dashboard.ts

interface AccountSelectorOption {
  id: string;
  label: string;
  provider: ProviderType;
  providerIcon: string;
  status: AccountStatus;
}

interface AccountSelectorView {
  options: AccountSelectorOption[];
  selectedId: string | null;
  combinedOption: {
    id: 'all';
    label: 'All Accounts';
  } | null;
}
```

---

## 6. Modified Domain Entities

### 6.1 ProviderTabData (Modified)

계정 ID가 추가됨.

```typescript
// types/view/provider-tab.ts (MODIFIED)

interface ProviderTabData {
  provider: ProviderType;
  accountId: string;
  accountName: string;
  
  summary: DashboardSummary;
  timeline: TimelineData;
  users: UserTableData;
  
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
```

### 6.2 AllProvidersData (Modified)

다중 계정 지원.

```typescript
// types/view/provider-tab.ts (MODIFIED)

interface AllProvidersData {
  selectedAccountId: string | null;
  accounts: AccountSelectorOption[];
  
  currentData: ProviderTabData | null;
  
  combinedData?: {
    totalCost: {
      amount: number;
      formatted: string;
      breakdown: Array<{
        accountId: string;
        accountName: string;
        provider: ProviderType;
        amount: number;
        formatted: string;
        percentage: number;
      }>;
    };
  };
}
```

---

## 7. Data Transformation

### 7.1 Account → AccountCardView

```typescript
// lib/transformers/account.ts

function toAccountCardView(account: Account): AccountCardView {
  const providerMeta = PROVIDERS[account.provider];
  
  return {
    id: account.id,
    provider: account.provider,
    providerName: providerMeta.name,
    providerIcon: providerMeta.icon,
    name: account.name,
    apiKeyHint: account.apiKeyHint,
    status: account.status,
    statusLabel: getStatusLabel(account.status),
    statusColor: getStatusColor(account.status),
    lastError: account.lastError,
    lastSyncFormatted: account.lastSyncAt 
      ? formatRelativeTime(account.lastSyncAt) 
      : null,
    createdAtFormatted: formatDate(account.createdAt),
  };
}

function getStatusLabel(status: AccountStatus): string {
  switch (status) {
    case 'connected': return 'Connected';
    case 'error': return 'Error';
    case 'unknown': return 'Not tested';
  }
}

function getStatusColor(status: AccountStatus): 'green' | 'red' | 'gray' {
  switch (status) {
    case 'connected': return 'green';
    case 'error': return 'red';
    case 'unknown': return 'gray';
  }
}
```

### 7.2 Accounts → AccountListView

```typescript
// lib/transformers/account.ts

function toAccountListView(accounts: Account[]): AccountListView {
  const grouped: Record<ProviderType, AccountCardView[]> = {
    claude: [],
    openai: [],
  };
  
  let connectedCount = 0;
  let errorCount = 0;
  
  for (const account of accounts) {
    const cardView = toAccountCardView(account);
    grouped[account.provider].push(cardView);
    
    if (account.status === 'connected') connectedCount++;
    if (account.status === 'error') errorCount++;
  }
  
  return {
    grouped,
    total: accounts.length,
    connectedCount,
    errorCount,
  };
}
```

### 7.3 Accounts → AccountSelectorView

```typescript
// lib/transformers/account.ts

function toAccountSelectorView(
  accounts: Account[],
  selectedId: string | null
): AccountSelectorView {
  const options: AccountSelectorOption[] = accounts
    .filter(a => a.status !== 'error')
    .map(account => ({
      id: account.id,
      label: `${account.name} (${PROVIDERS[account.provider].name})`,
      provider: account.provider,
      providerIcon: PROVIDERS[account.provider].icon,
      status: account.status,
    }));
  
  const hasCombined = options.length > 1;
  
  return {
    options,
    selectedId: selectedId ?? options[0]?.id ?? null,
    combinedOption: hasCombined 
      ? { id: 'all', label: 'All Accounts' } 
      : null,
  };
}
```

---

## 8. Validation Rules

### 8.1 API Key Validation

```typescript
// lib/validators/account.ts

const API_KEY_PATTERNS: Record<ProviderType, RegExp> = {
  claude: /^sk-ant-admin-[a-zA-Z0-9_-]+$/,
  openai: /^sk-admin-[a-zA-Z0-9]+$/,
};

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateApiKey(provider: ProviderType, apiKey: string): ValidationResult {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API Key is required' };
  }
  
  const pattern = API_KEY_PATTERNS[provider];
  if (!pattern.test(apiKey)) {
    return { 
      valid: false, 
      error: `Invalid ${provider === 'claude' ? 'Anthropic' : 'OpenAI'} Admin API Key format` 
    };
  }
  
  return { valid: true };
}

function validateAccountName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Account name is required' };
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Account name must be 100 characters or less' };
  }
  
  return { valid: true };
}
```

---

## 9. Entity Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Database Layer                              │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                        accounts                              │   │
│   ├─────────────────────────────────────────────────────────────┤   │
│   │ id (PK)          │ TEXT    │ UUID v4                        │   │
│   │ provider         │ TEXT    │ 'claude' | 'openai'            │   │
│   │ name             │ TEXT    │ User-defined label             │   │
│   │ api_key_encrypted│ TEXT    │ AES-256-GCM encrypted          │   │
│   │ api_key_hint     │ TEXT    │ Masked for display             │   │
│   │ status           │ TEXT    │ Connection status              │   │
│   │ last_error       │ TEXT    │ Error message (nullable)       │   │
│   │ last_sync_at     │ INTEGER │ Unix timestamp (nullable)      │   │
│   │ created_at       │ INTEGER │ Unix timestamp                 │   │
│   │ updated_at       │ INTEGER │ Unix timestamp                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Read/Write
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                            │
│                                                                      │
│   Account (entity)                                                  │
│       │                                                              │
│       ├─── decrypt(apiKeyEncrypted) ───► Plain API Key (runtime)   │
│       │                                        │                     │
│       │                                        ▼                     │
│       │                              External API Calls              │
│       │                              - Anthropic Admin API           │
│       │                              - OpenAI Admin API              │
│       │                                        │                     │
│       │                                        ▼                     │
│       │                              UsageRecord[]                   │
│       │                              UserUsageStats[]                │
│       │                                                              │
│       └─── transform() ───► AccountCardView (UI)                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Type Index (v2 additions)

```typescript
// types/index.ts (UPDATED)

// === v1 exports (unchanged) ===
export type { Provider, ProviderType, ProviderFeatures } from './domain/provider';
export type { User, UserIdentifier } from './domain/user';
export type { UsageRecord, TokenUsage, Cost } from './domain/usage';
export type { UserUsageStats } from './domain/user-stats';
export type { DashboardSummary } from './view/dashboard';
export type { TimelineData, TimelineDataPoint } from './view/timeline';
export type { UserTableData, UserTableRow, UserTableColumn } from './view/user-table';
export type { ProviderTabData, AllProvidersData } from './view/provider-tab';

// === v2 additions ===

// Persisted Entities
export type { 
  Account, 
  NewAccount, 
  UpdateAccount,
  AccountStatus,
} from './account';

// Crypto
export type {
  EncryptedValue,
  EncryptedString,
  DecryptionResult,
  MaskedApiKey,
} from './crypto';

// API Types
export type {
  AccountResponse,
  AccountListResponse,
  CreateAccountRequest,
  CreateAccountResponse,
  UpdateAccountRequest,
  UpdateAccountResponse,
  DeleteAccountResponse,
  TestConnectionRequest,
  TestConnectionResponse,
  TestExistingAccountResponse,
  AccountErrorCode,
  AccountErrorResponse,
} from './api/accounts';

// View Types
export type {
  AccountListView,
  AccountCardView,
  AddAccountFormState,
  EditAccountFormState,
  AccountSelectorOption,
  AccountSelectorView,
} from './view/settings';
```

---

## Appendix

### A. Migration from v1

v1 환경변수 기반 계정을 v2 DB로 자동 마이그레이션:

```typescript
// lib/db/migrate-v1.ts

interface MigrationResult {
  migrated: number;
  skipped: number;
  accounts: Array<{
    provider: ProviderType;
    name: string;
  }>;
}

async function migrateFromEnvVars(): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    accounts: [],
  };
  
  const existingAccounts = await db.select().from(accounts);
  if (existingAccounts.length > 0) {
    result.skipped = 2;
    return result;
  }
  
  const migrations: NewAccountRow[] = [];
  
  const anthropicKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (anthropicKey && validateApiKey('claude', anthropicKey).valid) {
    const account = {
      id: crypto.randomUUID(),
      provider: 'claude' as const,
      name: 'Default Claude Account (Migrated)',
      apiKeyEncrypted: encrypt(anthropicKey),
      apiKeyHint: maskApiKey(anthropicKey),
      status: 'unknown' as const,
      lastError: null,
      lastSyncAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    migrations.push(account);
    result.accounts.push({ provider: 'claude', name: account.name });
  }
  
  const openaiKey = process.env.OPENAI_ADMIN_API_KEY;
  if (openaiKey && validateApiKey('openai', openaiKey).valid) {
    const account = {
      id: crypto.randomUUID(),
      provider: 'openai' as const,
      name: 'Default OpenAI Account (Migrated)',
      apiKeyEncrypted: encrypt(openaiKey),
      apiKeyHint: maskApiKey(openaiKey),
      status: 'unknown' as const,
      lastError: null,
      lastSyncAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    migrations.push(account);
    result.accounts.push({ provider: 'openai', name: account.name });
  }
  
  if (migrations.length > 0) {
    await db.insert(accounts).values(migrations);
    result.migrated = migrations.length;
  }
  
  return result;
}
```

### B. Security Considerations

| Concern | Mitigation |
|---------|------------|
| API Key at rest | AES-256-GCM encryption with environment-based key |
| API Key in transit | HTTPS only, never sent to client after creation |
| API Key in memory | Decrypted only during external API call, then discarded |
| API Key in logs | Redacted in all log outputs |
| API Key in responses | Only `apiKeyHint` returned, never full key |
| Encryption key compromise | Rotation procedure (re-encrypt all keys) |

### C. SQLite File Location

```
claude-dashboard/
├── data/
│   └── dashboard.db      # SQLite database file
├── drizzle/
│   └── migrations/       # Schema migrations
```

**Backup**: `cp data/dashboard.db data/dashboard.db.backup`
