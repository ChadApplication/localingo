# Next.js + FastAPI 풀스택 스타터 템플릿

인증, 세션 기반 데이터 격리, 비동기 백그라운드 처리, 단계별 워크플로우 인프라가 내장된 프로덕션 수준의 풀스택 스타터 템플릿.

## 사전 요구 사항

- Python 3.12+
- Node.js 18+

## 빠른 시작

```bash
git clone https://github.com/ChadApplication/_template.git
cd _template
./setup.sh          # 원커맨드 설치 (venv + npm + DB + seed)
./run.sh start      # 서버 시작
```

http://localhost:3001 을 열고 `admin` / `admin`으로 로그인합니다.

### 기본 계정

| 사용자명 | 비밀번호 | 역할 |
|----------|----------|------|
| admin | admin | ADMIN |
| guest | guest | GUEST |

### 명령어

```bash
./run.sh start      # Backend + Frontend 시작
./run.sh stop       # 모든 서버 중지
./run.sh restart    # 재시작
./run.sh live       # 시작 + 실시간 로그 스트리밍
```

## 기술 스택
- **Backend:** Python 3.12 / FastAPI
- **Frontend:** Next.js 15 (App Router) / React 19 / TailwindCSS / TypeScript
- **Database:** Prisma ORM / SQLite (기본값)
- **Auth:** NextAuth.js (Credentials Provider)

---

## 핵심 기능

### 1. 인증 (NextAuth + Prisma)
- 이메일/비밀번호 로그인 및 회원가입
- 계정 관리를 위한 `User` 모델
- 클라이언트 및 서버 컴포넌트 간 통합 인증 세션
- **Bearer 토큰 인증** — 백엔드 `verify_token()`이 `Authorization: Bearer {user_id}` 헤더에서 user_id를 추출
- **401 자동 리다이렉트** — 미인증 요청은 401을 반환하고, 프론트엔드가 자동으로 `/login`으로 리다이렉트
- **익명 접근 불가** — `mock_token`이나 누락된 토큰은 거부 (데이터 오염 방지)

### 2. 세션 기반 프로젝트 관리
- 각 "새 분석"은 `temp_uploads/{user_id}/{session_id}/`에 고유한 `session_id` 디렉토리를 생성
- **프로젝트 메타데이터**: 대시보드에 제목, 설명, 생성일, 최종 수정일이 포함된 카드 뷰
- **단계 완료 추적**: `GET /api/session/status`가 결과가 있는 단계를 자동 감지
- **단계별 초기화**: `DELETE /api/step/{step}`으로 다른 단계에 영향 없이 특정 단계 데이터 삭제
- **단계별 복원**: `GET /api/step/{step}/results`로 캐시된 결과를 반환하여 즉시 UI 복원
- **변수 저장**: `POST/GET /api/variables`로 세션별 변수 정의 저장 및 복원

### 3. 비동기 백그라운드 처리
- **Fire-and-forget 패턴** — 장시간 LLM 엔드포인트는 `{status: "processing"}`을 즉시 반환
- **백그라운드 작업 추적** — `llm_tasks` 딕셔너리가 `"{user_id}:{step}"` 키로 단계 간 상태 오염 방지
- **진행률 폴링** — `GET /api/progress?step=X`가 실시간 진행률 + 작업 완료 상태 반환
- **사용자 수준 잠금** — `asyncio.Lock`으로 사용자별 동시 파괴적 작업 방지
- **tqdm 통합** — 진행률 업데이트가 프론트엔드 폴링용 `progress.json`에 기록
- **프록시 타임아웃** — `next.config.ts`에서 `proxyTimeout: 300_000` (5분) 설정

### 4. CSV 안전 처리
- **전역 `to_csv` 몽키패치** — 모든 `DataFrame.to_csv()` 호출이 자동으로 `quoting=csv.QUOTE_ALL` 사용
- 데이터의 특수 문자로 인한 `need to escape, but no escapechar set` 오류 방지

### 5. UI/UX
- **다국어 (i18n)**: 사용자 설정 또는 브라우저 쿠키를 통한 한국어, 영어, 중국어 지원
- **다크 모드**: `next-themes`로 하이드레이션 깜빡임 없음
- **인앱 토스트**: `react-hot-toast`로 모든 피드백 메시지 표시
- **활동 추적기**: 페이지 방문, 버튼 클릭, IP/UserAgent를 DB에 기록

### 6. API 프록시 및 인프라
- **Next.js rewrites**로 `/api/*`를 FastAPI 백엔드로 프록시 (`.run_ports`에서 포트 자동 감지)
- **백엔드 포트 탐색** — `run.sh`가 빈 포트를 찾아 `.run_ports`에 기록, 프론트엔드에서 읽음
- **로그 캡처** — `uvicorn.run(main.app)` 패턴 (`-m uvicorn` 아님)으로 정상적인 stdout 캡처
- **/tmp에 로그 저장** — Dropbox/클라우드 동기화의 로그 버퍼링 간섭 방지

---

## API 엔드포인트

### 세션 관리
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| POST | `/api/sessions` | 새 세션 생성 |
| GET | `/api/sessions` | 사용자의 전체 세션 목록 |
| DELETE | `/api/sessions/{session_id}` | 세션 삭제 |
| GET | `/api/session/status` | 단계 완료 상태 |

### 단계 데이터 (분석 단계별)
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| GET | `/api/step/{step}/results` | 캐시된 단계 결과 조회 |
| DELETE | `/api/step/{step}` | 단계별 파일 삭제 |
| GET | `/api/progress?step=X` | 진행률 + 작업 상태 |

### 데이터 저장
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| POST | `/api/variables` | 변수 정의 저장 |
| GET | `/api/variables` | 변수 정의 불러오기 |
| POST | `/api/research-info` | 연구 메타데이터 저장 |
| GET | `/api/research-info` | 연구 메타데이터 불러오기 |

### 사용자 설정
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| GET | `/api/settings` | 사용자 설정 조회 |
| POST | `/api/settings` | 사용자 설정 저장 |

---

## 빠른 시작

### 1. 클론 및 설정
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. 백엔드 설정
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 프론트엔드 설정
```bash
cd frontend
npm install
npx prisma db push
npx prisma generate
```

### 4. 양쪽 서버 실행
```bash
./run.sh start
```

### 기본 포트
- **Frontend:** http://localhost:3001
- **Backend:** http://localhost:8001
- **API Docs:** http://localhost:8001/docs

### 기타 명령어
```bash
./run.sh stop      # 모든 서버 중지
./run.sh restart   # 모든 서버 재시작
./run.sh status    # 서버 상태 확인
./run.sh live      # 실시간 로그 스트리밍
```

---

## 아키텍처

```
_template_latest/
├── backend/
│   ├── main.py                    # FastAPI 앱 + 세션 인프라
│   ├── app/
│   │   └── routers/
│   │       └── session.py         # 세션 CRUD (Bearer 인증)
│   ├── services/
│   │   └── user_settings_service.py
│   ├── temp_uploads/              # 사용자별, 세션별 데이터 (gitignored)
│   │   └── {user_id}/
│   │       └── {session_id}/
│   │           ├── variables.json
│   │           ├── research_info.json
│   │           ├── *_results.csv
│   │           └── progress.json
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/         # 세션 목록 + 생성
│   │   │   ├── analysis/[id]/     # 작업공간 (분석 단계)
│   │   │   ├── login/
│   │   │   └── admin/
│   │   ├── components/
│   │   ├── services/
│   │   │   └── sessionApi.ts      # Bearer 인증 + 401 리다이렉트
│   │   └── auth.ts                # NextAuth 설정
│   ├── next.config.ts             # 프록시 rewrites + 300초 타임아웃
│   └── package.json
├── run.sh                         # 시작/중지/재시작/실시간 로그
└── .gitignore
```

---

## 새 분석 단계 추가

워크플로우에 새 단계를 추가하려면:

1. **Backend**: `(user_id, session_id, ...)` 시그니처로 서비스 함수 추가
2. **Backend**: `main.py`에서 `_run_llm_in_background()`를 사용하는 비동기 처리 엔드포인트 추가
3. **Frontend**: `getToken` prop, `restoredOnce` 복원 가드, 백엔드 DELETE를 사용하는 `handleReset` 컴포넌트 생성
4. **Frontend**: `step=your_step_name` 파라미터로 진행률 폴링 추가
5. **Backend**: `GET /api/session/status` 및 `DELETE /api/step/{step}` 엔드포인트가 `*_results.csv`/`*_results.json` 패턴의 파일을 자동 감지

---

## 주요 패턴

### 인증 흐름
```
Frontend getToken() → session.user.id
    ↓
Authorization: Bearer {user_id}
    ↓
Backend verify_token() → {"sub": user_id}
    ↓
401 if missing/invalid → Frontend redirects to /login
```

### 비동기 처리 흐름
```
POST /api/your-endpoint → returns {status: "processing"} immediately
    ↓
Background: _run_llm_in_background(user_id, "step_name", service_fn, ...)
    ↓
Frontend polls: GET /api/progress?step=step_name
    ↓
{status: "complete", result: {...}} or {status: "error", error: "..."}
```

### 세션 데이터 격리
```
temp_uploads/
├── user_abc/
│   ├── session_001/     ← 격리된 작업공간
│   │   ├── variables.json
│   │   └── step_results.csv
│   └── session_002/     ← 별도 작업공간
│       └── ...
└── user_xyz/            ← 다른 사용자, 교차 접근 불가
    └── ...
```

## 변경 이력

### v0.0.1 (2026-03-17)

- 초기 공개 릴리스
- macOS bash 3.2 호환성 수정 (run.sh)
- Python 3.12.8 마이그레이션
- DB 시드 자동화 (admin/guest 계정, setup.sh)
- dev.db를 git 추적에서 제거
- 자동 버전 표시 저작권 푸터
- setup.sh 원커맨드 설치

## 라이선스

Copyright (c) chadchae
