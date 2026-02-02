# Software Design Document (SDD) v1

## Multi-AI Usage Dashboard

**Version**: 1.0  
**Date**: 2026-01-30  
**Author**: Engineering Team

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Next.js Frontend                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │  Login Page │  │  Dashboard  │  │ Components  │       │ │
│  │  │  (/)        │  │ (/dashboard)│  │ (shared)    │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ /api/auth    │  │ /api/claude  │  │ /api/openai  │         │
│  │ - login      │  │ - usage      │  │ - usage      │         │
│  │ - logout     │  │ - users      │  │ - costs      │         │
│  │ - verify     │  │              │  │ - users      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External APIs                              │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │   Anthropic Admin    │  │    OpenAI Admin      │            │
│  │   API                │  │    API               │            │
│  │   (sk-ant-admin-...) │  │    (sk-admin-...)    │            │
│  └──────────────────────┘  └──────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 14 (App Router) | SSR, API Routes, React 최신 기능 |
| **Language** | TypeScript | Type safety, 개발 생산성 |
| **Styling** | Tailwind CSS | Utility-first, 빠른 개발 |
| **UI Components** | shadcn/ui | 고품질 컴포넌트, 커스터마이징 용이 |
| **Charts** | Recharts | React 친화적, 반응형 지원 |
| **HTTP Client** | fetch (native) | Next.js 캐싱 통합 |
| **State Management** | React hooks + Context | 단순한 상태, 외부 라이브러리 불필요 |

---

## 2. Project Structure

```
claude-dashboard/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Login page (/)
│   ├── globals.css             # Global styles
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard layout (auth guard)
│   │   └── page.tsx            # Main dashboard
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts  # POST: password verification
│       │   ├── logout/route.ts # POST: clear session
│       │   └── verify/route.ts # GET: check session
│       ├── claude/
│       │   └── usage/route.ts  # GET: Claude Code usage data
│       └── openai/
│           ├── usage/route.ts  # GET: OpenAI usage data
│           └── costs/route.ts  # GET: OpenAI costs data
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── tabs.tsx
│   │   └── table.tsx
│   ├── dashboard/
│   │   ├── SummaryCards.tsx    # Token, Cost, Users summary
│   │   ├── UsageChart.tsx      # Time-series chart
│   │   ├── UserTable.tsx       # Per-user statistics
│   │   └── ProviderTabs.tsx    # Claude/OpenAI tab switcher
│   └── auth/
│       └── LoginForm.tsx       # Password input form
├── lib/
│   ├── providers/
│   │   ├── types.ts            # Common interfaces
│   │   ├── anthropic.ts        # Anthropic API client
│   │   └── openai.ts           # OpenAI API client
│   ├── auth.ts                 # Auth utilities
│   └── utils.ts                # Helper functions
├── hooks/
│   ├── useAuth.ts              # Auth state hook
│   └── useUsageData.ts         # Data fetching hook
├── types/
│   └── index.ts                # Global type definitions
├── .env.local                  # Environment variables
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 3. Component Design

### 3.1 Component Hierarchy

```
App (layout.tsx)
├── LoginPage (page.tsx)
│   └── LoginForm
│       ├── Input (password)
│       └── Button (submit)
│
└── DashboardLayout (dashboard/layout.tsx)
    └── DashboardPage (dashboard/page.tsx)
        ├── Header
        │   ├── Title
        │   ├── RefreshButton
        │   └── LogoutButton
        ├── ProviderTabs
        │   ├── Tab: Claude Code
        │   └── Tab: OpenAI
        ├── SummaryCards
        │   ├── Card: Total Tokens
        │   ├── Card: Total Cost
        │   └── Card: Active Users
        ├── UsageChart
        │   ├── PeriodSelector (7d/14d/30d)
        │   └── LineChart
        ├── UserTable
        │   ├── TableHeader
        │   ├── TableBody (rows)
        │   └── TableFooter (pagination)
        └── TotalCostSummary
```

### 3.2 Component Specifications

#### 3.2.1 LoginForm

```typescript
interface LoginFormProps {
  onSuccess: () => void;
}

// State
const [password, setPassword] = useState('');
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);

// Actions
const handleSubmit = async () => {
  // POST /api/auth/login
  // Set cookie on success
  // Call onSuccess()
};
```

#### 3.2.2 ProviderTabs

```typescript
type Provider = 'claude' | 'openai';

interface ProviderTabsProps {
  activeProvider: Provider;
  onProviderChange: (provider: Provider) => void;
  providers: Array<{
    id: Provider;
    name: string;
    icon: React.ReactNode;
    enabled: boolean;
  }>;
}
```

#### 3.2.3 SummaryCards

```typescript
interface SummaryCardsProps {
  data: {
    totalTokens: number;
    totalCost: number;
    activeUsers: number;
  };
  loading: boolean;
}

// Renders 3 cards with formatted numbers
// Shows skeleton when loading
```

#### 3.2.4 UsageChart

```typescript
interface UsageChartProps {
  data: Array<{
    date: string;      // YYYY-MM-DD
    tokens: number;
    cost: number;
  }>;
  period: 7 | 14 | 30;
  onPeriodChange: (period: 7 | 14 | 30) => void;
  loading: boolean;
}

// Uses Recharts LineChart
// Dual Y-axis: tokens (left), cost (right)
// Tooltip on hover
```

#### 3.2.5 UserTable

```typescript
interface UserTableProps {
  users: Array<{
    id: string;
    name: string;           // email or api key name
    tokens: number;
    cost: number;
    sessions?: number;      // Claude only
    acceptRate?: number;    // Claude only (0-100)
  }>;
  provider: Provider;       // Affects column visibility
  loading: boolean;
}

// Sortable columns
// Conditional columns based on provider
```

---

## 4. API Design

### 4.1 Authentication APIs

#### POST /api/auth/login

```typescript
// Request
interface LoginRequest {
  password: string;
}

// Response (200)
interface LoginResponse {
  success: true;
}

// Response (401)
interface LoginErrorResponse {
  success: false;
  error: string;
}

// Implementation
// 1. Compare password with process.env.DASHBOARD_PASSWORD
// 2. Set HTTP-only cookie with session token
// 3. Return success/failure
```

#### POST /api/auth/logout

```typescript
// Response (200)
interface LogoutResponse {
  success: true;
}

// Implementation
// 1. Clear session cookie
// 2. Return success
```

#### GET /api/auth/verify

```typescript
// Response (200)
interface VerifyResponse {
  authenticated: true;
}

// Response (401)
interface VerifyErrorResponse {
  authenticated: false;
}

// Implementation
// 1. Check session cookie validity
// 2. Return auth status
```

### 4.2 Claude API Routes

#### GET /api/claude/usage

```typescript
// Query Parameters
interface ClaudeUsageQuery {
  startDate: string;  // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD (default: today)
}

// Response
interface ClaudeUsageResponse {
  summary: {
    totalTokens: number;
    totalCost: number;
    activeUsers: number;
  };
  timeline: Array<{
    date: string;
    tokens: number;
    cost: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    tokens: number;
    cost: number;
    sessions: number;
    acceptRate: number;
  }>;
}

// Implementation
// 1. Call Anthropic Admin API: /v1/organizations/usage_report/claude_code
// 2. Transform response to normalized format
// 3. Return aggregated data
```

### 4.3 OpenAI API Routes

#### GET /api/openai/usage

```typescript
// Query Parameters
interface OpenAIUsageQuery {
  startDate: string;  // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

// Response
interface OpenAIUsageResponse {
  summary: {
    totalTokens: number;
    totalCost: number;
    activeUsers: number;
  };
  timeline: Array<{
    date: string;
    tokens: number;
    cost: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    tokens: number;
    cost: number;
  }>;
}

// Implementation
// 1. Call OpenAI Admin API: /v1/organization/usage/completions
// 2. Call OpenAI Admin API: /v1/organization/costs
// 3. Merge and transform data
// 4. Return normalized format
```

---

## 5. External API Integration

### 5.1 Anthropic API Client

```typescript
// lib/providers/anthropic.ts

interface AnthropicConfig {
  adminApiKey: string;  // sk-ant-admin-...
  baseUrl: string;      // https://api.anthropic.com
}

class AnthropicClient {
  constructor(config: AnthropicConfig);
  
  async getClaudeCodeUsage(params: {
    startingAt: string;  // YYYY-MM-DD
    endingAt?: string;
    limit?: number;
  }): Promise<ClaudeCodeUsageReport>;
}

// API Call Details
// Endpoint: GET /v1/organizations/usage_report/claude_code
// Headers:
//   x-api-key: {adminApiKey}
//   anthropic-version: 2023-06-01
// Query Params:
//   starting_at: YYYY-MM-DD
//   ending_at: YYYY-MM-DD (optional)
//   limit: number (default: 100)
```

### 5.2 OpenAI API Client

```typescript
// lib/providers/openai.ts

interface OpenAIConfig {
  adminApiKey: string;  // sk-admin-...
  baseUrl: string;      // https://api.openai.com
}

class OpenAIClient {
  constructor(config: OpenAIConfig);
  
  async getCompletionsUsage(params: {
    startTime: number;   // Unix timestamp
    endTime?: number;
    bucketWidth?: '1m' | '1h' | '1d';
    groupBy?: string[];
  }): Promise<CompletionsUsageReport>;
  
  async getCosts(params: {
    startTime: number;
    endTime?: number;
    groupBy?: string[];
  }): Promise<CostsReport>;
}

// API Call Details
// Endpoint: GET /v1/organization/usage/completions
// Headers:
//   Authorization: Bearer {adminApiKey}
//   Content-Type: application/json
// Query Params:
//   start_time: Unix timestamp (required)
//   end_time: Unix timestamp
//   bucket_width: '1d'
//   group_by: ['user_id', 'model']
```

### 5.3 Error Handling

```typescript
// lib/providers/types.ts

class APIError extends Error {
  constructor(
    public statusCode: number,
    public provider: 'anthropic' | 'openai',
    message: string
  ) {
    super(message);
  }
}

// Retry logic
const fetchWithRetry = async (
  fn: () => Promise<Response>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<Response> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fn();
      if (response.ok) return response;
      if (response.status === 429) {
        await sleep(delay * (i + 1));
        continue;
      }
      throw new APIError(response.status, 'unknown', await response.text());
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(delay * (i + 1));
    }
  }
  throw new Error('Max retries exceeded');
};
```

---

## 6. Authentication Design

### 6.1 Session Management

```typescript
// lib/auth.ts

const SESSION_COOKIE_NAME = 'dashboard_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface Session {
  createdAt: number;
  expiresAt: number;
}

// Generate session token (simple hash for v1)
const createSessionToken = (): string => {
  return crypto.randomUUID();
};

// Set session cookie
const setSession = (response: NextResponse): void => {
  const token = createSessionToken();
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
  });
};

// Verify session (for v1, just check cookie exists)
const verifySession = (request: NextRequest): boolean => {
  const token = request.cookies.get(SESSION_COOKIE_NAME);
  return !!token;
};
```

### 6.2 Middleware (Auth Guard)

```typescript
// middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.has('dashboard_session');
  const isAuthPage = request.nextUrl.pathname === '/';
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  const isAPI = request.nextUrl.pathname.startsWith('/api');
  
  // Protect dashboard routes
  if (isDashboard && !isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Redirect authenticated users from login
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Protect API routes (except auth)
  if (isAPI && !request.nextUrl.pathname.startsWith('/api/auth') && !isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/api/:path*'],
};
```

---

## 7. Data Flow

### 7.1 Dashboard Data Loading

```
User navigates to /dashboard
        │
        ▼
┌───────────────────────┐
│  DashboardPage mount  │
│  useUsageData hook    │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Fetch current        │
│  provider data        │
│  (e.g., /api/claude)  │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  API Route handles:   │
│  1. Verify session    │
│  2. Call external API │
│  3. Transform data    │
│  4. Return response   │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Update state         │
│  Render components    │
└───────────────────────┘
```

### 7.2 Provider Switch Flow

```
User clicks different provider tab
        │
        ▼
┌───────────────────────┐
│  onProviderChange()   │
│  Update state         │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Check cached data    │
│  for new provider     │
└───────────────────────┘
        │
    ┌───┴───┐
    │       │
  Cache   No Cache
  exists  
    │       │
    ▼       ▼
 Render   Fetch new
 cached   data
    │       │
    └───┬───┘
        │
        ▼
┌───────────────────────┐
│  Render components    │
│  with provider data   │
└───────────────────────┘
```

---

## 8. Environment Configuration

### 8.1 Environment Variables

```bash
# .env.local

# Authentication
DASHBOARD_PASSWORD=your-secure-password-here

# Anthropic API
ANTHROPIC_ADMIN_API_KEY=sk-ant-admin-...

# OpenAI API
OPENAI_ADMIN_API_KEY=sk-admin-...

# Optional: Feature flags
ENABLE_OPENAI=true
ENABLE_CLAUDE=true
```

### 8.2 Configuration Schema

```typescript
// lib/config.ts

interface Config {
  auth: {
    password: string;
    sessionDuration: number;
  };
  providers: {
    anthropic: {
      enabled: boolean;
      adminApiKey: string;
      baseUrl: string;
    };
    openai: {
      enabled: boolean;
      adminApiKey: string;
      baseUrl: string;
    };
  };
}

const config: Config = {
  auth: {
    password: process.env.DASHBOARD_PASSWORD!,
    sessionDuration: 24 * 60 * 60 * 1000,
  },
  providers: {
    anthropic: {
      enabled: process.env.ENABLE_CLAUDE !== 'false',
      adminApiKey: process.env.ANTHROPIC_ADMIN_API_KEY!,
      baseUrl: 'https://api.anthropic.com',
    },
    openai: {
      enabled: process.env.ENABLE_OPENAI !== 'false',
      adminApiKey: process.env.OPENAI_ADMIN_API_KEY!,
      baseUrl: 'https://api.openai.com',
    },
  },
};
```

---

## 9. Error Handling & Edge Cases

### 9.1 Error States

| Scenario | Handling |
|----------|----------|
| API Key missing | Show setup instructions |
| API rate limited | Retry with backoff, show warning |
| API timeout | Show error, allow retry |
| Invalid session | Redirect to login |
| No data for period | Show "No data" message |
| Partial data (one provider fails) | Show available data, indicate failure |

### 9.2 Loading States

```typescript
interface LoadingState {
  isLoading: boolean;
  isRefreshing: boolean;  // Background refresh
  error: Error | null;
  lastUpdated: Date | null;
}

// Components show:
// - Skeleton when isLoading && !data
// - Spinner overlay when isRefreshing && data
// - Error message when error
// - "Last updated: X" when lastUpdated
```

---

## 10. Performance Considerations

### 10.1 Caching Strategy

```typescript
// Next.js fetch caching (API routes)
const response = await fetch(url, {
  next: {
    revalidate: 60,  // Cache for 60 seconds
  },
});

// Client-side caching (SWR-like)
const CACHE_DURATION = 60 * 1000; // 1 minute
const cache = new Map<string, { data: any; timestamp: number }>();
```

### 10.2 Optimizations

| Optimization | Implementation |
|--------------|----------------|
| Lazy loading | Dynamic import for charts |
| Data pagination | Server-side pagination for user list |
| Debounce | Refresh button cooldown (5 seconds) |
| Memoization | React.memo for expensive components |

---

## 11. Security Measures

### 11.1 API Key Protection

- Admin API keys stored only in environment variables
- Never exposed to client-side code
- All external API calls made server-side only

### 11.2 Input Validation

```typescript
// API route validation
const validateDateRange = (startDate: string, endDate: string): boolean => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const maxRange = 31 * 24 * 60 * 60 * 1000; // 31 days
  
  return (
    !isNaN(start.getTime()) &&
    !isNaN(end.getTime()) &&
    end >= start &&
    (end.getTime() - start.getTime()) <= maxRange
  );
};
```

### 11.3 CORS & Headers

```typescript
// next.config.js
const nextConfig = {
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
  ],
};
```

---

## Appendix

### A. Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.0",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.300.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0"
  }
}
```

### B. shadcn/ui Components

Required components to install:
- `button`
- `card`
- `input`
- `tabs`
- `table`
- `skeleton`
- `alert`
