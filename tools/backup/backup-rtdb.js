// Realtime Database → JSON 백업 (전체 트리 한 번에)
// 실행: node backup/backup-rtdb.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'service-account-key.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('❌ service-account-key.json 파일을 찾을 수 없습니다.');
  console.error('   위치: ' + KEY_PATH);
  process.exit(1);
}

const serviceAccount = require(KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://unmotors-default-rtdb.firebaseio.com'
});

(async () => {
  const today = new Date().toISOString().split('T')[0];
  const outDir = path.join(__dirname, 'backups', today);
  fs.mkdirSync(outDir, { recursive: true });

  process.stdout.write('[RTDB] 전체 트리 백업 중... ');
  const snap = await admin.database().ref('/').once('value');
  const data = snap.val() || {};

  const outPath = path.join(outDir, 'rtdb.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);

  // 노드별 항목 수 요약
  const summary = Object.keys(data).map(k => {
    const v = data[k];
    return '  - ' + k + ': ' + (v && typeof v === 'object' ? Object.keys(v).length + '건' : '단일값');
  }).join('\n');
  console.log('완료');
  console.log(summary);
  console.log('✅ RTDB 완료: ' + outPath + ' (' + sizeKB + ' KB)');
  process.exit(0);
})().catch(err => {
  console.error('❌ RTDB 백업 실패:', err.message);
  process.exit(1);
});
