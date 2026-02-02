# Implementation Plan v3

## Claude Usage Monitor - OAuth-based Usage Tracking

**Version**: 3.0  
**Date**: 2026-02-01  
**Estimated Duration**: 3.5 days

---

## 1. Overview

v2에서 v3로의 전환 구현 계획입니다. Admin API Key 기반에서 OAuth Token 기반으로 변경합니다.

### 1.1 Major Changes

| Category | v2 | v3 |
|----------|----|----|
| 인증 | Admin API Key | OAuth Token |
| 데이터 | 토큰 수, 비용 | 사용률 % |
| Provider | Claude + OpenAI | Claude only |
| UI | Tabs + Charts + Tables | Usage Cards Grid |

### 1.2 Implementation Phases

```
Phase 1: Database Migration (0.5일)
    ↓
Phase 2: Anthropic OAuth Client (0.5일)
    ↓
Phase 3: Account API 수정 (0.5일)
    ↓
Phase 4: Dashboard UI (1일)
    ↓
Phase 5: Settings UI 수정 (0.5일)
    ↓
Phase 6: Testing & Polish (0.5일)
```

---

## 2. Detailed Task Breakdown

### Phase 1: Database Migration (0.5일)

#### 1.1 Schema 수정
- [ ] `lib/db/schema.ts` - v3 스키마로 변경
  - accounts 테이블: provider 제거, apiKey → token
  - usage_cache 테이블 추가
- [ ] `lib/db/index.ts` - 새 테이블 초기화 추가

#### 1.2 타입 정의 업데이트
- [ ] `types/account.ts` - OAuth 기반 타입으로 변경
  - AccountStatus: 'expired' 추가
  - CreateAccountRequest: apiKey → token
  - provider 필드 제거
- [ ] `types/usage.ts` 생성 - UsageCache 타입
- [ ] `types/api.ts` - 응답 타입 수정
- [ ] `types/view.ts` 생성 - UsageCardView 타입

#### 1.3 Validation 수정
- [ ] `lib/validation.ts` 생성
  - validateOAuthToken()
  - validateAccountName()
  - maskToken()

---

### Phase 2: Anthropic OAuth Client (0.5일)

#### 2.1 OAuth API 클라이언트
- [ ] `lib/anthropic/` 디렉토리 생성
- [ ] `lib/anthropic/types.ts` - API 응답 타입
  - AnthropicUsageResponse
  - UsageLimit
  - ParsedUsage
- [ ] `lib/anthropic/oauth.ts` - API 클라이언트
  - fetchUsage(token)
  - OAuthError 클래스
- [ ] `lib/anthropic/transform.ts` - 데이터 변환
  - parseUsageResponse()

#### 2.2 테스트
- [ ] OAuth Token으로 실제 API 호출 테스트

---

### Phase 3: Account API 수정 (0.5일)

#### 3.1 기존 API 수정
- [ ] `app/api/accounts/route.ts`
  - GET: usage_cache JOIN하여 반환
  - POST: token 저장, 초기 usage fetch
- [ ] `app/api/accounts/[id]/route.ts`
  - PUT: token 업데이트 시 usage 갱신
  - DELETE: CASCADE로 usage_cache도 삭제

#### 3.2 새 API 추가
- [ ] `app/api/accounts/verify/route.ts` - 토큰 검증
  - POST: token → fetchUsage → preview 반환
- [ ] `app/api/accounts/[id]/refresh/route.ts` - 단일 계정 갱신
  - POST: 해당 계정 usage 갱신
- [ ] `app/api/usage/refresh-all/route.ts` - 전체 갱신
  - POST: 모든 계정 usage 갱신

#### 3.3 DB 헬퍼 수정
- [ ] `lib/db/accounts.ts`
  - getAccountWithUsage()
  - getAllAccountsWithUsage()
  - updateUsageCache()
  - updateAccountStatus()

---

### Phase 4: Dashboard UI (1일)

#### 4.1 Usage 컴포넌트 생성
- [ ] `components/dashboard/UsageProgress.tsx`
  - 프로그레스 바 (색상: normal/warning/critical)
  - 퍼센트 표시
  - 리셋 시간 표시
- [ ] `components/dashboard/UsageCard.tsx`
  - 계정 헤더 (이름, 상태 뱃지)
  - 5시간 limit UsageProgress
  - 7일 limit UsageProgress
  - Opus limit UsageProgress (optional)
- [ ] `components/dashboard/UsageCardGrid.tsx`
  - CSS Grid 레이아웃
  - 빈 상태 처리

#### 4.2 Dashboard 페이지 수정
- [ ] `app/dashboard/page.tsx`
  - v2 컴포넌트 제거 (ProviderTabs, SummaryCards, UsageChart, UserTable)
  - UsageCardGrid로 교체
  - 자동 갱신 로직 추가
- [ ] `components/dashboard/Header.tsx` 수정
  - Last updated 표시
  - Auto-refresh 토글 (선택)

#### 4.3 Hooks 수정
- [ ] `hooks/useUsage.ts` 생성 (useUsageData 대체)
  - 계정 목록 + usage 조회
  - refreshAll()
  - 5분 자동 갱신
- [ ] `hooks/useUsageData.ts` 삭제

---

### Phase 5: Settings UI 수정 (0.5일)

#### 5.1 AddAccountModal 수정
- [ ] `components/settings/AddAccountModal.tsx`
  - Provider 선택 제거 (Claude only)
  - API Key → OAuth Token 입력
  - 토큰 추출 가이드 추가
  - 검증 결과에 usage % 표시

#### 5.2 AccountCard 수정
- [ ] `components/settings/AccountCard.tsx`
  - Provider 아이콘 제거
  - 상태 뱃지: expired 추가
  - 현재 usage % 미리보기 (선택)

#### 5.3 AccountList 수정
- [ ] `components/settings/AccountList.tsx`
  - Provider 그룹핑 제거
  - 단순 리스트로 변경

---

### Phase 6: Testing & Polish (0.5일)

#### 6.1 빌드 및 타입 체크
- [ ] `pnpm build` 통과
- [ ] TypeScript 에러 해결

#### 6.2 기능 테스트
- [ ] 계정 추가 (OAuth Token)
- [ ] 토큰 검증
- [ ] Usage 갱신
- [ ] 자동 갱신
- [ ] 만료된 토큰 처리

#### 6.3 Cleanup
- [ ] v2 코드 제거
  - `lib/providers/` 디렉토리
  - `components/dashboard/ProviderTabs.tsx`
  - `components/dashboard/SummaryCards.tsx`
  - `components/dashboard/UsageChart.tsx`
  - `components/dashboard/UserTable.tsx`
  - `components/dashboard/AccountSelector.tsx`
- [ ] 불필요한 의존성 제거

#### 6.4 문서 업데이트
- [ ] `.env.example` 수정
- [ ] README 업데이트 (선택)

---

## 3. File Changes Summary

### 3.1 New Files

```
lib/
├── anthropic/
│   ├── types.ts
│   ├── oauth.ts
│   └── transform.ts
├── validation.ts

types/
├── usage.ts
└── view.ts

components/dashboard/
├── UsageProgress.tsx
├── UsageCard.tsx
└── UsageCardGrid.tsx

hooks/
└── useUsage.ts

app/api/
├── accounts/
│   └── verify/route.ts
│   └── [id]/refresh/route.ts
└── usage/
    └── refresh-all/route.ts
```

### 3.2 Modified Files

```
lib/db/
├── schema.ts          # v3 스키마
├── index.ts           # 새 테이블 초기화
└── accounts.ts        # 쿼리 함수 수정

types/
├── account.ts         # OAuth 기반으로 변경
├── api.ts             # 응답 타입 변경
└── index.ts           # exports 업데이트

components/
├── dashboard/
│   └── Header.tsx     # Last updated 추가
└── settings/
    ├── AccountList.tsx
    ├── AccountCard.tsx
    └── AddAccountModal.tsx

app/
├── dashboard/page.tsx # 완전히 재작성
└── api/accounts/
    ├── route.ts
    └── [id]/route.ts

.env.example           # OPENAI 관련 제거
```

### 3.3 Deleted Files

```
lib/providers/         # 전체 디렉토리
hooks/useUsageData.ts

components/dashboard/
├── ProviderTabs.tsx
├── SummaryCards.tsx
├── UsageChart.tsx
├── UserTable.tsx
└── AccountSelector.tsx

app/api/
├── claude/            # Admin API 기반
└── openai/            # 미지원
```

---

## 4. Implementation Order

구현 순서 (의존성 기반):

```
1. Database Schema (lib/db/schema.ts)
       ↓
2. Types (types/*.ts)
       ↓
3. Anthropic Client (lib/anthropic/*.ts)
       ↓
4. DB Helpers (lib/db/accounts.ts)
       ↓
5. API Routes (app/api/**/*.ts)
       ↓
6. Hooks (hooks/useUsage.ts)
       ↓
7. UI Components (components/dashboard/*.tsx)
       ↓
8. Pages (app/dashboard/page.tsx)
       ↓
9. Settings UI (components/settings/*.tsx)
       ↓
10. Cleanup & Test
```

---

## 5. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth API 변경 | High | API 버전 헤더 고정, 에러 핸들링 |
| 토큰 만료 | Medium | 만료 상태 표시, 재등록 안내 |
| Rate Limit | Low | 5분 간격 갱신, 수동 갱신 제한 |

---

## 6. Acceptance Criteria

- [ ] OAuth Token으로 계정 등록 가능
- [ ] 사용량 % (5시간, 7일, Opus)이 카드 형태로 표시
- [ ] 리셋 시간이 상대적 시간으로 표시
- [ ] 5분마다 자동 갱신
- [ ] 수동 새로고침 버튼 동작
- [ ] 만료된 토큰 감지 및 표시
- [ ] 빌드 성공
