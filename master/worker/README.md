# 자비스 중계 서버 배포 가이드 (Cloudflare Worker)

자비스 2단계 — Claude 두뇌를 붙이려면 이 중계 서버가 필요합니다.
**API 키를 페이지 소스에 노출하지 않기 위한 작은 서버**이고, Cloudflare 무료 등급으로 충분합니다.

## 왜 필요한가
- 자비스 페이지(`/master/`)는 누구나 소스를 볼 수 있는 정적 페이지입니다.
- API 키를 거기 넣으면 도용당합니다.
- 그래서 키는 **이 Worker의 Secret**에만 저장하고, 페이지는 Worker에게 질문만 보냅니다.

## 대시보드로 배포 (가장 쉬움)

1. **가입/로그인** — https://dash.cloudflare.com (무료)
2. 왼쪽 메뉴 **Workers & Pages** → **Create** → **Create Worker**
3. 이름을 `kgm-jarvis` 로 두고 **Deploy** (일단 기본 코드로 생성)
4. **Edit code** (또는 `</> Edit`) 클릭 → 편집기의 기존 내용을 전부 지우고
   → 이 폴더의 **`worker.js`** 내용을 통째로 붙여넣기 → **Deploy**
5. Worker 상세 화면 → **Settings** → **Variables and Secrets**
   → **Add** → 종류 **Secret** 선택
   → Name: `ANTHROPIC_API_KEY`
   → Value: 발급받은 Anthropic API 키 붙여넣기
   → **Deploy** (저장)
6. Worker 주소를 복사합니다. 보통 이런 형태예요:
   `https://kgm-jarvis.<당신의계정>.workers.dev`
7. **이 주소를 Claude(자비스 만든 AI)에게 알려주세요.**
   자비스 페이지(`master/app.js`)의 `WORKER_URL`에 넣고 배포하면 2단계가 켜집니다.

## 확인
배포 후 브라우저에서 Worker 주소를 그냥 열면 `POST only` 가 보이면 정상입니다.
(GET 요청이라 거부된 것 — 작동하고 있다는 뜻)

## 비용/안전
- Cloudflare Worker: 무료 등급(하루 10만 요청)으로 충분, 0원.
- Anthropic: 질문당 소액 과금. console.anthropic.com → Billing 에서 **월 지출 한도**를 걸어두면 안전합니다.
- 키는 Secret으로만 저장되고 코드·깃·페이지 어디에도 안 남습니다.
