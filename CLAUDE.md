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
/un/index.html           # 내부용 관리 페이지(싱글 HTML, ~3800 lines)
/kakao-qr/               # 카카오톡 QR 페이지
/CNAME                   # 커스텀 도메인 설정
```

각 디지털 명함 폴더: `index.html` + og 이미지(`og-preview-v2.png`).

## 내부용 페이지 (`un/index.html`)

모든 기능이 단일 HTML 파일에 있음(CSS + JS 인라인). Firebase(Auth + Realtime DB + Firestore) 기반.

### 역할 체계

Firestore `users/{email}.role` 필드:

| 키 | 라벨 | 접근 메뉴 |
|---|---|---|
| `admin` | 👑 관리자 | 전체 |
| `staff` | 🔧 Staff 1단계 | dashboard, complete, leave, board, estimate |
| `viewer` | 👤 Staff 2단계 | dashboard, complete, leave, board |

관리자 전용: list(입출고), out(출고완료), stats(월별통계), migyeol(보험미결), usermgmt(사용자관리).

역할 상수는 `ROLE_MENUS` 객체(~970행) 및 `_RL`/`_RD`/`_RC`(~1135행). 역할 드롭다운은 3곳(접근요청 승인 시, 승인된 사용자 편집, 승인 직전 선택)에 중복 존재하므로 라벨/옵션 변경 시 동시 수정 필요.

### 탭 노출 로직

- 기본 노출 여부: HTML의 `style="display:none"` 인라인 + 인증 완료 시 `ROLE_MENUS` 기반 루프(~1034행)가 show/hide 재설정.
- 관리자 전용 명시적 show 블록(`setTimeout(..., 2000)` 내부, ~1120행)이 `tab-usermgmt`/`tab-leave`/`tab-board`를 다시 `display=''`로 세팅. 최근 `tab-leave`/`tab-board`는 루프만으로도 노출되므로 이 블록 중 둘은 redundant. 건드리지 않는 편이 안전.

### 주요 Firebase 경로

- `records/{id}` — 입출고 레코드
- `leaveEmployees/{id}` — 연차 대상 직원 (name, email, hireDate, totalLeave, team, position)
  - `position` enum: `'일반' | '부서장' | '임원' | '대표'` (결재선용)
  - `team`: 사무실/판금부/도장부/기능부 (드롭다운, 빈값 가능)
- `leaveUsage/{id}` — 연차/반차/조퇴/외출 사용 내역 (empId, type, date, hours, reason, fromRequestId?)
- `leaveRequests/{id}` — 연차 신청서 (empId, type, date, hours, reason, team, status, *ApprovedAt/By, rejected*, finalUsageId?)
  - `status` enum: `pending_manager | pending_admin | pending_director | approved | rejected | canceled`
- `companyEvents/{id}` — 회사 일정 (title, date, description, createdBy)
- `board/{id}` — 게시판 메모
- `annualLeaveNotices/{id}` — 연차 사용촉진 통지서 (employee, leaveInfo, plan[], status, approval, noticeDate)
  - `status` enum: `issued | draft | submitted | approved`
  - 워크플로: 관리자 발행 → 직원 사용계획서 작성/제출 → 관리자 승인. 법적 증빙용(근로기준법 제61조).

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

`switchPage(name)`(~2556행)이 탭 전환 + 페이지별 `_render*` 호출:

- `list` → `_renderList`
- `complete` → `_renderComplete`
- `out` → `_renderOut`
- `stats` → `_initYearSelect` + `_renderStats`
- `usermgmt` → `loadUserMgmt`
- `leave` → `_renderLeave`
- `board` → `_renderBoard` + `_renderCalendar`

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

`ROLE_MENUS`, `_RL`/`_RD`, 드롭다운 옵션 3곳, 역할 안내 카드 3개(~3340행) 전부 맞춰서 수정해야 드리프트 없음.

## 알려진 제약

- `switchPage()`에 권한 가드 없음. 현재는 nav-tab의 `display:none`으로 차단되지만, 프로그래매틱 호출은 막히지 않음. 위험한 엔트리포인트(대시보드의 직접 이동 버튼 등)가 생기면 가드 추가 필요.
- 모든 Firebase 보안 규칙은 별도. 클라이언트 UI 차단은 1차 방어선일 뿐.
