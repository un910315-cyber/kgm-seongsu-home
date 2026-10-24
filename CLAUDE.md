# KGM 성수서비스센터 사이트

GitHub Pages로 배포되는 정적 사이트. 회사 대표 페이지 + 임원 디지털 명함 4종 + 내부용 관리 페이지로 구성.

## 배포

- **Remote**: `github.com/un910315-cyber/kgm-seongsu-home` (master 브랜치)
- **Live**: `https://kgm-seongsu.co.kr` (CNAME 연결됨)
- Push → GitHub Pages 자동 빌드, 약 1~2분 내 반영

## 디렉토리 구조

```
/index.html              # 메인 랜딩 페이지
/digital-card/           # 박경영 총괄이사 카드  ※접미사 없음이 박경영
/digital-card-lee/       # 이동근 정비팀장 카드
/digital-card-yang/      # 양은주 대표이사 카드
/digital-card-yoon/      # 윤유현 부장 카드
/un/                     # 내부용 관리 페이지 (아래 "내부용 페이지" 참고)
/un/repair-guide/        # 입고 및 수리 안내 직원 화면 (내부 페이지 안 iframe)
/repair-guide/           # 고객이 받는 안내 화면 (공개)
/repair-functions/       # 안내 발송용 Cloud Functions (솔라피 연동)
/un-v2/                  # 예전 실험 디자인. 운영 /un/과 별개, 건드리지 않음
/kakao-qr/               # 카카오톡 QR 페이지
/tools/backup/           # 데이터 백업, DB 규칙 빌드·게시 도구
/tests/                  # 회귀 테스트 (node tests/<이름>.cjs)
/CNAME                   # 커스텀 도메인 설정 (명시적 요청 없이 변경 금지)
```

각 디지털 명함 폴더: `index.html` + og 이미지(`og-preview-v2.png`).

## 내부용 페이지 (`/un/`)

빌드 도구 없는 정적 파일. Firebase(Auth + Realtime DB + Firestore) 기반. 2026-05에 단일 HTML에서 여러 파일로 나뉨.

| 파일 | 역할 |
|---|---|
| `un/index.html` | 화면 구조·메뉴·팝업. 맨 위 인라인 코드는 서비스워커 버전 확인(배포 직후 1회 새로고침) |
| `un/app-module.js` | ES 모듈. 로그인·역할(`ROLE_MENUS`)·실시간 구독·차량/연차/연락처 등 핵심 |
| `un/app-pages.js` | 페이지 전환(`switchPage`), 메뉴 키보드 조작, 팝업 접근성, 사이드바 배치 |
| `un/app-features.js` | 부가 기능, 서비스워커 등록 |
| `un/app-insurance.js` / `app-maintenance.js` / `app-ops-calendar.js` / `app-workcodes-ui.js` | 보험 미결·긴급 정비(메뉴 숨김)·실적 달력·작업코드표 |
| `un/styles.css` | 기본 스타일(예전 다크 테마) |
| `un/design-refresh.css` | 화면 전용 덮어쓰기 층: 네이비 색, 상태 색 토큰(`--st-*`), 차트 색(`--c-*`), 휴대폰 배치. 색·배치 수정은 여기서 |
| `un/sw.js` | 서비스워커. `CACHE_VERSION`과 index.html의 `?v=`·`PAGE_VERSION`을 같은 문자열로 함께 올림 |

### 역할 체계

Firestore `users/{email}.role` 필드:

| 키 | 라벨 | 접근 메뉴 |
|---|---|---|
| `admin` | 👑 관리자 | 전체 (대시보드·매출 보고·보험 미결·예약 현황판·실적 달력·수리 안내·사용자 관리 포함) |
| `staff` | 🔧 Staff 1단계 | status, complete, leave, board, estimate, insurance, vendors |
| `viewer` | 👤 Staff 2단계 | status, complete, leave, board, vendors |

정확한 목록은 `un/app-module.js`의 `ROLE_MENUS`. 라벨 상수 `_RL`/`_RD`/`_RC`와 역할 드롭다운 3곳(접근요청 승인, 승인된 사용자 편집, 승인 직전 선택)이 중복이라 라벨/옵션 변경 시 함께 수정.

### 탭 노출과 접근

- 메뉴 노출: 인증 후 `ROLE_MENUS` 기반 루프가 `.nav-tab` show/hide.
- 페이지 진입: `switchPage()`가 `window._canAccessPage()`로 막음.
- 데이터: 메뉴 숨김만으로 막지 않는다. Firebase 규칙(`tools/backup/build-rules.cjs`)이 역할별로 막고, 화면은 읽을 수 있는 역할일 때만 구독(`authReadyOnValue(ref, next, error, ['admin'])`).

### 주요 Firebase 경로

- `records/{id}` — 입출고 레코드
- `leaveEmployees/{id}` — 연차 대상 직원 (name, email, hireDate, totalLeave, team, position, displayTeam?)
  - `position` enum: `'일반' | '부서장' | '임원' | '대표'` (결재선용)
  - `team`: 사무실/판금부/도장부/기능부/사고전담부 (드롭다운, 빈값 가능) — **결재선 라우팅용**
  - `displayTeam`: 선택값. 있으면 조직도 표시만 이 값으로 그룹핑 (결재선은 team 그대로 사용). 예: 사고전담부 인력을 team=사무실, displayTeam=사고전담부로 설정하면 사무실 부서장이 결재하되 조직도에서는 별도 표시.
- `leaveUsage/{id}` — 연차/반차/조퇴/외출 사용 내역 (empId, type, date, hours, reason, fromRequestId?)
- `leaveRequests/{id}` — 연차 신청서 (empId, type, date, hours, reason, team, status, *ApprovedAt/By, rejected*, finalUsageId?)
  - `status` enum: `pending_manager | pending_admin | pending_director | approved | rejected | canceled`
- `companyEvents/{id}` — 회사 일정 (title, date, description, createdBy)
- `board/{id}` — 게시판 메모
- `annualLeaveNotices/{id}` — 연차 사용촉진 통지서 (employee, leaveInfo, plan[], status, approval, noticeDate, submittedAt/By, createdBy)
  - `status` enum: `issued | draft | submitted | approved`
  - 워크플로: 관리자 발행 → 직원 사용계획서 작성/제출 → 관리자 승인. 법적 증빙용(근로기준법 제61조, 별지-확인서식 제22호).
  - 승인 시 `approval: {approved, timestamp, approverEmail, approverName}` 기록. 인쇄 시 결재 박스 표시.
  - **법정 시기 주의**: 1차 촉진은 사용기간 만료 6개월 전 기준 10일 이내(회계연도 기준 7/1~7/10), 2차는 2개월 전까지(~10/31). 시기 어긋나면 법적 효력 인정 어려움. 지금 시스템은 1차/2차 구분 없이 단일 통지서 구조 — 엄밀한 법적 면책 원할 시 7월/10월에 각각 별도 발행 필요.

### 연차 신청서 결재 워크플로

신청 → **부서장 → 관리자(시스템 admin) → 대표** → 승인 시 자동으로 `leaveUsage`에 entry 생성.

자동 패스 규칙:
- 신청자 `position === '대표'` → 즉시 최종 승인 (모든 단계 패스)
- 신청자 `position === '임원'` → 부서장·관리자 단계 패스, 바로 대표 단계로
- 신청자 `position === '부서장'` → 부서장 단계 자동 패스
- 신청자 팀에 부서장 미등록 → 부서장 단계 자동 패스
- 신청자 시스템 role === 'admin' AND 부서장 단계가 패스된 상태 → 관리자 단계도 자동 패스

승인 권한:
- `pending_manager`: 신청자와 같은 `team`인 `position === '부서장'` 직원
- `pending_admin`: `role === 'admin'` 사용자
- `pending_director`: `position === '대표'` 직원

관리자(`role === 'admin'`)는 단계 무관하게 모든 진행중 신청 가시. 단 본인 차례가 아니면 액션 버튼 비활성, "대기 중" 표시.

승인된 신청은 `leaveUsage`에 자동 등록되며 `fromRequestId`/`finalUsageId`로 양방향 연결.

### 페이지별 렌더 함수

`switchPage(name)`이 탭 전환 + 페이지별 `_render*` 호출:

- `list` → `_renderList`
- `complete` → `_renderComplete`
- `out` → `_renderOut`
- `stats` → `_initYearSelect` + `_renderStats`
- `usermgmt` → `loadUserMgmt` + `_renderOrgChart`
- `leave` → `_renderLeave` (내부에서 연쇄적으로 `_renderMyRequests`·`_renderApprovalQueue`·`_renderNotices` 호출)
- `board` → `_renderBoard` + `_renderCalendar`

`leaveEmpRef` onValue는 변경 시 `renderLeave` + `_renderCalendar` + `_renderMyRequests` + `_renderApprovalQueue` + `_renderOrgChart` + `_renderNotices` 연쇄 호출로 모든 관련 뷰 동기화.

### 연차관리 페이지 섹션 구성 (`page-leave`)

위에서 아래 순서:
1. **내 신청서** (전 직원): 신청서 작성 버튼 + 본인 신청 이력 + 양식 보기·인쇄 버튼
2. **결재 대기** (관리자/부서장/대표): 진행중 신청 목록. 관리자는 모두 가시, 본인 차례 아닌 건 "대기 중" 표시
3. **연차 사용촉진 통지서** (관리자 발행 + 전 직원 본인 것 열람/작성/제출): 상태 필터 드롭다운, 📝 작성 / 📄 보기 / 삭제 버튼. 승인 PDF에 결재 박스 표시
4. **직원별 연차 현황** (전 직원, 비관리자는 본인 행만): 총/사용/잔여/연차/반차/조퇴외출 집계
5. **사용 내역** (전 직원, 비관리자는 본인 것만)

### 게시판·일정 페이지 섹션 구성 (`page-board`)

- 상단 토글: `[📅 달력] [📝 게시판] [전체]`, 기본 "전체" (달력 위·게시판 아래)
- 달력: 월 그리드에 회사 일정(companyEvents) + 직원 휴가(leaveUsage) 통합 표시. 날짜 클릭 시 상세 모달
- 일정 등록/수정/삭제는 관리자만

### 사용자 관리 페이지 섹션 구성 (`page-usermgmt`) — 관리자 전용

1. 역할 안내 카드 3종 (admin/staff/viewer)
2. 승인된 사용자 테이블
3. 접근 요청(대기) 테이블
4. 🏢 조직도 — 대표 → 임원들 → 4개 메인 부서(기능부/판금부/도장부/사무실, 부서장+팀원) + 특수 부서(사고전담부 등, `displayTeam` 기반)

## 코드 관습

### 한글 문자열 인코딩

인라인 `onclick` 핸들러 내에서 문자열 비교할 때는 **유니코드 이스케이프**(`'\uc5f0\ucc28'`) 사용. 직접 `'연차'`를 쓰면 HTML 속성 내 인코딩 이슈 가능성 있음. 기존 코드 컨벤션 따라 유지.

예: `if (u.type === '\uc5f0\ucc28') ...`

### 디자인 톤

**절제된 UI 변경 선호** — 화려한 강조 X, 인지될 정도의 최소 변화만. 버튼 어포던스는 subtle chevron + hover 정도로 충분.

### 커밋 메시지

한국어로 작성. 제목 한 줄 + 빈 줄 + 본문(왜/무엇을). 절대 강제 푸시 금지.

## 자주 하는 작업

### 디지털 명함 OG 이미지 업데이트 (카톡 미리보기 캐시 문제)

카톡은 URL 기반 캐시라 **파일명을 바꾸는 게 가장 확실함**. `og-preview.png` → `og-preview-v2.png` → `og-preview-v3.png` 식으로. HTML의 `og:image`·`twitter:image` 경로도 동기 변경.

### 4개 명함 동시 수정

디지털 명함 4종 HTML/CSS는 동일 구조라 같은 수정을 4번 반복. Edit 툴 사용 시 replace_all로 각 파일 순회.

### 사용자 관리 페이지 역할 수정

`ROLE_MENUS`, `_RL`/`_RD`, 드롭다운 옵션 3곳, 역할 안내 카드 3개 전부 맞춰서 수정해야 드리프트 없음.

### 화면 수정 후 배포 (표준 절차)

1. 최신 `origin/master` 확인, 작업 브랜치에서 수정
2. `un/index.html`의 `?v=`·`PAGE_VERSION`과 `un/sw.js`의 `CACHE_VERSION`을 같은 새 문자열로 일괄 변경 (예: `v198-2026-10-24` → `v199-...`). 안내 직원 화면을 바꿨으면 `un/repair-guide/index.html`의 `?v=`도
3. `node --check`로 바꾼 JS 문법 확인, `tests/` 전부 실행 (`for t in tests/*.cjs; do node $t; done`)
4. 데이터 백업(`tools/backup/safe-backup.cjs`, Firebase CLI 로그인 필요) → 롤백 태그(`rollback-before-<작업>-YYYYMMDD`) push → master fast-forward push (강제 push 금지)
5. 1~2분 뒤 라이브 파일이 커밋과 같은지, `sw.js` 버전이 새 값인지 확인

## Firebase 보안 규칙

Realtime Database 규칙의 원본은 `tools/backup/build-rules.cjs` (Console에서 직접 고치지 않음). 새 최상위 경로를 쓰면 여기에 반드시 추가 (`$other`는 모두 거부 → 안 하면 `PERMISSION_DENIED`).

- 검사: `node tests/rules-policy.cjs` (역할별 읽기·쓰기 기대값)
- 게시: 게시 직전 운영 규칙 사본을 `tools/backup/rules-before-<작업>-YYYYMMDD.json`으로 남기고
  `node tools/backup/publish-rules.cjs --baseline <그 파일>` (점검, 쓰기 없음) → `--publish` (게시 + 재조회 확인).
  운영 규칙이 기준 파일과 다르면 덮어쓰지 않고 멈춘다.
- 현재 원칙: 승인된 사용자(admin/staff/viewer)만 읽기. 매출·보증금·KGM 대수·월 목표·보험 미결·권한 표는 관리자만.
  거래처는 공개 범위별 저장 위치(`vendorContacts` / `vendorContactsStaff` / `vendorContactsAdmin`), 연락처 쓰기는 관리자만.
  게시판은 본인 글만 수정·삭제.

Console: https://console.firebase.google.com/project/unmotors/database/unmotors-default-rtdb/rules

## 다른 컴퓨터에서 작업할 때

- 코드는 이 저장소에 모두 있다. `git clone` 후 바로 수정 가능. 배포는 GitHub push 권한(`gh auth login`) 필요.
- 백업·규칙 도구는 Firebase CLI(`npm i -g firebase-tools`, `firebase login`) 필요.
- 브라우저 테스트(Playwright)는 현재 사무실 PC의 Codex 실행 환경 경로를 쓴다. 다른 PC에서는 Playwright 설치가 필요.
- 상세 작업 기록·운영 지침(`CODEX.md`, 바탕화면 `KGM견적/CLAUDE.md`)은 로컬 전용이라 저장소에 없다. 백업 데이터(고객 정보 포함)는 절대 커밋하지 않는다.

## 알려진 제약

- 서비스워커는 `?v=`가 자기 버전과 같을 때만 저장본을 쓴다. 버전 문자열을 안 올리면 예전 파일이 계속 나온다.
- `styles.css`의 대시보드 전용 규칙(`body:has(#page-dashboard.active) ...`)이 더 강해서, 공통 수정이 대시보드에서만 안 먹을 수 있다. design-refresh.css에 대시보드 선택자를 함께 적는다.
- Windows Git Bash `sed -i`는 CRLF 파일 줄끝을 바꿀 수 있다. 큰 치환은 node 스크립트로.
- 이 폴더는 다른 Windows 계정 소유라 `git`이 거부하면 `git -c safe.directory=<경로> ...`로 실행 (전역 설정 변경 대신).
- `statusBadge`처럼 흔한 이름은 이미 다른 용도로 선점된 경우가 많음 — 신규 함수는 도메인 prefix(`reqStatusBadge`, `noticeStatusBadge` 등) 붙일 것. 동명 선언 시 ES6 module 전체 파싱 실패로 앱 전체가 "Firebase 연결 중..."에서 멈춤.
- 큰 JS 추가 후 푸시 전 **`node --check`로 syntax 검증 필수** (MEMORY 참고).
