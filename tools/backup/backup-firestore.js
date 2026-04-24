// Firestore → JSON 백업
// 실행: node backup/backup-firestore.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'service-account-key.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('❌ service-account-key.json 파일을 찾을 수 없습니다.');
  console.error('   위치: ' + KEY_PATH);
  console.error('   Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성');
  process.exit(1);
}

const serviceAccount = require(KEY_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const COLLECTIONS = ['users', 'estimates', 'mappings', 'partsQuotes', 'access_requests'];

async function backupCollection(name) {
  const snap = await db.collection(name).get();
  const data = {};
  snap.forEach(doc => { data[doc.id] = doc.data(); });
  return data;
}

(async () => {
  const today = new Date().toISOString().split('T')[0];
  const outDir = path.join(__dirname, 'backups', today);
  fs.mkdirSync(outDir, { recursive: true });

  const result = {};
  for (const col of COLLECTIONS) {
    process.stdout.write(`[Firestore] ${col} 백업 중... `);
    try {
      result[col] = await backupCollection(col);
      console.log(Object.keys(result[col]).length + '건');
    } catch (e) {
      console.log('건너뜀 (' + e.code + ')');
      result[col] = {};
    }
  }

  const outPath = path.join(outDir, 'firestore.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('✅ Firestore 완료: ' + outPath + ' (' + sizeKB + ' KB)');
  process.exit(0);
})().catch(err => {
  console.error('❌ Firestore 백업 실패:', err.message);
  process.exit(1);
});
