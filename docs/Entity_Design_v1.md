# Entity Design Document v1

## Multi-AI Usage Dashboard

**Version**: 1.0  
**Date**: 2026-01-30  
**Author**: Engineering Team

---

## 1. Overview

이 대시보드는 외부 API에서 실시간으로 데이터를 조회하므로 자체 데이터베이스를 사용하지 않습니다.
대신, 데이터 정규화와 타입 안정성을 위한 **인터페이스 기반 엔티티**를 정의합니다.

### 1.1 Entity Categories

| Category | Description |
|----------|-------------|
| **Domain Entities** | 비즈니스 도메인 모델 (Provider, User, Usage) |
| **API Entities** | 외부 API 응답 타입 |
| **View Entities** | UI 컴포넌트용 정규화된 데이터 |

---

## 2. Domain Entities

### 2.1 Provider

AI 서비스 제공자를 나타내는 엔티티.

```typescript
// types/domain/provider.ts

/**
 * Supported AI service providers
 */
type ProviderType = 'claude' | 'openai';

/**
 * Provider configuration and metadata
 */
interface Provider {
  /** Unique provider identifier */
  id: ProviderType;
  
  /** Display name */
  name: string;
  
  /** Provider logo/icon identifier */
  icon: string;
  
  /** Whether this provider is enabled */
  enabled: boolean;
  
  /** API base URL */
  baseUrl: string;
  
  /** Provider-specific features */
  features: ProviderFeatures;
}

/**
 * Features available per provider
 */
interface ProviderFeatures {
  /** Supports per-user breakdown */
  userTracking: boolean;
  
  /** Supports session tracking */
  sessionTracking: boolean;
  
  /** Supports tool acceptance rate */
  acceptanceTracking: boolean;
  
  /** Supports cost data */
  costTracking: boolean;
  
  /** Minimum data granularity */
  minGranularity: 'minute' | 'hour' | 'day';
}
```

### 2.2 User

AI 서비스 사용자를 나타내는 엔티티.

```typescript
// types/domain/user.ts

/**
 * User identification method varies by provider
 */
type UserIdentifier = 
  | { type: 'email'; value: string }      // Claude Code
  | { type: 'api_key'; value: string }    // Both
  | { type: 'user_id'; value: string };   // OpenAI

/**
 * User entity representing an AI service consumer
 */
interface User {
  /** Unique identifier within the provider */
  id: string;
  
  /** How the user is identified */
  identifier: UserIdentifier;
  
  /** Display name (email, key name, or ID) */
  displayName: string;
  
  /** Provider this user belongs to */
  provider: ProviderType;
}
```

### 2.3 UsageRecord

단일 시간 단위의 사용량 레코드.

```typescript
// types/domain/usage.ts

/**
 * Token usage breakdown
 */
interface TokenUsage {
  /** Input tokens consumed */
  input: number;
  
  /** Output tokens generated */
  output: number;
  
  /** Cached input tokens (if applicable) */
  cachedInput?: number;
  
  /** Total tokens (input + output) */
  total: number;
}

/**
 * Cost information
 */
interface Cost {
  /** Amount in the specified currency */
  amount: number;
  
  /** Currency code (always USD for v1) */
  currency: 'USD';
}

/**
 * Single usage record for a time bucket
 */
interface UsageRecord {
  /** Start of the time bucket */
  startTime: Date;
  
  /** End of the time bucket */
  endTime: Date;
  
  /** Token usage for this period */
  tokens: TokenUsage;
  
  /** Cost for this period (may be estimated) */
  cost: Cost;
  
  /** Number of API requests/sessions */
  requestCount: number;
  
  /** Provider this record belongs to */
  provider: ProviderType;
  
  /** Associated user (optional) */
  user?: User;
  
  /** Model used (optional) */
  model?: string;
}
```

### 2.4 UserUsageStats

사용자별 집계된 통계.

```typescript
// types/domain/user-stats.ts

/**
 * Aggregated statistics for a single user
 */
interface UserUsageStats {
  /** User information */
  user: User;
  
  /** Total tokens used in the period */
  totalTokens: TokenUsage;
  
  /** Total cost in the period */
  totalCost: Cost;
  
  /** Number of sessions (Claude Code only) */
  sessions?: number;
  
  /** Tool acceptance rate 0-100 (Claude Code only) */
  acceptanceRate?: number;
  
  /** Lines of code added (Claude Code only) */
  linesAdded?: number;
  
  /** Lines of code removed (Claude Code only) */
  linesRemoved?: number;
  
  /** Number of commits (Claude Code only) */
  commits?: number;
  
  /** Number of PRs (Claude Code only) */
  pullRequests?: number;
  
  /** Models used with usage breakdown */
  modelBreakdown?: Array<{
    model: string;
    tokens: TokenUsage;
    cost: Cost;
  }>;
}
```

---

## 3. API Response Entities

외부 API 응답을 그대로 타입화한 엔티티.

### 3.1 Anthropic API Types

```typescript
// types/api/anthropic.ts

/**
 * Claude Code Usage Report API Response
 * Endpoint: GET /v1/organizations/usage_report/claude_code
 */
interface AnthropicClaudeCodeUsageResponse {
  data: AnthropicClaudeCodeUsageItem[];
  has_more: boolean;
  next_page?: string;
}

interface AnthropicClaudeCodeUsageItem {
  /** User identification */
  email_address?: string;
  api_key_name?: string;
  
  /** Session metrics */
  num_sessions: number;
  
  /** Code metrics */
  lines_of_code: {
    added: number;
    removed: number;
  };
  
  /** Git metrics */
  commits_by_claude_code: number;
  pull_requests_by_claude_code: number;
  
  /** Tool acceptance */
  edit_tool: {
    accepted: number;
    rejected: number;
  };
  write_tool: {
    accepted: number;
    rejected: number;
  };
  notebook_edit_tool: {
    accepted: number;
    rejected: number;
  };
  
  /** Token usage by model */
  tokens: {
    [model: string]: {
      input: number;
      output: number;
      cache_read: number;
      cache_creation: number;
    };
  };
  
  /** Estimated cost */
  estimated_cost: {
    amount: string;  // Cents as string
    currency: string;
  };
  
  /** Metadata */
  terminal_type?: string;
  customer_type: 'api' | 'subscription';
}

/**
 * Messages Usage Report API Response
 * Endpoint: GET /v1/organizations/usage_report/messages
 */
interface AnthropicMessagesUsageResponse {
  data: Array<{
    start_time: string;  // ISO 8601
    results: AnthropicMessagesUsageResult[];
  }>;
  has_more: boolean;
  next_page?: string;
}

interface AnthropicMessagesUsageResult {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation?: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  output_tokens: number;
  api_key_id?: string;
  workspace_id?: string;
  model: string;
  service_tier: string;
  context_window: '0-200k' | '200k-1M';
}
```

### 3.2 OpenAI API Types

```typescript
// types/api/openai.ts

/**
 * Completions Usage API Response
 * Endpoint: GET /v1/organization/usage/completions
 */
interface OpenAICompletionsUsageResponse {
  object: 'page';
  data: Array<{
    start_time: number;  // Unix timestamp
    end_time: number;
    results: OpenAICompletionsUsageResult[];
  }>;
  has_more: boolean;
  next_page?: string;
}

interface OpenAICompletionsUsageResult {
  object: 'organization.usage.completions.result';
  input_tokens: number;
  output_tokens: number;
  input_cached_tokens?: number;
  input_audio_tokens?: number;
  output_audio_tokens?: number;
  num_model_requests: number;
  project_id?: string;
  user_id?: string;
  api_key_id?: string;
  model: string;
  batch: boolean;
  service_tier?: string;
}

/**
 * Costs API Response
 * Endpoint: GET /v1/organization/costs
 */
interface OpenAICostsResponse {
  object: 'page';
  data: Array<{
    start_time: number;
    end_time: number;
    results: OpenAICostsResult[];
  }>;
  has_more: boolean;
  next_page?: string;
}

interface OpenAICostsResult {
  object: 'organization.costs.result';
  amount: {
    value: number;
    currency: 'usd';
  };
  line_item?: string;
  project_id?: string;
}
```

---

## 4. View Entities

UI 컴포넌트에서 사용하는 정규화된 데이터 구조.

### 4.1 DashboardSummary

대시보드 요약 카드용 데이터.

```typescript
// types/view/dashboard.ts

/**
 * Summary data for dashboard cards
 */
interface DashboardSummary {
  /** Total tokens used across all users */
  totalTokens: number;
  
  /** Formatted token string (e.g., "1.2M") */
  totalTokensFormatted: string;
  
  /** Total cost in USD */
  totalCost: number;
  
  /** Formatted cost string (e.g., "$320.50") */
  totalCostFormatted: string;
  
  /** Number of active users */
  activeUsers: number;
  
  /** Period this summary covers */
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  
  /** Comparison with previous period (optional) */
  comparison?: {
    tokensDelta: number;      // Percentage change
    costDelta: number;        // Percentage change
    usersDelta: number;       // Absolute change
  };
}
```

### 4.2 TimelineDataPoint

시계열 차트용 데이터 포인트.

```typescript
// types/view/timeline.ts

/**
 * Single data point for timeline chart
 */
interface TimelineDataPoint {
  /** Date in YYYY-MM-DD format */
  date: string;
  
  /** Display label (e.g., "Jan 30") */
  label: string;
  
  /** Token count for this day */
  tokens: number;
  
  /** Cost for this day */
  cost: number;
  
  /** Number of requests/sessions */
  requests: number;
}

/**
 * Complete timeline dataset
 */
interface TimelineData {
  /** Array of data points, sorted by date ascending */
  points: TimelineDataPoint[];
  
  /** Statistics for Y-axis scaling */
  stats: {
    maxTokens: number;
    maxCost: number;
    avgTokens: number;
    avgCost: number;
  };
  
  /** Period covered */
  period: {
    start: string;
    end: string;
    days: number;
  };
}
```

### 4.3 UserTableRow

사용자 테이블 행 데이터.

```typescript
// types/view/user-table.ts

/**
 * Single row in user statistics table
 */
interface UserTableRow {
  /** Unique row key */
  id: string;
  
  /** User display name (email or key name) */
  name: string;
  
  /** User identifier type */
  identifierType: 'email' | 'api_key' | 'user_id';
  
  /** Total tokens (formatted) */
  tokens: string;
  
  /** Raw token count (for sorting) */
  tokensRaw: number;
  
  /** Total cost (formatted) */
  cost: string;
  
  /** Raw cost (for sorting) */
  costRaw: number;
  
  /** Session count (Claude only) */
  sessions?: number;
  
  /** Acceptance rate percentage (Claude only) */
  acceptanceRate?: number;
  
  /** Percentage of total usage */
  usagePercentage: number;
}

/**
 * Complete user table data
 */
interface UserTableData {
  /** Table rows */
  rows: UserTableRow[];
  
  /** Total count (for pagination) */
  total: number;
  
  /** Available columns based on provider */
  columns: UserTableColumn[];
}

/**
 * Column definition
 */
interface UserTableColumn {
  id: string;
  label: string;
  sortable: boolean;
  align: 'left' | 'center' | 'right';
  width?: string;
}
```

### 4.4 ProviderTabData

탭별 통합 데이터.

```typescript
// types/view/provider-tab.ts

/**
 * Complete data for a provider tab
 */
interface ProviderTabData {
  /** Provider identifier */
  provider: ProviderType;
  
  /** Summary cards data */
  summary: DashboardSummary;
  
  /** Timeline chart data */
  timeline: TimelineData;
  
  /** User table data */
  users: UserTableData;
  
  /** Loading state */
  loading: boolean;
  
  /** Error state */
  error: string | null;
  
  /** Last successful fetch */
  lastUpdated: Date | null;
}

/**
 * All providers data (for multi-tab view)
 */
interface AllProvidersData {
  /** Currently active provider */
  activeProvider: ProviderType;
  
  /** Data per provider */
  providers: Record<ProviderType, ProviderTabData>;
  
  /** Aggregated cost across all providers */
  totalCost: {
    amount: number;
    formatted: string;
    breakdown: Array<{
      provider: ProviderType;
      amount: number;
      formatted: string;
      percentage: number;
    }>;
  };
}
```

---

## 5. Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        Domain Layer                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Provider ──────────────< UsageRecord                          │
│     │                         │                                 │
│     │                         │                                 │
│     └──────< User >──────────┘                                 │
│                │                                                │
│                │                                                │
│                └────────> UserUsageStats                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Transform
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         View Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AllProvidersData                                              │
│     │                                                           │
│     └──────> ProviderTabData                                   │
│                 │                                               │
│                 ├──> DashboardSummary                          │
│                 │                                               │
│                 ├──> TimelineData ──> TimelineDataPoint[]      │
│                 │                                               │
│                 └──> UserTableData ──> UserTableRow[]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Transformation

### 6.1 Anthropic → Domain

```typescript
// lib/transformers/anthropic.ts

function transformClaudeCodeUsage(
  response: AnthropicClaudeCodeUsageResponse
): UserUsageStats[] {
  return response.data.map(item => ({
    user: {
      id: item.email_address || item.api_key_name || 'unknown',
      identifier: item.email_address 
        ? { type: 'email', value: item.email_address }
        : { type: 'api_key', value: item.api_key_name || '' },
      displayName: item.email_address || item.api_key_name || 'Unknown',
      provider: 'claude',
    },
    totalTokens: calculateTotalTokens(item.tokens),
    totalCost: {
      amount: parseFloat(item.estimated_cost.amount) / 100,
      currency: 'USD',
    },
    sessions: item.num_sessions,
    acceptanceRate: calculateAcceptanceRate(item),
    linesAdded: item.lines_of_code.added,
    linesRemoved: item.lines_of_code.removed,
    commits: item.commits_by_claude_code,
    pullRequests: item.pull_requests_by_claude_code,
  }));
}

function calculateAcceptanceRate(item: AnthropicClaudeCodeUsageItem): number {
  const total = 
    item.edit_tool.accepted + item.edit_tool.rejected +
    item.write_tool.accepted + item.write_tool.rejected;
  
  if (total === 0) return 0;
  
  const accepted = item.edit_tool.accepted + item.write_tool.accepted;
  return Math.round((accepted / total) * 100);
}
```

### 6.2 OpenAI → Domain

```typescript
// lib/transformers/openai.ts

function transformOpenAIUsage(
  usageResponse: OpenAICompletionsUsageResponse,
  costsResponse: OpenAICostsResponse
): UserUsageStats[] {
  const userMap = new Map<string, UserUsageStats>();
  
  // Process usage data
  for (const bucket of usageResponse.data) {
    for (const result of bucket.results) {
      const userId = result.user_id || result.api_key_id || 'unknown';
      
      const existing = userMap.get(userId) || createEmptyStats(userId, 'openai');
      existing.totalTokens.input += result.input_tokens;
      existing.totalTokens.output += result.output_tokens;
      existing.totalTokens.total += result.input_tokens + result.output_tokens;
      
      userMap.set(userId, existing);
    }
  }
  
  // Merge cost data
  // (Cost API doesn't have per-user breakdown, so distribute proportionally)
  const totalCost = costsResponse.data
    .flatMap(b => b.results)
    .reduce((sum, r) => sum + r.amount.value, 0);
  
  const totalTokens = Array.from(userMap.values())
    .reduce((sum, u) => sum + u.totalTokens.total, 0);
  
  for (const [userId, stats] of userMap) {
    const proportion = stats.totalTokens.total / totalTokens;
    stats.totalCost.amount = totalCost * proportion;
  }
  
  return Array.from(userMap.values());
}
```

### 6.3 Domain → View

```typescript
// lib/transformers/view.ts

function transformToUserTableData(
  stats: UserUsageStats[],
  provider: ProviderType
): UserTableData {
  const totalTokens = stats.reduce((sum, s) => sum + s.totalTokens.total, 0);
  
  const rows: UserTableRow[] = stats.map(stat => ({
    id: stat.user.id,
    name: stat.user.displayName,
    identifierType: stat.user.identifier.type,
    tokens: formatNumber(stat.totalTokens.total),
    tokensRaw: stat.totalTokens.total,
    cost: formatCurrency(stat.totalCost.amount),
    costRaw: stat.totalCost.amount,
    sessions: stat.sessions,
    acceptanceRate: stat.acceptanceRate,
    usagePercentage: Math.round((stat.totalTokens.total / totalTokens) * 100),
  }));
  
  const columns = getColumnsForProvider(provider);
  
  return {
    rows: rows.sort((a, b) => b.tokensRaw - a.tokensRaw),
    total: rows.length,
    columns,
  };
}

function getColumnsForProvider(provider: ProviderType): UserTableColumn[] {
  const baseColumns: UserTableColumn[] = [
    { id: 'name', label: 'User', sortable: true, align: 'left' },
    { id: 'tokens', label: 'Tokens', sortable: true, align: 'right' },
    { id: 'cost', label: 'Cost', sortable: true, align: 'right' },
  ];
  
  if (provider === 'claude') {
    return [
      ...baseColumns,
      { id: 'sessions', label: 'Sessions', sortable: true, align: 'right' },
      { id: 'acceptanceRate', label: 'Accept Rate', sortable: true, align: 'right' },
    ];
  }
  
  return baseColumns;
}
```

---

## 7. Utility Types

```typescript
// types/utils.ts

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  data: T;
  error?: never;
}

interface ApiError {
  data?: never;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

type ApiResult<T> = ApiResponse<T> | ApiError;

/**
 * Pagination
 */
interface PaginatedRequest {
  page?: number;
  limit?: number;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Date range
 */
interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Loading state
 */
type LoadingState = 'idle' | 'loading' | 'success' | 'error';
```

---

## 8. Type Guards

```typescript
// lib/type-guards.ts

function isAnthropicClaudeCodeResponse(
  data: unknown
): data is AnthropicClaudeCodeUsageResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'data' in data &&
    Array.isArray((data as any).data)
  );
}

function isOpenAIUsageResponse(
  data: unknown
): data is OpenAICompletionsUsageResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'object' in data &&
    (data as any).object === 'page'
  );
}

function hasUserEmail(
  item: AnthropicClaudeCodeUsageItem
): item is AnthropicClaudeCodeUsageItem & { email_address: string } {
  return typeof item.email_address === 'string' && item.email_address.length > 0;
}
```

---

## 9. Constants

```typescript
// lib/constants.ts

export const PROVIDERS: Record<ProviderType, Provider> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    icon: 'anthropic',
    enabled: true,
    baseUrl: 'https://api.anthropic.com',
    features: {
      userTracking: true,
      sessionTracking: true,
      acceptanceTracking: true,
      costTracking: true,
      minGranularity: 'day',
    },
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    icon: 'openai',
    enabled: true,
    baseUrl: 'https://api.openai.com',
    features: {
      userTracking: true,
      sessionTracking: false,
      acceptanceTracking: false,
      costTracking: true,
      minGranularity: 'minute',
    },
  },
};

export const DEFAULT_PERIOD_DAYS = 7;
export const MAX_PERIOD_DAYS = 31;
export const CACHE_DURATION_MS = 60 * 1000; // 1 minute
```

---

## Appendix

### A. Full Type Index

```typescript
// types/index.ts

// Domain
export type { Provider, ProviderType, ProviderFeatures } from './domain/provider';
export type { User, UserIdentifier } from './domain/user';
export type { UsageRecord, TokenUsage, Cost } from './domain/usage';
export type { UserUsageStats } from './domain/user-stats';

// API
export type { 
  AnthropicClaudeCodeUsageResponse,
  AnthropicClaudeCodeUsageItem,
  AnthropicMessagesUsageResponse,
  AnthropicMessagesUsageResult,
} from './api/anthropic';

export type {
  OpenAICompletionsUsageResponse,
  OpenAICompletionsUsageResult,
  OpenAICostsResponse,
  OpenAICostsResult,
} from './api/openai';

// View
export type { DashboardSummary } from './view/dashboard';
export type { TimelineData, TimelineDataPoint } from './view/timeline';
export type { UserTableData, UserTableRow, UserTableColumn } from './view/user-table';
export type { ProviderTabData, AllProvidersData } from './view/provider-tab';

// Utils
export type { ApiResult, ApiResponse, ApiError } from './utils';
export type { PaginatedRequest, PaginatedResponse } from './utils';
export type { DateRange, LoadingState } from './utils';
```
