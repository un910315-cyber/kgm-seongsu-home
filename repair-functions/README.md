# 입고 및 수리 안내 서버

현재 서버는 테스트 전용입니다. 솔라피 전송 API를 호출하지 않습니다. 전달·실패·대체 문자 상태는 테스트 시나리오이며, 실제 고객 수신을 증명하지 않습니다.

## 분리 및 접근 권한

- 기존 Firebase 프로젝트 `unmotors`의 별도 Firestore 데이터베이스 `kgm-repair` 사용.
- 전용 비공개 버킷 `unmotors-kgm-repair-private` 사용. 공개 접근 차단, 서버가 인증 후 파일 제공.
- 실행 계정 `kgm-repair-guide`의 Firestore 권한은 `resource.name == "projects/unmotors/databases/kgm-repair"` 조건으로 제한.
- 기존 입고 및 직원 권한은 직원 Firebase ID 토큰으로 REST 조회. 기존 RTDB·Auth 관리자 IAM 권한을 서버에 부여하지 않음.
- 기존 입고 데이터, 연락처, 기존 DB 보안 규칙은 수정하지 않음. 테스트에서 연락처 변경은 해당 발송 스냅샷에만 적용.
- 직원 인증과 현재 허용 역할을 요청마다 확인. 고객은 개별 링크 토큰으로 해당 안내와 첨부 파일만 조회.
- 링크는 7일 후 만료. 직원 취소 즉시 조회·파일·확인 차단. 발송별 HMAC 토큰, 해시 검증. 토큰 키는 Secret Manager에만 보관.

## 기록

발송 당시 차량, 고객, 수신번호, 안내, 예상 출고일, 파일, 템플릿을 스냅샷으로 보존합니다. 파일은 입고 ID와 파일 해시로 분리합니다. 요청 키와 요청 내용 해시로 재시도를 중복 처리하지 않습니다. 재발송은 새 기록과 링크이며 이전 확인 기록을 바꾸지 않습니다.

고객의 버튼은 **확인**입니다. 확인 일시·해당 발송·견적 버전만 기록하며 법적 수리 동의나 본인 확인 완료로 해석하지 않습니다. 직원 미리보기와 공개 검수 예시는 저장 API를 호출하지 않습니다.

## 배포와 검증

```powershell
npm --prefix repair-functions test
node tests/repair-guide-isolation.cjs
node tests/repair-guide-menu.cjs
firebase deploy --only firestore:kgm-repair --config firebase.repair.json --project unmotors
firebase deploy --only functions:kgm-repair --config firebase.repair.json --project unmotors
```

기존 Firebase Hosting이나 기본 데이터베이스를 이 설정으로 배포하지 않습니다. `message.cjs`는 `repair-guide/message.js`와 동일한 승인 템플릿이어야 합니다.

## 실발송 전 남은 일

솔라피 서버 출발 IP 허용 방식, 등록된 대체 문자 발신번호, 실제 전송 결과 조회/수신 처리를 확정해야 합니다. 현재 PC의 허용 IP는 Cloud Functions의 출발 IP가 아닙니다. 실발송 전환은 별도 검증 및 승인이 필요합니다. API 요청 접수와 고객 전달 완료를 구분해야 합니다.

개인정보 보관 기간·삭제 정책 및 법정 안내 문구는 운영 기준을 확정해야 합니다. 이 구현만으로 법적 요건 충족을 단정하지 않습니다.
