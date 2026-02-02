# Product Requirements Document (PRD) v2

## Multi-AI Usage Dashboard - Account Management

**Version**: 2.0  
**Date**: 2026-01-31  
**Author**: Engineering Team  
**Status**: Draft

---

## 1. Overview

### 1.1 Version Summary

v2에서는 환경변수 기반 API Key 관리에서 **대시보드 내 계정 등록 방식**으로 전환합니다.

### 1.2 Problem Statement (v1의 한계)

- 환경변수 변경 시 서버 재시작 필요
- 단일 조직 계정만 지원
- 비개발자가 API Key를 설정하기 어려움
- 여러 조직의 사용량을 한 대시보드에서 볼 수 없음

### 1.3 Goals (v2)

| Goal | Metric |
|------|--------|
| 다중 계정 지원 | 여러 조직의 Claude/OpenAI 계정 등록 가능 |
| 사용자 친화적 설정 | UI를 통한 계정 추가/수정/삭제 |
| 보안 | API Key 암호화 저장 |
| 운영 편의성 | 서버 재시작 없이 계정 관리 |

---

## 2. Changes from v1

### 2.1 Feature Comparison

| Feature | v1 | v2 |
|---------|----|----|
| API Key 저장 | 환경변수 | 암호화된 DB 저장 |
| 계정 수 | 1개씩 (Claude, OpenAI) | 무제한 |
| 설정 방법 | .env 파일 수정 | UI에서 등록 |
| 서버 재시작 | 필요 | 불필요 |
| 연결 상태 확인 | ❌ | ✅ 실시간 확인 |
| 다중 조직 | ❌ | ✅ 지원 |

### 2.2 Architecture Change

```
v1: 환경변수 → API Client → External API

v2: UI → Account API → Encrypted DB → API Client → External API
```

---

## 3. Functional Requirements (New/Changed)

### 3.1 Settings 페이지 (NEW)

#### FR-010: 계정 목록 조회
- 등록된 모든 AI 서비스 계정 목록 표시
- Provider별 그룹핑 (Claude, OpenAI, ...)
- 각 계정의 연결 상태 표시 (Connected / Error / Checking)
- 마지막 동기화 시간 표시

#### FR-011: 계정 추가
- Provider 선택 (Claude Code, OpenAI)
- 계정 별칭 입력 (e.g., "Acme Corp - Production")
- Admin API Key 입력
- 저장 전 연결 테스트 (API Key 유효성 검증)
- 성공 시 암호화하여 저장

#### FR-012: 계정 수정
- 계정 별칭 변경
- API Key 변경 (마스킹된 형태로 표시)
- 변경 전 연결 테스트

#### FR-013: 계정 삭제
- 삭제 확인 다이얼로그
- 관련 캐시 데이터 삭제

#### FR-014: 연결 상태 확인
- 수동 연결 테스트 버튼
- API Key 유효성 및 권한 확인
- 에러 시 상세 메시지 표시

### 3.2 대시보드 변경 (MODIFIED)

#### FR-002: 대시보드 메인 (수정)
- 계정이 없으면 "계정을 추가하세요" 안내 표시
- 등록된 계정별로 탭 또는 드롭다운 선택
- 여러 계정 데이터 통합 뷰 (선택적)

#### FR-015: 계정별 데이터 조회
- 특정 계정 선택 시 해당 계정의 사용량만 표시
- 계정 간 전환 시 데이터 캐싱 유지

---

## 4. Non-Functional Requirements (Updated)

### 4.1 Security (강화)

| Requirement | Implementation |
|-------------|----------------|
| API Key 암호화 | AES-256-GCM 암호화 저장 |
| 암호화 키 관리 | 환경변수로 마스터 키 설정 |
| API Key 마스킹 | UI에서 `sk-***...***abc` 형태로 표시 |
| 클라이언트 노출 방지 | API Key는 서버에서만 복호화 |

### 4.2 Data Persistence

| Requirement | Implementation |
|-------------|----------------|
| 저장소 | SQLite (파일 기반, 서버리스) |
| 백업 | DB 파일 단일 백업 가능 |
| 마이그레이션 | 자동 스키마 마이그레이션 |

---

## 5. User Interface

### 5.1 Screen Flow (Updated)

```
[로그인 페이지]
       │
       ▼
[대시보드 메인] ◄─────────────────┐
  │                               │
  ├── [Tab: Account 1]            │
  ├── [Tab: Account 2]            │
  ├── ...                         │
  │                               │
  └── [Settings] ─────────────────┤
        │                         │
        ├── [Account List]        │
        │     ├── [Add Account] ──┘
        │     ├── [Edit Account]
        │     └── [Delete Account]
        │
        └── [General Settings]
```

### 5.2 Settings Page Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                    [← Back]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Accounts                                                   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟣 Claude Code                                       │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ Acme Corp - Production          ✅ Connected   │ │   │
│  │  │ sk-ant-admin-***...***xyz                      │ │   │
│  │  │ Last sync: 5 mins ago        [Test] [Edit] [X] │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ Beta Team                       ⚠️ Error       │ │   │
│  │  │ sk-ant-admin-***...***def                      │ │   │
│  │  │ Error: Invalid API Key       [Test] [Edit] [X] │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟢 OpenAI                                            │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ Main Account                    ✅ Connected   │ │   │
│  │  │ sk-admin-***...***abc                          │ │   │
│  │  │ Last sync: 2 mins ago        [Test] [Edit] [X] │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [+ Add Account]                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Add Account Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Add Account                                          [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Provider                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ▼ Claude Code                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Account Name                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ e.g., Acme Corp - Production                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Admin API Key                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ sk-ant-admin-...                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ℹ️ Get your Admin API Key from:                           │
│     Claude: console.anthropic.com/settings/admin-keys      │
│     OpenAI: platform.openai.com/settings/admin-keys        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ Connection test successful                        │   │
│  │    Organization: Acme Corporation                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Cancel]  [Test Connection]    │
│                                        [Save Account]       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Dashboard with Multiple Accounts

```
┌─────────────────────────────────────────────────────────────┐
│  AI Usage Dashboard                   [⚙️ Settings] [Logout] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Account: [▼ Acme Corp - Production (Claude)        ]       │
│           ┌─────────────────────────────────────────┐       │
│           │ Acme Corp - Production (Claude)     ✅ │       │
│           │ Beta Team (Claude)                  ⚠️ │       │
│           │ Main Account (OpenAI)              ✅ │       │
│           │ ─────────────────────────────────────  │       │
│           │ 📊 All Accounts (Combined View)        │       │
│           └─────────────────────────────────────────┘       │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │ Tokens  │  │  Cost   │  │  Users  │                     │
│  │  1.2M   │  │  $320   │  │    8    │                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│                                                             │
│  ... (차트, 테이블 등)                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Data Requirements (Updated)

### 6.1 Account Entity (NEW)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | 고유 식별자 |
| `provider` | Enum | 'claude' \| 'openai' |
| `name` | String | 계정 별칭 |
| `apiKeyEncrypted` | String | 암호화된 API Key |
| `apiKeyHint` | String | 마스킹된 키 (UI 표시용) |
| `status` | Enum | 'connected' \| 'error' \| 'unknown' |
| `lastError` | String? | 마지막 에러 메시지 |
| `lastSyncAt` | DateTime? | 마지막 동기화 시간 |
| `createdAt` | DateTime | 생성 시간 |
| `updatedAt` | DateTime | 수정 시간 |

### 6.2 Environment Variables (Updated)

```bash
# v1에서 유지
DASHBOARD_PASSWORD=your-secure-password-here

# v2에서 추가
ENCRYPTION_KEY=32-byte-hex-string-for-aes-256

# v2에서 제거 (DB로 이동)
# ANTHROPIC_ADMIN_API_KEY (제거)
# OPENAI_ADMIN_API_KEY (제거)
```

---

## 7. API Changes

### 7.1 New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | 계정 목록 조회 |
| POST | `/api/accounts` | 계정 추가 |
| PUT | `/api/accounts/:id` | 계정 수정 |
| DELETE | `/api/accounts/:id` | 계정 삭제 |
| POST | `/api/accounts/:id/test` | 연결 테스트 |
| POST | `/api/accounts/test` | 새 API Key 테스트 |

### 7.2 Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /api/claude/usage` | `accountId` 파라미터 추가 |
| `GET /api/openai/usage` | `accountId` 파라미터 추가 |

---

## 8. Migration Path

### 8.1 v1 → v2 마이그레이션

1. **환경변수 API Key 자동 마이그레이션**
   - v1 환경변수에 API Key가 있으면 자동으로 DB에 등록
   - "Default Account (Migrated)" 이름으로 생성
   - 마이그레이션 후 환경변수는 선택적 유지 가능

2. **하위 호환성**
   - 환경변수 API Key가 있으면 계속 사용 가능
   - DB 계정이 없을 때 환경변수 fallback

---

## 9. Out of Scope (v2)

- OAuth 로그인 (기술적 제약)
- 계정별 권한 관리 (읽기/쓰기 분리)
- 팀 멤버 초대 기능
- 계정 사용량 제한 설정
- 알림 기능

---

## 10. Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Design | 완료 | PRD v2, SDD v2, Entity Design v2 |
| Database Setup | 0.5일 | SQLite + Prisma 설정 |
| Account API | 1일 | CRUD + 암호화 구현 |
| Settings UI | 1일 | 계정 관리 페이지 |
| Dashboard Update | 0.5일 | 계정 선택 기능 |
| Migration | 0.5일 | v1 → v2 마이그레이션 |
| Testing | 0.5일 | 통합 테스트 |

**총 예상: 4일**

---

## Appendix

### A. API Key 발급 가이드 링크

| Provider | URL |
|----------|-----|
| Claude (Anthropic) | https://console.anthropic.com/settings/admin-keys |
| OpenAI | https://platform.openai.com/settings/organization/admin-keys |

### B. 보안 고려사항

1. **암호화 키 관리**
   - `ENCRYPTION_KEY`는 반드시 환경변수로 설정
   - 32바이트 (256비트) 랜덤 키 사용
   - 키 로테이션 정책 고려

2. **API Key 노출 방지**
   - 응답에서 전체 API Key 반환 금지
   - 로그에 API Key 기록 금지
   - 클라이언트 사이드에서 복호화 금지
