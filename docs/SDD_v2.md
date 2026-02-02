# Software Design Document (SDD) v2

## Multi-AI Usage Dashboard - Account Management

**Version**: 2.0  
**Date**: 2026-01-31  
**Author**: Engineering Team

---

## 1. System Overview

### 1.1 Architecture Diagram (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Next.js Frontend                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │  Login Page │  │  Dashboard  │  │  Settings   │       │ │
│  │  │  (/)        │  │ (/dashboard)│  │ (/settings) │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ /api/auth    │  │ /api/accounts│  │ /api/usage   │         │
│  │ - login      │  │ - CRUD       │  │ - claude     │         │
│  │ - logout     │  │ - test       │  │ - openai     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│   SQLite DB      │ │  Encryption  │ │     External APIs        │
│  ┌────────────┐  │ │    Layer     │ │  ┌────────────────────┐  │
│  │  accounts  │  │ │              │ │  │  Anthropic Admin   │  │
│  │  table     │  │ │  AES-256-GCM │ │  │  OpenAI Admin      │  │
│  └────────────┘  │ │              │ │  └────────────────────┘  │
└──────────────────┘ └──────────────┘ └──────────────────────────┘
```

### 1.2 Technology Stack (Updated)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 14 (App Router) | 유지 |
| **Language** | TypeScript | 유지 |
| **Styling** | Tailwind CSS | 유지 |
| **UI Components** | shadcn/ui | 유지 |
| **Charts** | Recharts | 유지 |
| **Database** | SQLite + better-sqlite3 | 서버리스, 파일 기반, 빠른 성능 |
| **ORM** | Drizzle ORM | 타입 안전, 경량 |
| **Encryption** | Node.js crypto (AES-256-GCM) | 내장 모듈, 추가 의존성 불필요 |

---

## 2. Project Structure (Updated)

```
claude-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Login
│   ├── globals.css
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── settings/                   # NEW
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── verify/route.ts
│       ├── accounts/               # NEW
│       │   ├── route.ts            # GET (list), POST (create)
│       │   ├── [id]/route.ts       # PUT, DELETE
│       │   ├── [id]/test/route.ts  # POST (test existing)
│       │   └── test/route.ts       # POST (test new key)
│       ├── claude/
│       │   └── usage/route.ts      # Modified: accountId param
│       └── openai/
│           └── usage/route.ts      # Modified: accountId param
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── auth/
│   └── settings/                   # NEW
│       ├── AccountList.tsx
│       ├── AccountCard.tsx
│       ├── AddAccountModal.tsx
│       └── EditAccountModal.tsx
├── lib/
│   ├── providers/
│   │   ├── types.ts
│   │   ├── anthropic.ts            # Modified: accept apiKey param
│   │   ├── openai.ts               # Modified: accept apiKey param
│   │   └── transformers.ts
│   ├── db/                         # NEW
│   │   ├── index.ts                # DB connection
│   │   ├── schema.ts               # Drizzle schema
│   │   └── migrate.ts              # Auto migration
│   ├── crypto.ts                   # NEW: Encryption utilities
│   ├── auth.ts
│   ├── config.ts                   # Modified
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useUsageData.ts             # Modified: accountId param
│   └── useAccounts.ts              # NEW
├── types/
│   ├── index.ts
│   ├── api.ts
│   └── account.ts                  # NEW
├── data/                           # NEW
│   └── dashboard.db                # SQLite database file
├── .env.local
├── drizzle.config.ts               # NEW
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. Database Design

### 3.1 Schema (Drizzle)

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

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
```

### 3.2 Database Connection

```typescript
// lib/db/index.ts

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'dashboard.db');

const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });
```

### 3.3 Auto Migration

```typescript
// lib/db/migrate.ts

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index';

export function runMigrations() {
  migrate(db, { migrationsFolder: './drizzle' });
}
```

---

## 4. Encryption Design

### 4.1 Encryption Module

```typescript
// lib/crypto.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = ciphertext.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) return '***';
  const prefix = apiKey.slice(0, 10);
  const suffix = apiKey.slice(-4);
  return `${prefix}***...***${suffix}`;
}
```

### 4.2 Security Flow

```
User inputs API Key
        │
        ▼
┌───────────────────────┐
│  Client (Browser)     │
│  Plain API Key        │
└───────────────────────┘
        │ HTTPS
        ▼
┌───────────────────────┐
│  API Route            │
│  1. Validate format   │
│  2. Test connection   │
│  3. Encrypt with AES  │
│  4. Generate hint     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  SQLite DB            │
│  - Encrypted key      │
│  - Hint for display   │
└───────────────────────┘

Usage Request Flow:
┌───────────────────────┐
│  API Route            │
│  1. Load account      │
│  2. Decrypt API Key   │
│  3. Call external API │
│  4. Return data       │
└───────────────────────┘
```

---

## 5. API Design (New Endpoints)

### 5.1 Account CRUD

#### GET /api/accounts

```typescript
interface AccountListResponse {
  accounts: Array<{
    id: string;
    provider: 'claude' | 'openai';
    name: string;
    apiKeyHint: string;
    status: 'connected' | 'error' | 'unknown';
    lastError: string | null;
    lastSyncAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

#### POST /api/accounts

```typescript
interface CreateAccountRequest {
  provider: 'claude' | 'openai';
  name: string;
  apiKey: string;
}

interface CreateAccountResponse {
  success: true;
  account: {
    id: string;
    provider: string;
    name: string;
    apiKeyHint: string;
    status: 'connected' | 'error';
  };
}
```

#### PUT /api/accounts/:id

```typescript
interface UpdateAccountRequest {
  name?: string;
  apiKey?: string;
}

interface UpdateAccountResponse {
  success: true;
  account: { ... };
}
```

#### DELETE /api/accounts/:id

```typescript
interface DeleteAccountResponse {
  success: true;
}
```

### 5.2 Connection Test

#### POST /api/accounts/test

```typescript
interface TestConnectionRequest {
  provider: 'claude' | 'openai';
  apiKey: string;
}

interface TestConnectionResponse {
  success: true;
  organization?: string;
  error?: string;
}
```

#### POST /api/accounts/:id/test

```typescript
interface TestExistingResponse {
  success: true;
  status: 'connected' | 'error';
  error?: string;
}
```

### 5.3 Modified Usage Endpoints

#### GET /api/claude/usage

```typescript
interface ClaudeUsageQuery {
  accountId: string;
  days?: number;
}
```

#### GET /api/openai/usage

```typescript
interface OpenAIUsageQuery {
  accountId: string;
  days?: number;
}
```

---

## 6. Component Design (New)

### 6.1 Settings Page Component Hierarchy

```
SettingsPage (page.tsx)
├── Header
│   └── BackButton
├── AccountSection
│   ├── SectionTitle ("Claude Code")
│   │   └── ProviderIcon
│   └── AccountList
│       └── AccountCard (multiple)
│           ├── AccountInfo
│           │   ├── Name
│           │   ├── ApiKeyHint
│           │   └── StatusBadge
│           ├── LastSyncInfo
│           └── Actions
│               ├── TestButton
│               ├── EditButton
│               └── DeleteButton
├── AddAccountButton
└── AddAccountModal (dialog)
    ├── ProviderSelect
    ├── NameInput
    ├── ApiKeyInput
    ├── ConnectionTestResult
    └── ActionButtons
```

### 6.2 Component Specifications

#### AccountCard

```typescript
interface AccountCardProps {
  account: {
    id: string;
    provider: 'claude' | 'openai';
    name: string;
    apiKeyHint: string;
    status: 'connected' | 'error' | 'unknown';
    lastError: string | null;
    lastSyncAt: Date | null;
  };
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  testing: boolean;
}
```

#### AddAccountModal

```typescript
interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface AddAccountState {
  provider: 'claude' | 'openai';
  name: string;
  apiKey: string;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testError: string | null;
  testOrganization: string | null;
}
```

---

## 7. Data Flow

### 7.1 Add Account Flow

```
User clicks "Add Account"
        │
        ▼
┌───────────────────────┐
│  AddAccountModal      │
│  opens                │
└───────────────────────┘
        │
User fills form & clicks "Test Connection"
        │
        ▼
┌───────────────────────┐
│  POST /api/accounts/  │
│       test            │
│  - Validate API Key   │
│  - Call external API  │
│  - Return org name    │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Show test result     │
│  - Success: Org name  │
│  - Error: Message     │
└───────────────────────┘
        │
User clicks "Save Account"
        │
        ▼
┌───────────────────────┐
│  POST /api/accounts   │
│  - Encrypt API Key    │
│  - Save to DB         │
│  - Return account     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Update account list  │
│  Close modal          │
└───────────────────────┘
```

### 7.2 Dashboard with Account Selection

```
User selects account from dropdown
        │
        ▼
┌───────────────────────┐
│  useUsageData hook    │
│  with accountId       │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  GET /api/[provider]/ │
│      usage            │
│  ?accountId=xxx       │
│  ?days=7              │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  API Route:           │
│  1. Load account      │
│  2. Decrypt API Key   │
│  3. Call external API │
│  4. Transform data    │
│  5. Update account    │
│     status & lastSync │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Render dashboard     │
│  with data            │
└───────────────────────┘
```

---

## 8. Environment Configuration (Updated)

### 8.1 Environment Variables

```bash
# .env.local

# Authentication (유지)
DASHBOARD_PASSWORD=your-secure-password-here

# Encryption (NEW - 필수)
ENCRYPTION_KEY=your-64-char-hex-string-for-aes-256-encryption

# Legacy fallback (선택적 - v1 호환)
ANTHROPIC_ADMIN_API_KEY=sk-ant-admin-...
OPENAI_ADMIN_API_KEY=sk-admin-...
```

### 8.2 Encryption Key Generation

```bash
# Generate a secure 256-bit key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 9. Migration Strategy

### 9.1 v1 → v2 Auto Migration

```typescript
// lib/db/migrate.ts

import { db } from './index';
import { accounts } from './schema';
import { encrypt, maskApiKey } from '../crypto';
import { v4 as uuid } from 'uuid';

export async function migrateFromEnvVars() {
  const existingAccounts = await db.select().from(accounts);
  
  if (existingAccounts.length > 0) {
    return;
  }

  const migrations: NewAccount[] = [];
  
  const anthropicKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (anthropicKey) {
    migrations.push({
      id: uuid(),
      provider: 'claude',
      name: 'Default Claude Account (Migrated)',
      apiKeyEncrypted: encrypt(anthropicKey),
      apiKeyHint: maskApiKey(anthropicKey),
      status: 'unknown',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  
  const openaiKey = process.env.OPENAI_ADMIN_API_KEY;
  if (openaiKey) {
    migrations.push({
      id: uuid(),
      provider: 'openai',
      name: 'Default OpenAI Account (Migrated)',
      apiKeyEncrypted: encrypt(openaiKey),
      apiKeyHint: maskApiKey(openaiKey),
      status: 'unknown',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  
  if (migrations.length > 0) {
    await db.insert(accounts).values(migrations);
  }
}
```

---

## 10. Error Handling

### 10.1 Account Error States

| Error | Handling |
|-------|----------|
| Invalid API Key format | 클라이언트 검증, 저장 거부 |
| API Key authentication failed | status='error', lastError 저장 |
| API rate limited | 재시도 후 에러 표시 |
| Network error | status='error', 재시도 버튼 제공 |
| Encryption key missing | 서버 시작 시 에러 |

### 10.2 Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: 'INVALID_API_KEY' | 'AUTH_FAILED' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'NOT_FOUND';
    message: string;
    details?: unknown;
  };
}
```

---

## 11. Security Measures (Updated)

### 11.1 API Key Protection

| Layer | Protection |
|-------|------------|
| Transport | HTTPS only |
| Storage | AES-256-GCM encryption |
| Memory | API Key decrypted only during request |
| Response | Never return full API Key |
| Logs | API Key redaction in logs |

### 11.2 Input Validation

```typescript
function validateApiKey(provider: string, apiKey: string): boolean {
  if (provider === 'claude') {
    return /^sk-ant-admin-[a-zA-Z0-9_-]+$/.test(apiKey);
  }
  if (provider === 'openai') {
    return /^sk-admin-[a-zA-Z0-9]+$/.test(apiKey);
  }
  return false;
}
```

---

## Appendix

### A. New Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.30.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.21.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/uuid": "^9.0.0"
  }
}
```

### B. New shadcn/ui Components

Required components to add:
- `dialog` (for modals)
- `select` (for provider dropdown)
- `badge` (for status indicators)
- `alert` (for error messages)
- `dropdown-menu` (for account selection)
