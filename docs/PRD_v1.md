# Product Requirements Document (PRD) v1

## Multi-AI Usage Dashboard

**Version**: 1.0  
**Date**: 2026-01-30  
**Author**: Engineering Team

---

## 1. Overview

### 1.1 Product Summary

사내에서 운용 중인 여러 AI 서비스(Claude Code, OpenAI GPT 등)의 사용량을 한 눈에 모니터링할 수 있는 통합 대시보드.

### 1.2 Problem Statement

- 여러 AI 서비스를 사용하면서 각 서비스별로 콘솔에 접속해야 사용량 확인 가능
- 사용자별 사용량 파악이 어려움
- 비용 추이를 실시간으로 파악하기 어려움
- 팀 전체의 AI 사용 패턴을 분석할 수 없음

### 1.3 Goals

| Goal | Metric |
|------|--------|
| 사용량 가시성 | 모든 AI 서비스 사용량을 단일 화면에서 확인 |
| 비용 관리 | 일/주/월 단위 비용 추이 시각화 |
| 사용자 분석 | 사용자별 사용량 및 비용 breakdown |
| 운영 효율성 | 콘솔 접속 없이 즉시 현황 파악 |

---

## 2. Target Users

### 2.1 Primary Users

| User Type | Needs |
|-----------|-------|
| Engineering Manager | 팀 전체 AI 사용량 및 비용 모니터링 |
| DevOps/Platform Team | AI 서비스 운영 현황 파악 |
| Finance/Admin | 월별 비용 리포트 확인 |

### 2.2 Access Control

- **인증 방식**: 단일 비밀번호 (환경변수 기반)
- **접근 범위**: 사내 네트워크 또는 VPN 환경 권장

---

## 3. Functional Requirements

### 3.1 지원 AI 서비스

| Priority | Service | API Availability |
|----------|---------|------------------|
| P0 (MVP) | Claude Code | Anthropic Admin API (`/v1/organizations/usage_report/claude_code`) |
| P0 (MVP) | OpenAI GPT | OpenAI Admin API (`/v1/organization/usage/completions`, `/costs`) |
| P1 | 추가 서비스 | 확장 가능한 구조로 설계 |

### 3.2 Core Features

#### FR-001: 로그인/인증
- 단일 비밀번호 입력으로 접근
- 세션 유지 (cookie 기반)
- 세션 만료 시 자동 로그아웃

#### FR-002: 대시보드 메인
- 서비스별 탭 전환 (Claude, OpenAI, ...)
- 통합 비용 요약 표시

#### FR-003: 요약 카드
각 서비스별로 다음 정보 표시:
- 총 토큰 사용량 (기간 내)
- 총 비용 (USD)
- 활성 사용자 수

#### FR-004: 시간대별 추이 차트
- 일별 사용량/비용 라인 차트
- 기간 선택: 7일 / 14일 / 30일
- 호버 시 상세 수치 표시

#### FR-005: 사용자별 통계 테이블
- 사용자 식별자 (이메일 또는 API Key)
- 토큰 사용량
- 비용
- 세션 수 (Claude Code)
- 도구 수락률 (Claude Code)
- 정렬 및 필터링

#### FR-006: 데이터 새로고침
- 수동 새로고침 버튼
- 자동 새로고침 간격 설정 (선택적)

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target |
|--------|--------|
| Initial Load | < 3초 |
| API Response | < 5초 (외부 API 의존) |
| 차트 렌더링 | < 1초 |

### 4.2 Security

- Admin API Key는 서버 사이드에서만 사용 (클라이언트 노출 금지)
- 환경변수로 민감 정보 관리
- HTTPS 필수

### 4.3 Reliability

- API 실패 시 graceful degradation (에러 메시지 표시)
- 캐싱을 통한 API 호출 최소화 (권장: 1분 간격)

### 4.4 Scalability

- 새로운 AI 서비스 추가가 용이한 구조
- Provider별 모듈화

---

## 5. Data Requirements

### 5.1 Claude Code (Anthropic Admin API)

**Endpoint**: `GET /v1/organizations/usage_report/claude_code`

| Field | Description | Usage |
|-------|-------------|-------|
| `email_address` | 사용자 이메일 | 사용자 식별 |
| `num_sessions` | 세션 수 | 활동량 지표 |
| `tokens.input/output` | 토큰 사용량 | 사용량 지표 |
| `estimated_cost.amount` | 예상 비용 (센트) | 비용 지표 |
| `edit_tool.accepted/rejected` | 도구 수락/거절 | 수락률 계산 |

**Authentication**: Admin API Key (`sk-ant-admin-...`)

### 5.2 OpenAI (OpenAI Admin API)

**Endpoints**:
- `GET /v1/organization/usage/completions`
- `GET /v1/organization/costs`

| Field | Description | Usage |
|-------|-------------|-------|
| `user_id` / `api_key_id` | 사용자/키 식별 | 사용자 식별 |
| `input_tokens` / `output_tokens` | 토큰 사용량 | 사용량 지표 |
| `amount.value` | 비용 (USD) | 비용 지표 |
| `model` | 모델명 | 모델별 분석 |

**Authentication**: Admin API Key (`sk-admin-...`)

---

## 6. User Interface

### 6.1 Screen Flow

```
[로그인 페이지]
       │
       ▼
[대시보드 메인]
  ├── [Tab: Claude Code]
  │     ├── 요약 카드
  │     ├── 시간별 차트
  │     └── 사용자 테이블
  ├── [Tab: OpenAI]
  │     ├── 요약 카드
  │     ├── 시간별 차트
  │     └── 사용자 테이블
  └── [통합 비용 요약]
```

### 6.2 Wireframe

```
┌─────────────────────────────────────────────────────────┐
│  AI Usage Dashboard                    [Refresh] [Logout]│
├─────────────────────────────────────────────────────────┤
│  [Claude Code]  [OpenAI]  [+ Add Service]               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │ Tokens  │  │  Cost   │  │  Users  │                 │
│  │  1.2M   │  │  $320   │  │    8    │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
├─────────────────────────────────────────────────────────┤
│  Usage Trend                    [7d] [14d] [30d]       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇                          │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  User Statistics                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ User          │ Tokens │ Cost  │ Sessions │ Rate │   │
│  │ user-a@co.com │ 500K   │ $150  │ 45       │ 87%  │   │
│  │ user-b@co.com │ 300K   │ $95   │ 32       │ 92%  │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Total Cost: Claude $320 + OpenAI $180 = $500          │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Technical Constraints

### 7.1 API Limitations

| Service | Constraint |
|---------|------------|
| Claude Admin API | 1분당 1회 polling 권장 |
| OpenAI Admin API | Pagination 필수 (has_more 처리) |
| Both | Organization 계정 필요, Admin Key 별도 발급 |

### 7.2 Data Freshness

| Service | Latency |
|---------|---------|
| Claude Code | ~1시간 |
| OpenAI | ~5분 |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| 대시보드 일일 조회 | > 5회/일 |
| 사용자 만족도 | 기존 콘솔 대비 편의성 향상 |
| 비용 인지도 | 팀 비용 현황 파악 시간 < 1분 |

---

## 9. Out of Scope (v1)

- 알림/경고 기능 (비용 임계치 초과 시)
- 사용자 권한 관리 (역할 기반)
- 데이터 내보내기 (CSV/Excel)
- 예산 설정 및 관리
- Slack/Teams 연동

---

## 10. Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Design | 완료 | PRD, SDD, Entity 설계 |
| MVP Development | 1주 | 핵심 기능 구현 |
| Testing | 2일 | QA 및 버그 수정 |
| Deployment | 1일 | 프로덕션 배포 |

---

## Appendix

### A. API Reference Links

- [Anthropic Admin API](https://docs.anthropic.com/en/docs/administration/administration-api)
- [Anthropic Claude Code Analytics](https://docs.anthropic.com/en/build-with-claude/claude-code-analytics-api)
- [OpenAI Usage API](https://platform.openai.com/docs/api-reference/usage)
- [OpenAI Admin Keys](https://platform.openai.com/docs/api-reference/admin-api-keys)
