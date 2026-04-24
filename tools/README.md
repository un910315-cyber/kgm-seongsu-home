# tools — 운영 도구

## backup — 데이터 백업

Firestore + Realtime Database 전체를 JSON으로 백업.

### 1회만 셋업

#### 1) Firebase 서비스 계정 키 발급

1. https://console.firebase.google.com/project/unmotors/settings/serviceaccounts/adminsdk 접속
2. **"새 비공개 키 생성"** 클릭 → JSON 파일 다운로드
3. 다운받은 파일을 **`tools/service-account-key.json`** 으로 이름 변경 + 이동
4. ⚠️ 이 파일은 `.gitignore`로 보호되어 있지만, 절대 외부 공유 금지

#### 2) 의존성 설치 (한 번만)

```bash
cd tools
npm install
```

### 매주 백업 실행

```bash
cd tools
npm run backup
```

또는

```bash
node backup/backup-all.js
```

→ `tools/backup/backups/YYYY-MM-DD/` 아래에 `firestore.json`, `rtdb.json` 생성됨.

### 백업 파일 보관 권장

`backups/` 폴더는 git에 안 올라감. **외장하드/구글드라이브/원드라이브 등에 주기적으로 복사** 보관 추천.

### 복구 (필요 시 수동)

복구는 위험한 작업이라 자동화하지 않음. 필요 시:
- Firestore: Firebase Console → "데이터 가져오기/내보내기" 또는 별도 복구 스크립트 작성
- RTDB: Firebase Console → 우측 점 3개 → "JSON 가져오기"

복구 시 부장님께 먼저 확인.
