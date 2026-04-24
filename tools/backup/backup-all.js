// Firestore + RTDB 동시 백업 래퍼
// 실행: node backup/backup-all.js  (또는 npm run backup)
const { spawnSync } = require('child_process');
const path = require('path');

console.log('========== KGM 성수 백업 시작 ==========');
console.log('시각: ' + new Date().toLocaleString('ko-KR'));
console.log('');

const scripts = ['backup-firestore.js', 'backup-rtdb.js'];
let allOk = true;

for (const script of scripts) {
  const result = spawnSync('node', [path.join(__dirname, script)], { stdio: 'inherit' });
  if (result.status !== 0) {
    allOk = false;
    console.error('❌ ' + script + ' 실패');
  }
  console.log('');
}

if (allOk) {
  console.log('========== ✅ 모든 백업 성공 ==========');
  console.log('백업 폴더: tools/backup/backups/' + new Date().toISOString().split('T')[0]);
  process.exit(0);
} else {
  console.log('========== ⚠️ 일부 백업 실패 ==========');
  process.exit(1);
}
