# Product Requirements Document (PRD) v3

## Multi-AI Usage Dashboard - OAuth-based Usage Tracking

**Version**: 3.0  
**Date**: 2026-02-01  
**Author**: Engineering Team  
**Status**: Draft

---

## 1. Overview

### 1.1 Version Summary

v3에서는 Admin API Key 기반에서 **OAuth Token 기반 사용량 추적**으로 전환합니다.
Claude Code가 내부적으로 사용하는 동일한 API를 활용하여 Individual 계정도 지원합니다.

### 1.2 Problem Statement (v2의 한계)

- Admin API Key는 Organization 계정에서만 발급 가능
- Individual 사용자는 Admin API를 사용할 수 없음
- 실제 사용량 추적이 불가능한 개인 사용자 다수 존재

### 1.3 Discovery

Claude Code CLI의 `/usage` 명령어가 사용하는 내부 API를 역분석:

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <oauth_token>
```

이 API는 OAuth Token만 있으면 호출 가능하며, Individual 계정도 사용 가능.

### 1.4 Goals (v3)

| Goal | Metric |
|------|--------|
| Individual 계정 지원 | OAuth Token 기반 인증 |
| 퍼센트 기반 사용량 표시 | 5시간/7일 limit 시각화 |
| 멀티 계정 통합 뷰 | 한 화면에서 여러 계정 모니터링 |
| 자동 갱신 | 주기적 사용량 업데이트 |

---

## 2. Changes from v2

### 2.1 Feature Comparison

| Feature | v2 | v3 |
|---------|----|----|
| 인증 방식 | Admin API Key | OAuth Token |
| 계정 유형 | Organization only | Individual + Organization |
| 데이터 형식 | 토큰 수, 비용 ($) | 퍼센트 (%, limit 기준) |
| 사용자별 breakdown | 지원 | 미지원 (계정 단위) |
| API 엔드포인트 | Admin API | `/api/oauth/usage` |

### 2.2 Architecture Change

```
v2: Admin API Key → Admin API → Token counts, costs

v3: OAuth Token → /api/oauth/usage → Percentage-based limits
    (Claude Code와 동일한 방식)
```

### 2.3 Data Model Change

```
v2 Response (Admin API):
{
  "users": [...],
  "total_tokens": 1500000,
  "estimated_cost": { "amount": "15.00", "currency": "USD" }
}

v3 Response (OAuth API):
{
  "five_hour": { "utilization": 40.0, "resets_at": "..." },
  "seven_day": { "utilization": 76.0, "resets_at": "..." },
  "seven_day_opus": { "utilization": 0.0, "resets_at": null }
}
```

---

## 3. Functional Requirements

### 3.1 계정 관리 (Modified from v2)

#### FR-010: 계정 목록 조회
- 등록된 모든 Claude 계정 목록 표시
- 각 계정의 연결 상태 표시 (Connected / Error / Expired)
- 현재 사용량 % 미리보기

#### FR-011: 계정 추가 (NEW - OAuth 기반)

**방법 1: 토큰 직접 입력**
- OAuth Access Token 직접 붙여넣기
- 토큰 유효성 검증 후 저장

**방법 2: Keychain에서 가져오기 (macOS only)**
- `security find-generic-password -s "Claude Code-credentials" -w` 실행
- 자동으로 토큰 추출 및 저장

**방법 3: Claude Code 로그인 안내**
- Claude Code 로그인 방법 안내
- 로그인 후 토큰 추출 가이드 제공

#### FR-012: 계정 별칭 수정
- 계정 이름(별칭) 변경
- 토큰 갱신 (만료 시)

#### FR-013: 계정 삭제
- 삭제 확인 다이얼로그
- 저장된 토큰 삭제

#### FR-014: 토큰 유효성 검증
- `/api/oauth/usage` 호출하여 토큰 확인
- 만료된 토큰 감지 및 알림

### 3.2 대시보드 (NEW)

#### FR-020: 통합 사용량 뷰
- 모든 계정의 사용량을 한 화면에 표시
- 계정별 카드 형태로 시각화

```
┌─────────────────────────────────────────────────────────┐
│                  Usage Dashboard                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ 🟣 Personal      │  │ 🟣 Work Account  │              │
│  │                  │  │                  │              │
│  │ 5-Hour Limit     │  │ 5-Hour Limit     │              │
│  │ ████████░░ 78%   │  │ ██░░░░░░░░ 15%   │              │
│  │ Resets: 2h 30m   │  │ Resets: 4h 15m   │              │
│  │                  │  │                  │              │
│  │ Weekly Limit     │  │ Weekly Limit     │              │
│  │ ██████░░░░ 56%   │  │ ████░░░░░░ 35%   │              │
│  │ Resets: 5 days   │  │ Resets: 6 days   │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### FR-021: 자동 갱신
- 5분 간격으로 사용량 자동 업데이트
- 마지막 업데이트 시간 표시
- 수동 새로고침 버튼

#### FR-022: 리셋 시간 표시
- 각 limit의 리셋 시간을 상대적 시간으로 표시
- "Resets in 2h 30m" 또는 "Resets Feb 5, 3:59am"

#### FR-023: 경고 표시
- 80% 이상: 주의 (노란색)
- 95% 이상: 위험 (빨간색)
- 리셋 임박 시 알림

### 3.3 제거된 기능 (v2 대비)

- ❌ 사용자별 breakdown (Admin API 전용)
- ❌ 토큰 수 상세 (input/output)
- ❌ 비용 계산 ($)
- ❌ 시계열 차트 (historical data 없음)
- ❌ OpenAI 지원 (Claude만 지원)

---

## 4. Non-Functional Requirements

### 4.1 Security

| Requirement | Implementation |
|-------------|----------------|
| OAuth Token 암호화 | AES-256-GCM 저장 |
| Token 노출 방지 | 서버에서만 복호화 |
| Refresh Token 미저장 | Access Token만 저장 |

### 4.2 Performance

| Requirement | Target |
|-------------|--------|
| API 호출 간격 | 최소 5분 (rate limit 고려) |
| 응답 시간 | < 2초 |
| 동시 계정 수 | 최대 10개 |

### 4.3 Compatibility

| Platform | Token 추출 방법 |
|----------|----------------|
| macOS | Keychain (`security` 명령어) |
| Linux | `~/.claude/credentials` 또는 직접 입력 |
| Windows | Credential Manager 또는 직접 입력 |

---

## 5. User Interface

### 5.1 Screen Flow

```
[로그인 페이지]
       │
       ▼
[대시보드 메인] ◄────────────────┐
   │                             │
   │  [Usage Cards Grid]         │
   │  - Account 1 card           │
   │  - Account 2 card           │
   │  - ...                      │
   │                             │
   └── [Settings] ───────────────┤
         │                       │
         ├── [Account List]      │
         │     ├── [Add Account] ┘
         │     ├── [Edit Account]
         │     └── [Remove Account]
         │
         └── [Refresh Settings]
```

### 5.2 Dashboard Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Usage Monitor              [↻ Refresh] [⚙️ Settings] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Last updated: 2 mins ago                    Auto-refresh: ON│
│                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐     │
│  │ 🟣 Personal Account     │  │ 🟣 Company Account      │     │
│  │    dongjae@email.com    │  │    work@company.com     │     │
│  │                         │  │                         │     │
│  │ 5-Hour Session          │  │ 5-Hour Session          │     │
│  │ ████████████████████░░  │  │ ████░░░░░░░░░░░░░░░░░░  │     │
│  │ 78% used                │  │ 15% used                │     │
│  │ ⏱ Resets in 2h 30m      │  │ ⏱ Resets in 4h 15m      │     │
│  │                         │  │                         │     │
│  │ Weekly (All Models)     │  │ Weekly (All Models)     │     │
│  │ ████████████░░░░░░░░░░  │  │ ████████░░░░░░░░░░░░░░  │     │
│  │ 56% used                │  │ 35% used                │     │
│  │ ⏱ Resets in 5 days      │  │ ⏱ Resets in 6 days      │     │
│  │                         │  │                         │     │
│  │ Weekly (Sonnet Only)    │  │ Weekly (Sonnet Only)    │     │
│  │ ░░░░░░░░░░░░░░░░░░░░░░  │  │ ░░░░░░░░░░░░░░░░░░░░░░  │     │
│  │ 0% used                 │  │ 0% used                 │     │
│  │                         │  │                         │     │
│  │ ✅ Connected             │  │ ✅ Connected             │     │
│  └────────────────────────┘  └────────────────────────┘     │
│                                                              │
│  [+ Add Account]                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Add Account Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Add Account                                          [X]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Account Name                                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ e.g., Personal, Work, Client Project                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  OAuth Token                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ sk-ant-oat01-...                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ℹ️ How to get your OAuth token:                             │
│                                                              │
│  1. Open Claude Code CLI and log in                          │
│  2. Run this command in terminal:                            │
│     ┌────────────────────────────────────────────────────┐  │
│     │ security find-generic-password \                    │  │
│     │   -s "Claude Code-credentials" -w | \               │  │
│     │   jq -r '.claudeAiOauth.accessToken'                │  │
│     └────────────────────────────────────────────────────┘  │
│  3. Copy the token and paste above                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ✅ Token verified successfully                        │    │
│  │    5-Hour: 45% | Weekly: 23%                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│                              [Cancel]  [Verify]  [Save]      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Data Requirements

### 6.1 Account Entity (Modified)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | 고유 식별자 |
| `name` | String | 계정 별칭 |
| `tokenEncrypted` | String | 암호화된 OAuth Access Token |
| `tokenHint` | String | 마스킹된 토큰 (UI 표시용) |
| `status` | Enum | 'connected' \| 'error' \| 'expired' |
| `lastError` | String? | 마지막 에러 메시지 |
| `lastSyncAt` | DateTime? | 마지막 동기화 시간 |
| `createdAt` | DateTime | 생성 시간 |
| `updatedAt` | DateTime | 수정 시간 |

### 6.2 Usage Data (Cached)

| Field | Type | Description |
|-------|------|-------------|
| `accountId` | UUID | 계정 FK |
| `fiveHourUtilization` | Float | 5시간 사용률 (0-100) |
| `fiveHourResetsAt` | DateTime | 5시간 리셋 시간 |
| `sevenDayUtilization` | Float | 7일 사용률 (0-100) |
| `sevenDayResetsAt` | DateTime | 7일 리셋 시간 |
| `sevenDayOpusUtilization` | Float? | Opus 전용 사용률 |
| `sevenDayOpusResetsAt` | DateTime? | Opus 리셋 시간 |
| `fetchedAt` | DateTime | 데이터 수집 시간 |

### 6.3 Environment Variables

```bash
# Authentication (유지)
DASHBOARD_PASSWORD=your-secure-password-here

# Encryption (유지)
ENCRYPTION_KEY=64-char-hex-string

# v3 제거됨
# ANTHROPIC_ADMIN_API_KEY (불필요)
# OPENAI_ADMIN_API_KEY (미지원)
```

---

## 7. API Design

### 7.1 External API (Anthropic)

```
GET https://api.anthropic.com/api/oauth/usage
Headers:
  Authorization: Bearer <oauth_token>
  anthropic-beta: oauth-2025-04-20
  User-Agent: claude-code/2.0.32

Response:
{
  "five_hour": {
    "utilization": 40.0,
    "resets_at": "2025-02-01T10:59:59+00:00"
  },
  "seven_day": {
    "utilization": 76.0,
    "resets_at": "2025-02-05T03:59:59+00:00"
  },
  "seven_day_oauth_apps": null,
  "seven_day_opus": {
    "utilization": 0.0,
    "resets_at": null
  },
  "iguana_necktie": null
}
```

### 7.2 Internal API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | 계정 목록 (usage 포함) |
| POST | `/api/accounts` | 계정 추가 |
| PUT | `/api/accounts/:id` | 계정 수정 |
| DELETE | `/api/accounts/:id` | 계정 삭제 |
| POST | `/api/accounts/:id/refresh` | 사용량 갱신 |
| POST | `/api/accounts/verify` | 토큰 검증 |
| POST | `/api/usage/refresh-all` | 전체 갱신 |

---

## 8. Migration from v2

### 8.1 Breaking Changes

- Admin API Key 기반 계정 → 삭제 (호환 불가)
- OpenAI 계정 → 삭제 (미지원)
- 토큰/비용 데이터 → 삭제 (데이터 모델 변경)

### 8.2 Migration Steps

1. v2 accounts 테이블 백업
2. 새 스키마로 테이블 재생성
3. 사용자에게 OAuth 토큰으로 재등록 안내

---

## 9. Out of Scope (v3)

- OpenAI 지원 (다른 인증 방식 필요)
- 토큰 수 / 비용 추적 (Admin API 필요)
- 사용자별 breakdown (Admin API 필요)
- 히스토리 / 트렌드 차트 (데이터 없음)
- Refresh Token 자동 갱신 (보안 이슈)
- Linux/Windows Keychain 자동 추출

---

## 10. Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Design | 완료 | PRD v3, SDD v3, Entity Design v3 |
| Schema Migration | 0.5일 | DB 스키마 변경 |
| Account API | 0.5일 | OAuth 기반 CRUD |
| Usage Fetcher | 0.5일 | Anthropic API 연동 |
| Dashboard UI | 1일 | Usage Cards, 자동 갱신 |
| Settings UI | 0.5일 | 계정 관리 페이지 수정 |
| Testing | 0.5일 | 통합 테스트 |

**총 예상: 3.5일**

---

## Appendix

### A. OAuth Token 형식

```
sk-ant-oat01-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

- Prefix: `sk-ant-oat01-`
- 총 길이: 약 100자
- 만료: 약 30일 (갱신 필요)

### B. Rate Limit Categories

| Limit | Reset 주기 | 설명 |
|-------|-----------|------|
| `five_hour` | 5시간 | 세션 기반 limit |
| `seven_day` | 7일 | 주간 전체 모델 limit |
| `seven_day_opus` | 7일 | Opus 모델 전용 limit |

### C. Token 추출 방법 (Platform별)

**macOS:**
```bash
security find-generic-password -s "Claude Code-credentials" -w | jq -r '.claudeAiOauth.accessToken'
```

**Linux:**
```bash
cat ~/.claude/.credentials | jq -r '.claudeAiOauth.accessToken'
```

**Windows (PowerShell):**
```powershell
# Credential Manager에서 수동 추출 필요
```
