# KGM 성수서비스센터 사이트 — 프로젝트 요약

> 작성일: 2026-05-14
> Repo: github.com/un910315-cyber/kgm-seongsu-home (master)
> Live: https://kgm-seongsu.co.kr (GitHub Pages + CNAME)

상세 운영 가이드는 `CLAUDE.md`, 새 세션 핸드오프는 `claude-handoff-brief.md` 참고.

---

## 1. 주요 기능 목록

### 1-1. 메인 랜딩 (`/index.html`)
회사 대표 페이지. 정적 HTML. 회사 소개·연락처·디지털 명함 링크.

### 1-2. 임원 디지털 명함 4종
- `digital-card/` — 박경영 총괄이사 (※접미사 없음)
- `digital-card-lee/` — 이동근 정비팀장
- `digital-card-yang/` — 양은주 대표이사
- `digital-card-yoon/` — 윤유현 부장

각 폴더: `index.html` + og 이미지(`og-preview-v2.png`). 4개 동일 구조 — 디자인 변경 시 4파일 모두 수정 필요. 카톡 미리보기 캐시 갱신은 og 이미지 파일명 변경(`-v2` → `-v3`)이 가장 확실.

### 1-3. unmotors 외제차 수리 홍보 (`/unmotors/`)
네이버 블로그(blog.naver.com/un3466) 유입용 단일 랜딩. Hero → About → 수리사례 4개 → 서비스 4박스 → CTA → 푸터. 자체 도메인 미보유.

### 1-4. 카카오 QR (`/kakao-qr/`)
QR 스캔 도착지 페이지. 단순 단일 HTML.

### 1-5. 내부 관리 페이지 (`/un/index.html`) — 핵심
싱글 HTML(~6,917줄), Firebase 기반 SPA. **11개 탭/페이지 + 다수 모달**.

| 탭 | 페이지 ID | 권한 | 설명 |
|---|---|---|---|
| 📊 대시보드 | dashboard | 전체 | 통계 카드 5종 + 현황 목록 + 이번주/다음주 출고 사이드바 + 예약차 사이드바 |
| 🚗 입출고 목록 | list | admin | 전체 차량 목록 + 검색/필터 |
| ✅ 수리완료 대기 | complete | 전체 | 출고 대기 차량 |
| 🏁 출고완료 | out | admin | 출고된 차량 |
| 📈 월별 통계 | stats | admin | 월별 입고/출고 차트 + 차량 구분 비율 |
| 📂 보험 미결 | migyeol | admin | AOS·KGM 볼트 엑셀 업로드 → 보험사별 미결 분석 |
| 📅 연차관리 | leave | 전체 | 신청서/결재/사용촉진통지서/직원별 현황/사용내역 |
| 📝 게시판·일정 | board | 전체 | 회사 일정(달력) + 게시판 메모 |
| 🔧 견적 도우미 | estimate | admin/staff | 차량 스티커 OCR(Claude Vision) + 공임 견적서 |
| 📞 보험사 연락처 | insurance | admin/staff | 보험사별 담당자 다중 등록 + 검색 |
| 👤 사용자 관리 | usermgmt | admin | 승인된 사용자 + 접근 요청 + 조직도 |

**부가 기능:**
- 차량 사진 업로드/조회/삭제 (Firebase Storage, 입고/출고 단계별)
- 인-앱 카메라 연속 촬영
- 사진 ZIP 일괄 다운로드
- 작업지시서 인쇄 (PNG 양식 위에 좌표 기반 텍스트 오버레이)
- 견적서 인쇄
- 차량 스티커 OCR (Claude Vision API, 사용자 키 BYOK)
- 카드 알림 SMS 파싱(거래 자동등록 — Sarah Family 쪽 기능 아님 주의)

---

## 2. 파일 구조

```
kgm-seongsu-home/
├── index.html                  # 메인 랜딩 (594줄)
├── index_backup.html           # 메인 백업 (이전 버전)
├── CNAME                       # kgm-seongsu.co.kr
├── building.jpg                # 사옥 사진 (3MB, 메인용)
├── robots.txt
├── sitemap.xml
├── CLAUDE.md                   # Claude Code용 작업 가이드
├── claude-handoff-brief.md     # 다른 Claude 세션 핸드오프 문서
├── SUMMARY.md                  # 본 문서
├── digital-card/               # 박경영
│   ├── index.html
│   └── og-preview-v2.png
├── digital-card-lee/           # 이동근
├── digital-card-yang/          # 양은주
├── digital-card-yoon/          # 윤유현
├── unmotors/                   # 외제차 수리 홍보 (404줄)
│   ├── index.html
│   └── images/
│       ├── hero.jpg
│       └── case-1~4.jpg
├── kakao-qr/
│   └── index.html
├── tools/                      # 빌드 도구 (미사용 / 백업용)
│   ├── README.md
│   ├── backup/
│   ├── package.json
│   └── package-lock.json
└── un/                         # 내부 관리 페이지 (핵심)
    ├── index.html              # 6,917줄 — 모든 기능 인라인
    └── work-order-form.png     # 작업지시서 배경 이미지
```

**핵심 파일 크기:**
- `un/index.html`: 6,917줄 (CSS + JS 모두 인라인, 모듈 스크립트 1개 + 작은 보조 스크립트들)
- `index.html`: 594줄
- `unmotors/index.html`: 404줄

---

## 3. Firebase 구조

**Project ID**: `unmotors` (KGM 사이트 전용 — Sarah Family와 무관)
**Console**: https://console.firebase.google.com/project/unmotors

### 3-1. Authentication
- Google 로그인 (signInWithPopup, 모바일 redirect fallback)
- 로그인 후 `users/{email}` 조회 → 미등록 시 `access_requests/{email}` 자동 생성

### 3-2. Firestore
- `users/{email}` — 승인된 사용자 (role: admin/staff/viewer, name)
- `access_requests/{email}` — 가입 대기자 (관리자가 승인)
- `mappings/` — 견적도우미용 사용자 정의 매핑

### 3-3. Realtime Database
| 경로 | 용도 |
|---|---|
| `records/{id}` | 입출고 차량 레코드 (carNum, carModel, name, phone, status, inDate, outDate, repair, cost, km, rent, insDaemul/Jacha, location, carType, memo, photos{intake/outbound:[]}) |
| `reservations/{id}` | 예약차 (records와 분리) |
| `leaveEmployees/{id}` | 연차 대상 직원 (name, email, hireDate, totalLeave, team, position, displayTeam?) |
| `leaveUsage/{id}` | 연차/반차/조퇴/외출 사용 내역 |
| `leaveRequests/{id}` | 연차 신청서 (status: pending_manager/admin/director, approved, rejected, canceled) |
| `annualLeaveNotices/{id}` | 연차 사용촉진 통지서 (issued/draft/submitted/approved) |
| `companyEvents/{id}` | 회사 일정 |
| `board/{id}` | 게시판 메모 |
| `insurance/{id}` | 보험사 연락처 |

### 3-4. Storage
- `vehicles/{carKey}/{intake|outbound}/{ts}_{rand}.jpg` — 차량 사진 (long edge 1600px / quality 0.8 압축)

### 3-5. 보안 규칙
- Firestore: `users` 자기 자신 read 가능, admin만 write
- Realtime DB: 인증된 사용자만 read/write (각 경로별 화이트리스트)
- 신규 컬렉션 추가 시 Console 규칙에 등록 안 하면 `PERMISSION_DENIED`

---

## 4. 미완성 / 알려진 제약

### 4-1. 보안 / 권한
- **`switchPage()`에 권한 가드 없음** — 현재는 nav-tab의 `display:none`로만 차단, 프로그래매틱 호출 가능. 위험한 직접 이동 버튼 생기면 가드 추가 필요.
- **API 키 클라이언트 노출** — Claude Vision 호출용 Anthropic API 키가 `localStorage`(`kgm_api_key`)에 저장되고 브라우저에서 직접 호출. BYOK 방식이라 사용자 본인 책임이지만 키 유출 시 즉시 회전 필요.
- **Firebase Web API 키 공개** — `index.html`에 인라인. 보안 규칙으로만 통제 — 규칙 누락 시 데이터 누출 가능.

### 4-2. 법적 리스크
- **연차 사용촉진 통지서 1차/2차 미구분** — 근로기준법 제61조상 1차(만료 6개월 전, 7/1~7/10)와 2차(2개월 전까지, ~10/31) 별도 발행 필요. 현재는 단일 통지서 구조. 엄밀한 법적 면책 위해선 시기별 분리 발행 필요.

### 4-3. 코드 품질
- **단일 6,917줄 HTML** — 모듈화 안 됨. 동명 함수 충돌 시 ES6 module 전체 파싱 실패로 앱 전체가 "Firebase 연결 중..."에서 정지. 신규 함수는 도메인 prefix(`reqStatusBadge`, `noticeStatusBadge` 등) 필수.
- **node --check 필수** — 큰 JS 추가/수정 후 push 전 syntax 검증 안 하면 사이트 다운 위험.
- **redundant 코드 일부** — `tab-leave`/`tab-board` show 블록은 `ROLE_MENUS` 루프와 중복. 건드리면 부작용 위험해서 그대로 둠.

### 4-4. 기능 한계
- **다중 통화 미지원** — KRW 고정
- **이미지 영수증/구매내역 관리 없음** — 경리부에서 별도 처리 (의도적 제외)
- **카테고리 커스터마이즈 불가** — 코드 수정 필요
- **차량 사진 라이트박스 모바일 제스처 부족** — 좌우 스와이프 미지원, 버튼만

### 4-5. 운영
- **로컬 레포 경로 분리 필요** — `claude-handoff-brief.md`는 옛 `Temp` 경로 표기. 현재 실사용은 `Documents\kgm-seongsu-home`. 핸드오프 문서 갱신 필요.
- **다운로드 위치 강제 불가** — 차량 사진 다운로드 시 브라우저 기본 다운로드 폴더 사용 (JS로 위치 지정 불가, 브라우저 보안 제약)

---

## 5. 다음에 할 작업 (우선순위별)

### 우선순위 A — 운영 안정성
1. **`switchPage()` 권한 가드 추가** — 페이지 진입 시 `ROLE_MENUS[role].includes(name)` 체크. 미허용 시 dashboard로 리다이렉트.
2. **`claude-handoff-brief.md` 경로 갱신** — `AppData\Local\Temp` → `Documents\kgm-seongsu-home`로 수정.
3. **Firebase 보안 규칙 정기 점검** — 신규 컬렉션 추가 흐름 정형화 (Console에 규칙 추가가 누락되면 즉시 권한 오류).

### 우선순위 B — 법적 / 컴플라이언스
4. **연차 사용촉진 통지서 1차/2차 분리** — 회계연도 기준 7월·10월 별도 발행 UI/로직. 발행 시기 자동 알림.
5. **개인정보 처리방침 페이지** — 메인 사이트에 footer 링크 추가 (현재 부재).

### 우선순위 C — 사용성
6. **차량 사진 라이트박스 좌우 스와이프** — 모바일 제스처. PC는 화살표 이미 지원.
7. **대시보드 검색 필터 저장** — 새로고침 시 이전 검색 조건 복원 (localStorage).
8. **연차 신청서 결재선 시각화** — 현재 단계와 앞/뒤 결재자 다이어그램으로 표시.

### 우선순위 D — 기술 부채
9. **`un/index.html` 모듈 분리 검토** — CSS/JS 별도 파일. 단, 단일 파일 배포 단순함의 트레이드오프 고려. 현재는 push만으로 즉시 반영되는 장점 큼.
10. **`tools/` 디렉토리 정리** — 미사용으로 보임. 정말 안 쓰면 제거, 쓴다면 README에 용도 명시.
11. **테스트 자동화** — 현재 0%. 최소한 `node --check` 자동화(pre-commit hook) 도입.

### 우선순위 E — 신기능 (요청 대기)
12. **알림(푸시/이메일) 시스템** — 결재 대기 시 결재자에게 알림.
13. **모바일 PWA 전환** — 현장직 접근성. 오프라인 지원 등.
14. **출고 사진 자동 카톡 전송** — 고객에게 출고 시 사진 자동 발송 (현재는 수동).

---

## 6. 핵심 명령어

```powershell
# 로컬 작업 후 배포
cd C:\Users\pc\Documents\kgm-seongsu-home
git add un/index.html
git commit -m "변경 내용"
git push origin master
# → 1~2분 후 https://kgm-seongsu.co.kr 반영

# JS syntax 검증 (큰 변경 후 필수)
node -e "const fs=require('fs');const m=[...fs.readFileSync('un/index.html','utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];m.forEach((x,i)=>{if(x[1].trim())fs.writeFileSync('_check_'+i+'.mjs',x[1])})"
for f in _check_*.mjs; do node --check "$f"; done && rm _check_*.mjs && echo OK
```

---

## 부록 — 자주 발생하는 트랩

- **카톡 미리보기 캐시**: og 이미지 파일명 변경(`-v2` → `-v3`)이 가장 확실
- **한글 인라인 onclick 비교**: 유니코드 이스케이프(`'연차'`) 사용 (HTML 속성 인코딩 이슈 회피)
- **동명 함수 선언 → 앱 전체 정지**: `statusBadge` 등 흔한 이름 피하고 도메인 prefix 사용
- **Firebase 새 컬렉션 → PERMISSION_DENIED**: Console에서 규칙 추가 잊지 말 것
- **차종(carModel) 누락 표시**: 데이터 흐름은 정상이지만 일부 모달/사이드바에 필드 누락된 경우 있음 — 표시 위치 모두 확인 필요 (최근 수정됨, commit `02824fa`)
