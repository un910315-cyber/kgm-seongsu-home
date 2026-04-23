# Claude 프로젝트 핸드오프 — KGM 성수서비스센터 사이트

> 윤유현 부장이 Claude Code에서 함께 쌓아온 작업 맥락을 다른 Claude 세션(claude.ai Projects 등)으로 전달하기 위한 브리핑 문서.

---

## 1. 사용자 정보

- **이름**: 윤유현 (부장)
- **소속**: 케이지모빌리티성수서비스센터(주) · UN Motors
- **이메일**: un910315@gmail.com
- **실제 역할**: 부장 직함이지만 회사 홈페이지·내부 시스템·디지털 명함·인사/노무 실무까지 폭넓게 담당
- **소통 언어**: 한국어

### 선호 / 작업 스타일

- **디자인**: 화려함보다 절제된 스타일. "너무 눈에 띄지 말고 인지될 정도만" — 서브틀한 chevron·hover 수준이면 충분
- **개발 접근**: 작은 개선을 빠르게 반복. 큰 그림을 미리 다 설계하기보다 쓰면서 필요한 걸 보강하는 타입
- **법적 리스크 민감**: 노동법·개인정보·보안 이슈를 선제적으로 질문. 불확실하면 노무사·공식 기관 상담 권유를 순순히 수용
- **피드백 방식**: 긍정 피드백 풍부("최고야", "너무 완벽해"). 부정은 간결("아 그럼 냅두자")
- **예의 / 격식**: 조직 위계 감각 있음 (예: 명함 순서에서 대표이사부터 위로 정렬 요청)

## 2. 프로젝트 개요

- **Repo**: https://github.com/un910315-cyber/kgm-seongsu-home (master 브랜치, public)
- **로컬 경로**: `C:\Users\pc\AppData\Local\Temp\kgm-seongsu-home`
  - ※ AppData\Temp 경로라 향후 안전한 위치(Desktop/Documents)로 이관 추천됨
- **배포**: GitHub Pages → https://kgm-seongsu.co.kr (CNAME 연결, push하면 1~2분 내 반영)
- **기술 스택**: 정적 사이트 + Firebase 클라이언트 SDK (Auth + Realtime DB + Firestore)
- **주 수정 파일**: `/un/index.html` (~5,100줄, 단일 HTML 안에 CSS·JS 인라인 전부)

## 3. 구성 요소

### 공개 페이지

- `/index.html` — 메인 랜딩
- `/digital-card/` — 박경영 총괄이사 (※접미사 없음이 박경영)
- `/digital-card-lee/` — 이동근 정비팀장
- `/digital-card-yang/` — 양은주 대표이사
- `/digital-card-yoon/` — 윤유현 부장 (본인)
- `/kakao-qr/` — 카카오톡 QR

### 내부용 관리 페이지 (`/un/index.html`)

로그인 필요. Google OAuth + Firestore `users` 컬렉션에서 역할 매칭.

**역할 체계**:

| 키 | 라벨 | 접근 메뉴 |
|---|---|---|
| admin | 👑 관리자 | 전체 |
| staff | 🔧 Staff 1단계 | dashboard, complete, leave, board, estimate |
| viewer | 👤 Staff 2단계 | dashboard, complete, leave, board (견적 제외) |

관리자 전용 메뉴: 입출고 목록, 출고완료, 월별 통계, 보험 미결, 사용자 관리.

**주요 기능**:

1. 대시보드 — 차량 현황
2. 입출고 목록 · 수리완료 대기 · 출고완료 — 차량 수리 흐름 관리
3. 월별 통계 · 보험 미결 — 관리자 전용
4. **연차관리** — 기능 가장 풍부 (아래 상세)
5. 게시판 · 일정 — 사내 메모 + 월별 달력 (회사 일정 + 직원 휴가 통합 표시)
6. 견적 도우미 — 차량 정비 견적 작성
7. 사용자 관리 — 권한 부여 + 🏢 조직도 + 디지털 명함 링크 복사 (관리자 전용)

### 연차관리 페이지 상세

한 페이지 안에 섹션이 위에서 아래로:

- **📥 내 신청서** (전 직원) — 신청·취소·이력, 📄 회사 고유 양식 인쇄
- **📨 결재 대기** (관리자/부서장/대표) — 승인/반려, 관리자는 전 단계 가시
- **📋 연차 사용촉진 통지서** — 관리자 발행 + 직원 사용계획서 작성/제출 + 관리자 승인. 별지-확인서식 제22호 기반. 법적 증빙용
- **📊 직원별 연차 현황** — 총/사용/잔여/연차/반차/조퇴외출 집계
- **📋 사용 내역**

### 연차 신청 결재 워크플로

신청 → **부서장 → 관리자(admin) → 대표** → 승인 시 `leaveUsage`에 자동 등록

자동 패스 규칙:
- `position === '대표'` → 즉시 최종 승인
- `position === '임원'` → 부서장·관리자 단계 패스, 대표만 결재
- `position === '부서장'` → 부서장 단계 패스
- 팀에 부서장 미등록 → 부서장 단계 패스
- 신청자 admin + 부서장 패스 상태 → 관리자 단계도 패스

### 조직 구조 (실제 배치)

- **대표**: 양은주 (aa01053072368@gmail.com, 대표이사)
- **임원**: 박경영 (0913pky@gmail.com, 총괄이사), 윤유현 (un910315@gmail.com, 부장·본인), 하진
- **부서 4종**: 기능부 / 판금부 / 도장부 / 사무실
- **특수 부서**: 사고전담부 (조직도에만 표시, 결재는 사무실 부서장이 처리)
- **윤춘석**: team=`사무실` (결재 라우팅), displayTeam=`사고전담부` (조직도 표시)

## 4. Firebase 데이터 모델

- `/records/{id}` — 입출고 레코드
- `/leaveEmployees/{id}` — 직원 정보 `{name, email, hireDate, totalLeave, team, position, displayTeam?}`
  - `position`: `'일반' | '부서장' | '임원' | '대표'`
  - `team`: 사무실/판금부/도장부/기능부/사고전담부 (결재 라우팅)
  - `displayTeam`: 있으면 조직도에서만 이 값으로 그룹핑 (결재는 `team` 사용)
- `/leaveUsage/{id}` — 사용 내역 `{empId, type, date, hours, reason, fromRequestId?}`
- `/leaveRequests/{id}` — 연차 신청서
  - `status`: `pending_manager | pending_admin | pending_director | approved | rejected | canceled`
- `/annualLeaveNotices/{id}` — 사용촉진 통지서
  - `status`: `issued | draft | submitted | approved`
  - 법적 증빙(근로기준법 제61조)
- `/companyEvents/{id}` — 회사 일정 (달력용)
- `/board/{id}` — 게시판 메모

**보안 규칙**: Firebase Console에서만 관리 (레포에 파일 없음). 신규 컬렉션 추가 시 `{".read": "auth != null", ".write": "auth != null"}` 블록 추가 필수. 안 하면 `PERMISSION_DENIED`.

## 5. 주요 의사결정 이력

- **역할 체계 재편**: KGM직원/열람 → Staff 1단계/2단계로 명칭 변경. 관리자 전용 메뉴 확대(입출고·출고·통계·보험미결 전부)
- **연차 결재선에 admin 삽입**: 원래 부서장 → 대표 2단계였으나 "내가 알아야 대표께 보고 가능"해서 admin 단계 추가 (부서장 → admin → 대표)
- **임원 직책 도입**: 박경영·윤유현·하진 대표 직속이라 부서장·관리자 단계 패스하고 대표로 직행
- **사고전담부 표시 분리**: 명시는 사고전담부인데 결재는 사무실 부서장이 처리하도록 `team` ≠ `displayTeam`
- **디지털 명함 순서**: 대표이사(양은주)를 최상단으로 재배치
- **OG 이미지 캐시 우회**: 카톡 미리보기 갱신 안 되면 파일명 바꾸기 (og-preview.png → og-preview-v2.png 식)
- **statusBadge 함수명 충돌 사고**: 이후 신규 함수는 domain prefix (reqStatusBadge, noticeStatusBadge 등)

## 6. 진행 중 / 앞으로 할 것

### 즉시 이행 (법정 일정)

- **2026년 7월 1~10일**: 연차 사용촉진 **1차 재발송** (현재 4월 발송분은 법적 효력 없음, 사내 안내용일 뿐)
- **2026년 10월 31일까지**: 미사용 직원 대상 **2차 촉진** (회사가 사용일 지정, 서면)
- **2차 지정일 관리**: 해당일 직원 출근 시 명시적 거부 + 업무 지시 금지 + 기록

### 시스템 개선 여지

- 통지서에 **1차/2차 구분 필드** 추가 (현재 단일 구조)
- 부서장 없는 팀에 대한 **알림 경고**
- 달력에 **법정 촉진 자동 리마인더** (7월·10월)
- `switchPage()`에 **권한 가드** 추가 (지금은 탭 display:none만 의존)

### 외부 작업

- **Google OAuth consent screen**: 프로덕션 모드 게시 완료
- **디자인 리뉴얼**: claude.ai에 `un/index.html` + 캡처 전달해서 의뢰 계획

## 7. 협업 관습 / 주의사항

- **언어**: 한국어 기본. 커밋 메시지도 한국어
- **한국어 문자열**: JS inline onclick에서 비교 시 유니코드 이스케이프(`'\uc5f0\ucc28'`) 사용
- **큰 JS 추가 후**: `node --check`로 syntax 검증 필수 — 모놀리스 HTML이라 동명 함수 충돌 시 앱 전체가 "Firebase 연결 중..."에서 멈춤
- **4개 명함 동시 수정**: HTML/CSS가 동일 구조 → 같은 edit 4번 반복 (replace_all 활용)
- **Firebase 보안 규칙**: 신규 컬렉션 만들면 Console에서 규칙에 경로 추가
- **Git**: 강제 푸시 금지, amend 금지, 항상 새 커밋

## 8. 참고 링크

- 레포: https://github.com/un910315-cyber/kgm-seongsu-home
- 라이브: https://kgm-seongsu.co.kr
- Firebase Console: https://console.firebase.google.com/project/unmotors
- Firebase DB 규칙: https://console.firebase.google.com/project/unmotors/database/unmotors-default-rtdb/rules
- 근로기준법 제61조: https://www.law.go.kr/법령/근로기준법/제61조

---

## 사용법 (claude.ai에서)

1. claude.ai 좌측 메뉴에서 **"Projects"** (프로젝트) 생성
2. 프로젝트 이름: 예) "KGM 성수 사이트"
3. **"Add content" / "지식 추가"** 에 이 `claude-handoff-brief.md` 업로드
4. 필요하면 `CLAUDE.md` (레포 루트에 있음) 도 같이 업로드 — 기술 세부 보강
5. (선택) `un/index.html` 도 업로드하면 소스 수정 요청도 가능
6. 프로젝트 custom instructions에 "한국어로 답변" 추가 권장

이후 그 프로젝트에서 시작하는 모든 대화는 이 컨텍스트를 자동으로 불러옵니다.
