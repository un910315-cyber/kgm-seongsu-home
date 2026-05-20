// KGM 자비스 — 1단계 (음성 비서, 키 없이 무료)
// 정비소 데이터(차량/매출/연차/블랙리스트)를 음성으로 조회.
// 2단계에서 Claude API + 날씨 연동 예정.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getAuth, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Firebase (un/ 내부 페이지와 동일 프로젝트) ──
const firebaseConfig = {
  apiKey: "AIzaSyDkXYh2P-EJPf2A_jwq2Kk2gDs0ZFdMP2M",
  authDomain: "unmotors.firebaseapp.com",
  databaseURL: "https://unmotors-default-rtdb.firebaseio.com",
  projectId: "unmotors",
  storageBucket: "unmotors.firebasestorage.app",
  messagingSenderId: "1065890938470",
  appId: "1:1065890938470:web:d6d1c3503322fd1d9eb7a7"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ── DOM ──
const $ = (id) => document.getElementById(id);
const loginScreen = $('loginScreen');
const appEl = $('app');
const loginBtn = $('googleLoginBtn');
const loginErr = $('loginError');
const logoutBtn = $('logoutBtn');
const whoText = $('whoText');
const orb = $('orb');
const statusEl = $('status');
const transcript = $('transcript');
const textInput = $('textInput');
const sendBtn = $('sendBtn');
const micBtn = $('micBtn');

// ── 데이터 저장소 (Firebase 실시간 동기화) ──
const store = { records: {}, blacklist: {}, salesDaily: {}, kgmDaily: {}, emps: {}, usage: {} };
let dataReady = false;

// ════════════════════════════════════════════════
//  인증
// ════════════════════════════════════════════════
getRedirectResult(auth).catch((e) => {
  if (e && e.message) showLoginError('로그인 실패: ' + e.message);
});

loginBtn.addEventListener('click', () => {
  loginErr.textContent = '';
  signInWithPopup(auth, provider).catch(() => {
    // 팝업이 막히면 리디렉트로 폴백
    signInWithRedirect(auth, provider).catch((e) => showLoginError('로그인 실패: ' + (e.message || '')));
  });
});

logoutBtn.addEventListener('click', () => signOut(auth));

function showLoginError(msg) { loginErr.textContent = msg; }

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.style.display = 'none';
    appEl.style.display = 'flex';
    const name = (user.displayName || '').trim();
    whoText.textContent = name ? name + '님' : '';
    if (!dataReady) startDataSync();
    greet(name);
  } else {
    appEl.style.display = 'none';
    loginScreen.style.display = 'flex';
  }
});

// ════════════════════════════════════════════════
//  데이터 동기화
// ════════════════════════════════════════════════
function startDataSync() {
  dataReady = true;
  const bind = (path, key) => onValue(ref(db, path),
    (s) => { store[key] = s.val() || {}; },
    (err) => console.warn('read fail:', path, err && err.message)
  );
  bind('records', 'records');
  bind('blacklist', 'blacklist');
  bind('salesDaily', 'salesDaily');
  bind('kgmDailyCount', 'kgmDaily');
  bind('leaveEmployees', 'emps');
  bind('leaveUsage', 'usage');
}

// ════════════════════════════════════════════════
//  유틸
// ════════════════════════════════════════════════
function todayStr(offset = 0) {
  const d = new Date();
  if (offset) d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function recordsArr() {
  return Object.entries(store.records || {}).map(([id, r]) => Object.assign({ id }, r));
}
function won(n) { return '₩' + Number(n || 0).toLocaleString('ko-KR'); }
function normCar(s) { return String(s || '').replace(/\s+/g, '').toUpperCase(); }
function shortDate(d) {
  if (!d) return '-';
  return String(d).slice(5).replace('-', '/');
}

// ════════════════════════════════════════════════
//  의도 해석 — 질문 → 답변 문자열
// ════════════════════════════════════════════════
function answer(raw) {
  const q = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!q) return '다시 한 번 말씀해 주시겠어요?';
  if (!dataReady) return '데이터를 아직 불러오는 중이에요. 잠시 후 다시 물어봐 주세요.';

  // 인사
  if (/(안녕|반가|하이|헬로|좋은\s?아침)/.test(q)) {
    return '안녕하세요 대표님. 무엇을 도와드릴까요?';
  }
  // 도움말
  if (/(뭐.*할 수|뭘 할 수|할 수 있|도움말|기능|어떻게 써)/.test(q)) {
    return '저는 정비소 현황을 알려드려요.\n예를 들어 — "오늘 차량 현황", "수리 대기 차량", "12가3456 어디 있어", "이번 달 매출", "이동근 연차" 처럼 물어봐 주세요.';
  }
  // 시간
  if (/(몇 시|지금 시간|시간 알려)/.test(q)) {
    const d = new Date();
    return '지금은 ' + d.getHours() + '시 ' + d.getMinutes() + '분입니다.';
  }
  // 날짜
  if (/(며칠|무슨 요일|오늘 날짜|날짜 알려)/.test(q)) {
    const d = new Date();
    return '오늘은 ' + d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() +
           '일, ' + WEEKDAYS[d.getDay()] + '요일입니다.';
  }

  // 차량번호가 포함된 질문
  const carM = q.match(/\d{2,3}\s*[가-힣]\s*\d{3,4}/);
  if (carM) {
    const target = normCar(carM[0]);
    // 블랙리스트 조회
    if (/블랙/.test(q)) return blacklistLookup(target);
    return vehicleLookup(target);
  }

  // 블랙리스트 전체
  if (/블랙리스트|블랙\s?고객|요주의/.test(q)) {
    const list = Object.values(store.blacklist || {});
    if (!list.length) return '등록된 블랙리스트 차량이 없습니다.';
    const names = list.slice(0, 6).map((b) => b.carNum).join(', ');
    return '블랙리스트에 ' + list.length + '대가 등록되어 있습니다. ' + names +
           (list.length > 6 ? ' 외 ' + (list.length - 6) + '대' : '') + '.';
  }

  // 매출
  if (/매출|수입|돈\s?얼마|얼마.*벌/.test(q)) {
    if (/어제/.test(q)) return salesOf(todayStr(-1), '어제');
    if (/이번\s?달|월\s?매출|이달/.test(q)) return monthSales();
    return salesOf(todayStr(), '오늘');
  }

  // 오늘 입고
  if (/(오늘.*입고|입고.*몇|오늘 들어온|금일 입고)/.test(q)) {
    const n = recordsArr().filter((r) => r.inDate === todayStr()).length;
    return n ? ('오늘 입고된 차량은 ' + n + '대입니다.') : '오늘 입고된 차량은 아직 없습니다.';
  }

  // 상태별 목록
  if (/수리\s?완료|완료.*차|출고\s?대기/.test(q)) return statusList('수리완료', '수리 완료');
  if (/수리\s?중|작업\s?중/.test(q)) return statusList('수리중', '수리 중');
  if (/수리\s?대기|대기.*차|대기\s?중/.test(q)) return statusList('수리대기', '수리 대기');

  // 연차 — 직원 이름 매칭
  if (/연차|휴가|남은\s?휴/.test(q)) {
    const emp = Object.entries(store.emps || {})
      .map(([id, e]) => Object.assign({ id }, e))
      .find((e) => e.name && q.includes(e.name));
    if (emp) return leaveOf(emp);
    return '누구의 연차를 알려드릴까요? 직원 이름과 함께 물어봐 주세요. 예: "이동근 연차".';
  }

  // 전체 현황 요약
  if (/(현황|상황|요약|차량.*몇|어때|오늘\s?어때|브리핑)/.test(q)) {
    return statusSummary();
  }

  // 매칭 실패
  return '아직 그건 제가 못 알아들어요. "오늘 차량 현황", "수리 대기 차량", "이번 달 매출" 같은 걸 물어봐 주시겠어요?';
}

function statusSummary() {
  const recs = recordsArr();
  const c = (s) => recs.filter((r) => r.status === s).length;
  const wait = c('수리대기'), repair = c('수리중'), done = c('수리완료');
  const today = recs.filter((r) => r.inDate === todayStr()).length;
  return '현재 수리 대기 ' + wait + '대, 수리 중 ' + repair + '대, 수리 완료 ' + done +
         '대입니다. 오늘 입고는 ' + today + '대예요.';
}

function statusList(status, label) {
  const list = recordsArr()
    .filter((r) => r.status === status)
    .sort((a, b) => String(a.inDate || '').localeCompare(String(b.inDate || '')));
  if (!list.length) return label + ' 차량은 없습니다.';
  const head = label + ' 차량은 ' + list.length + '대입니다. ';
  const items = list.slice(0, 8).map((r) => {
    const loc = r.location ? ' (' + r.location + ')' : '';
    return r.carNum + loc;
  }).join(', ');
  const more = list.length > 8 ? ' 외 ' + (list.length - 8) + '대' : '';
  return head + items + more + '.';
}

function vehicleLookup(target) {
  const hit = recordsArr().find((r) => normCar(r.carNum) === target);
  if (!hit) return target + ' 차량은 현재 등록된 기록에 없습니다.';
  const parts = [hit.carNum + ' 차량은 현재 "' + (hit.status || '상태 미정') + '" 상태입니다.'];
  if (hit.carModel) parts.push('차종은 ' + hit.carModel + '.');
  if (hit.location) parts.push('위치는 ' + hit.location + '.');
  if (hit.inDate) parts.push('입고일은 ' + hit.inDate + '.');
  const bl = store.blacklist && store.blacklist[target];
  if (bl) parts.push('⚠️ 이 차량은 블랙리스트입니다. 사유: ' + (bl.reason || '미기재') + '.');
  return parts.join(' ');
}

function blacklistLookup(target) {
  const bl = store.blacklist && store.blacklist[target];
  if (!bl) return target + ' 차량은 블랙리스트에 없습니다.';
  const sev = { high: '높음', medium: '보통', low: '낮음' }[bl.severity] || '미지정';
  return '⚠️ ' + (bl.carNum || target) + ' 차량은 블랙리스트입니다. 사유는 "' +
         (bl.reason || '미기재') + '", 심각도 ' + sev + '입니다.';
}

function salesOf(day, label) {
  const rec = (store.salesDaily || {})[day];
  if (!rec) return label + ' (' + day + ') 매출 보고는 아직 입력되지 않았습니다.';
  const g = (o) => (Number(o && o.labor) || 0) + (Number(o && o.parts) || 0);
  const total = g(rec.warranty) + g(rec.func) + g(rec.disaster);
  const received = Number(rec.received) || 0;
  return label + ' 매출은 공임·부품 합계 ' + won(total) +
         ', 수납금계 ' + won(received) + '입니다.';
}

function monthSales() {
  const prefix = todayStr().slice(0, 7);
  const g = (o) => (Number(o && o.labor) || 0) + (Number(o && o.parts) || 0);
  let total = 0, received = 0, days = 0;
  Object.entries(store.salesDaily || {}).forEach(([day, rec]) => {
    if (!day.startsWith(prefix) || !rec) return;
    total += g(rec.warranty) + g(rec.func) + g(rec.disaster);
    received += Number(rec.received) || 0;
    days++;
  });
  if (!days) return '이번 달 매출 보고가 아직 없습니다.';
  return '이번 달 매출은 공임·부품 합계 ' + won(total) +
         ', 수납금계 ' + won(received) + '입니다. ' + days + '일치 보고 기준이에요.';
}

function leaveOf(emp) {
  const total = Number(emp.totalLeave) || 0;
  let usedHours = 0;
  Object.values(store.usage || {}).forEach((u) => {
    if (u && u.empId === emp.id) usedHours += Number(u.hours) || 0;
  });
  const usedDays = Math.round((usedHours / 8) * 10) / 10;
  const remain = Math.round((total - usedDays) * 10) / 10;
  if (!total) return emp.name + '님의 연차 일수가 아직 등록되어 있지 않습니다.';
  return emp.name + '님은 연차 ' + total + '일 중 ' + usedDays + '일 사용, ' +
         remain + '일 남았습니다.';
}

// ════════════════════════════════════════════════
//  화면 — 대화 / 상태 / 오브
// ════════════════════════════════════════════════
function setStatus(t) { statusEl.textContent = t || ''; }

function setOrb(state) {
  orb.className = 'orb ' + state;
  if (state !== 'listening') orb.style.setProperty('--level', 0);
}

function addBubble(text, who) {
  const b = document.createElement('div');
  b.className = 'bubble ' + who;
  b.textContent = text;
  transcript.appendChild(b);
  transcript.scrollTop = transcript.scrollHeight;
  return b;
}

function showChips() {
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  ['오늘 차량 현황', '수리 대기 차량', '이번 달 매출'].forEach((label) => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = label;
    c.addEventListener('click', () => { wrap.remove(); handleQuery(label); });
    wrap.appendChild(c);
  });
  transcript.appendChild(wrap);
  transcript.scrollTop = transcript.scrollHeight;
}

let greeted = false;
function greet(name) {
  if (greeted) return;
  greeted = true;
  const hello = (name ? name + '님, ' : '') + '안녕하세요. 자비스입니다. 무엇을 도와드릴까요?';
  addBubble(hello, 'jv');
  showChips();
  setStatus('마이크를 누르고 말씀하세요');
  setOrb('idle');
}

// ════════════════════════════════════════════════
//  음성 출력 (TTS)
// ════════════════════════════════════════════════
let koVoice = null;
function pickVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  koVoice = voices.find((v) => v.lang === 'ko-KR') || voices.find((v) => /ko/i.test(v.lang)) || null;
}
if (window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text) {
  if (!window.speechSynthesis) { setOrb('idle'); return; }
  try { window.speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(text.replace(/[⚠️]/g, ''));
  u.lang = 'ko-KR';
  if (koVoice) u.voice = koVoice;
  u.rate = 1.04;
  u.pitch = 1.0;
  u.onstart = () => setOrb('speaking');
  u.onend = () => { setOrb('idle'); setStatus('마이크를 누르고 말씀하세요'); };
  u.onerror = () => { setOrb('idle'); };
  window.speechSynthesis.speak(u);
}

// ════════════════════════════════════════════════
//  질문 처리 흐름
// ════════════════════════════════════════════════
function handleQuery(text) {
  const q = String(text || '').trim();
  if (!q) return;
  addBubble(q, 'me');
  setOrb('thinking');
  setStatus('생각하는 중…');
  // 살짝 지연 — "생각하는" 상태가 보이도록
  setTimeout(() => {
    const reply = answer(q);
    addBubble(reply, 'jv');
    speak(reply);
  }, 420);
}

// ── 텍스트 입력 ──
function submitText() {
  const v = textInput.value.trim();
  if (!v) return;
  textInput.value = '';
  handleQuery(v);
}
sendBtn.addEventListener('click', submitText);
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitText(); }
});

// ════════════════════════════════════════════════
//  음성 입력 (STT) + 마이크 반응 오브
// ════════════════════════════════════════════════
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
let listening = false;

// 마이크 음량 → 오브 크기 (Web Audio)
let micStream = null, audioCtx = null, analyser = null, meterRAF = 0;
async function startMicMeter() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(1, (sum / data.length) / 70);
      orb.style.setProperty('--level', level.toFixed(2));
      meterRAF = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {
    // 마이크 미터 실패해도 음성 인식엔 지장 없음 — CSS 애니메이션만 사용
  }
}
function stopMicMeter() {
  if (meterRAF) cancelAnimationFrame(meterRAF);
  meterRAF = 0;
  analyser = null;
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
  orb.style.setProperty('--level', 0);
}

if (SR) {
  recog = new SR();
  recog.lang = 'ko-KR';
  recog.interimResults = true;
  recog.continuous = false;
  recog.maxAlternatives = 1;

  recog.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) setStatus('“' + interim + '”');
    if (final.trim()) {
      stopListening();
      handleQuery(final.trim());
    }
  };
  recog.onerror = (e) => {
    stopListening();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      setStatus('마이크 권한이 필요해요. 아래에 입력해 주세요.');
    } else if (e.error === 'no-speech') {
      setStatus('말소리를 못 들었어요. 다시 눌러주세요.');
    } else {
      setStatus('마이크를 누르고 말씀하세요');
    }
  };
  recog.onend = () => {
    if (listening) stopListening();
  };
} else {
  // 음성 인식 미지원 — 텍스트 입력만
  micBtn.disabled = true;
  micBtn.title = '이 브라우저는 음성 입력을 지원하지 않습니다';
}

function startListening() {
  if (!recog || listening) return;
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  listening = true;
  micBtn.classList.add('live');
  setOrb('listening');
  setStatus('듣고 있어요…');
  startMicMeter();
  try {
    recog.start();
  } catch (e) {
    // 이미 시작된 경우 등 — 상태 정리
    stopListening();
  }
}
function stopListening() {
  if (!listening) return;
  listening = false;
  micBtn.classList.remove('live');
  stopMicMeter();
  try { recog.stop(); } catch (e) {}
  if (orb.classList.contains('listening')) setOrb('idle');
}

micBtn.addEventListener('click', () => {
  if (listening) stopListening();
  else startListening();
});

// ════════════════════════════════════════════════
//  서비스 워커
// ════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
  });
}
