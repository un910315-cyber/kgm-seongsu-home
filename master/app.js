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

// ── 2단계: Claude 중계 서버 (Deno Deploy) ──
// 비어 있으면 1단계(키워드 응답) 모드로 작동. Worker 오류 시에도 키워드 모드로 자동 폴백.
const WORKER_URL = 'https://trusty-crane-45.un910315-cyber.deno.net/';

// ── DOM ──
const $ = (id) => document.getElementById(id);
const loginScreen = $('loginScreen');
const appEl = $('app');
const loginBtn = $('googleLoginBtn');
const loginErr = $('loginError');
const logoutBtn = $('logoutBtn');
const orb = $('orb');
const capYou = $('capYou');
const capJv = $('capJv');
const hint = $('hint');
const textInput = $('textInput');
const sendBtn = $('sendBtn');
const kbToggle = $('kbToggle');
const inputWrap = $('inputWrap');
const handsfreeBtn = $('handsfreeBtn');

// ── 데이터 저장소 (Firebase 실시간 동기화) ──
const store = { records: {}, blacklist: {}, salesDaily: {}, kgmDaily: {}, emps: {}, usage: {}, aos: {} };
let dataReady = false;

// ════════════════════════════════════════════════
//  인증
// ════════════════════════════════════════════════
getRedirectResult(auth).catch((e) => {
  if (e && e.message) loginErr.textContent = '로그인 실패: ' + e.message;
});

loginBtn.addEventListener('click', () => {
  loginErr.textContent = '';
  signInWithPopup(auth, provider).catch(() => {
    signInWithRedirect(auth, provider).catch((e) => {
      loginErr.textContent = '로그인 실패: ' + (e.message || '');
    });
  });
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.style.display = 'none';
    appEl.style.display = 'flex';
    if (!dataReady) startDataSync();
    greet((user.displayName || '').trim());
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
  bind('aosClaims', 'aos');
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

// ════════════════════════════════════════════════
//  의도 해석 — 질문 → 답변 문자열
// ════════════════════════════════════════════════
function answer(raw) {
  const q = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!q) return '다시 한 번 말씀해 주시겠어요?';
  if (!dataReady) return '데이터를 아직 불러오는 중이에요. 잠시 후 다시 물어봐 주세요.';

  if (/(안녕|반가|하이|헬로|좋은\s?아침)/.test(q)) {
    return '안녕하세요 대표님. 무엇을 도와드릴까요?';
  }
  if (/(뭐.*할 수|뭘 할 수|할 수 있|도움말|기능|어떻게 써)/.test(q)) {
    return '저는 정비소 현황을 알려드려요.\n예를 들어 — "오늘 차량 현황", "수리 대기 차량", "12가3456 어디 있어", "이번 달 매출", "이동근 연차" 처럼 물어봐 주세요.';
  }
  if (/(몇 시|지금 시간|시간 알려)/.test(q)) {
    const d = new Date();
    return '지금은 ' + d.getHours() + '시 ' + d.getMinutes() + '분입니다.';
  }
  if (/(며칠|무슨 요일|오늘 날짜|날짜 알려)/.test(q)) {
    const d = new Date();
    return '오늘은 ' + d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() +
           '일, ' + WEEKDAYS[d.getDay()] + '요일입니다.';
  }

  const carM = q.match(/\d{2,3}\s*[가-힣]\s*\d{3,4}/);
  if (carM) {
    const target = normCar(carM[0]);
    if (/블랙/.test(q)) return blacklistLookup(target);
    return vehicleLookup(target);
  }

  if (/블랙리스트|블랙\s?고객|요주의/.test(q)) {
    const list = Object.values(store.blacklist || {});
    if (!list.length) return '등록된 블랙리스트 차량이 없습니다.';
    const names = list.slice(0, 6).map((b) => b.carNum).join(', ');
    return '블랙리스트에 ' + list.length + '대가 등록되어 있습니다. ' + names +
           (list.length > 6 ? ' 외 ' + (list.length - 6) + '대' : '') + '.';
  }

  if (/매출|수입|돈\s?얼마|얼마.*벌/.test(q)) {
    if (/어제/.test(q)) return salesOf(todayStr(-1), '어제');
    if (/이번\s?달|월\s?매출|이달/.test(q)) return monthSales();
    return salesOf(todayStr(), '오늘');
  }

  if (/(오늘.*입고|입고.*몇|오늘 들어온|금일 입고)/.test(q)) {
    const n = recordsArr().filter((r) => r.inDate === todayStr()).length;
    return n ? ('오늘 입고된 차량은 ' + n + '대입니다.') : '오늘 입고된 차량은 아직 없습니다.';
  }

  if (/수리\s?완료|완료.*차|출고\s?대기/.test(q)) return statusList('수리완료', '수리 완료');
  if (/수리\s?중|작업\s?중/.test(q)) return statusList('수리중', '수리 중');
  if (/수리\s?대기|대기.*차|대기\s?중/.test(q)) return statusList('수리대기', '수리 대기');

  if (/연차|휴가|남은\s?휴/.test(q)) {
    const emp = Object.entries(store.emps || {})
      .map(([id, e]) => Object.assign({ id }, e))
      .find((e) => e.name && q.includes(e.name));
    if (emp) return leaveOf(emp);
    return '누구의 연차를 알려드릴까요? 직원 이름과 함께 물어봐 주세요. 예: "이동근 연차".';
  }

  if (/(현황|상황|요약|차량.*몇|어때|오늘\s?어때|브리핑)/.test(q)) {
    return statusSummary();
  }

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
  const items = list.slice(0, 8).map((r) => {
    return r.carNum + (r.location ? ' (' + r.location + ')' : '');
  }).join(', ');
  const more = list.length > 8 ? ' 외 ' + (list.length - 8) + '대' : '';
  return label + ' 차량은 ' + list.length + '대입니다. ' + items + more + '.';
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
  return label + ' 매출은 공임·부품 합계 ' + won(total) +
         ', 수납금계 ' + won(Number(rec.received) || 0) + '입니다.';
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

// 직원 연차 사용 시간 — 내부 페이지와 동일 규칙
// (연차=8h, 반차=4h는 type으로만 저장됨 / 조퇴·외출은 hours 값 사용)
function leaveUsedHours(empId) {
  let h = 0;
  Object.values(store.usage || {}).forEach((u) => {
    if (!u || u.empId !== empId) return;
    if (u.type === '연차') h += 8;
    else if (u.type === '오전반차' || u.type === '오후반차' || u.type === '반차') h += 4;
    else h += (parseInt(u.hours, 10) || 0);
  });
  return h;
}

function leaveOf(emp) {
  const total = Number(emp.totalLeave) || 0;
  const usedDays = Math.round((leaveUsedHours(emp.id) / 8) * 10) / 10;
  const remain = Math.round((total - usedDays) * 10) / 10;
  if (!total) return emp.name + '님의 연차 일수가 아직 등록되어 있지 않습니다.';
  return emp.name + '님은 연차 ' + total + '일 중 ' + usedDays + '일 사용, ' +
         remain + '일 남았습니다.';
}

// ════════════════════════════════════════════════
//  화면 — 자막 / 상태 / 오브
// ════════════════════════════════════════════════
function setStatus(t) { hint.textContent = t || ''; }

// ── 자비스 아바타 (캔버스 — idle/listening/thinking/speaking) ──
const jarvisAvatar = (function () {
  const canvas = document.getElementById('jarvisAvatar');
  if (!canvas || !canvas.getContext) return { setState: function () {} };
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, t = 0;
  let avState = 'idle';
  let particles = [];

  const config = {
    idle:      { speed: 0.55, pulse: 0.025, density: 0.78 },
    listening: { speed: 0.95, pulse: 0.05,  density: 1.0 },
    thinking:  { speed: 1.2,  pulse: 0.065, density: 1.12 },
    speaking:  { speed: 1.7,  pulse: 0.11,  density: 1.35 }
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.floor(Math.min(820, Math.max(420, w * h / 1400)));
    particles = Array.from({ length: count }, function () {
      return {
        a: Math.random() * Math.PI * 2,
        r: Math.pow(Math.random(), 0.48),
        z: Math.random(),
        s: 0.002 + Math.random() * 0.004,
        size: 0.7 + Math.random() * 2.1,
        hot: Math.random() > 0.64,
        wobble: Math.random() * Math.PI * 2
      };
    });
  }

  function drawCore(cx, cy, radius, mode) {
    const beat = Math.sin(t * 0.08 * mode.speed);
    const pulseRadius = radius * (0.14 + Math.abs(beat) * mode.pulse);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.2, 'rgba(126,233,255,0.78)');
    glow.addColorStop(0.52, 'rgba(255,150,70,0.3)');
    glow.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawRings(cx, cy, radius, mode) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const spin = t * 0.004 * mode.speed * (i % 2 ? -1 : 1);
      const rx = radius * (0.45 + i * 0.075);
      const ry = radius * (0.18 + i * 0.047);
      ctx.rotate(spin);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, spin, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 ? 'rgba(255,156,82,0.16)' : 'rgba(126,233,255,0.18)';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 18;
      ctx.shadowColor = i % 2 ? '#ff9c52' : '#7ee9ff';
      ctx.stroke();
      ctx.rotate(-spin);
    }
    ctx.restore();
  }

  function drawParticles(cx, cy, radius, mode) {
    const visibleCount = Math.floor(particles.length * mode.density);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < visibleCount; i++) {
      const p = particles[i];
      if (!p) continue;
      const angle = p.a + t * p.s * mode.speed + Math.sin(t * 0.018 + p.wobble) * 0.08;
      const shell = radius * (0.2 + p.r * 0.92);
      const flat = 0.56 + Math.sin(angle * 2 + t * 0.012) * 0.14;
      const x = cx + Math.cos(angle) * shell * (0.88 + p.z * 0.2);
      const y = cy + Math.sin(angle) * shell * flat + Math.cos(angle * 3) * 18 * p.z;
      const alpha = 0.25 + Math.random() * 0.45;
      ctx.beginPath();
      ctx.fillStyle = p.hot ? 'rgba(255,156,82,' + alpha + ')' : 'rgba(126,233,255,' + alpha + ')';
      ctx.shadowBlur = p.hot ? 15 : 11;
      ctx.shadowColor = p.hot ? '#ff9c52' : '#7ee9ff';
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (i % 7 === 0) {
        const p2 = particles[(i + 31) % visibleCount];
        if (!p2) continue;
        const angle2 = p2.a + t * p2.s * mode.speed;
        const shell2 = radius * (0.2 + p2.r * 0.92);
        const x2 = cx + Math.cos(angle2) * shell2;
        const y2 = cy + Math.sin(angle2) * shell2 * 0.56;
        if (Math.hypot(x - x2, y - y2) < radius * 0.42) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(126,233,255,0.12)';
          ctx.lineWidth = 0.8;
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function draw() {
    t += 1;
    const mode = config[avState] || config.idle;
    if (w && h) {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const radius = Math.min(w, h) * 0.38 * (1 + Math.sin(t * 0.04) * mode.pulse);
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, radius * 1.6));
      bg.addColorStop(0, 'rgba(80,190,230,0.16)');
      bg.addColorStop(0.48, 'rgba(255,140,70,0.06)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      drawRings(cx, cy, radius, mode);
      drawParticles(cx, cy, radius, mode);
      drawCore(cx, cy, radius, mode);
    }
    requestAnimationFrame(draw);
  }

  if (window.ResizeObserver) {
    try { new ResizeObserver(resize).observe(canvas); } catch (e) {}
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);

  return { setState: function (s) { if (config[s]) avState = s; } };
})();

function setOrb(state) {
  orb.className = 'orb ' + state;
  jarvisAvatar.setState(state);
}

// 자막 페이드 인 (영화처럼 떠올랐다 사라짐)
function fadeIn(el, text) {
  el.textContent = text || '';
  el.classList.remove('show');
  void el.offsetWidth;
  if (text) el.classList.add('show');
}

const IDLE_HINT = '오브를 탭하고 말씀하세요  ·  예) "오늘 차량 현황"';

let greeted = false;
function greet(name) {
  if (greeted) return;
  greeted = true;
  fadeIn(capJv, (name ? name + '님, ' : '') + '안녕하세요. 자비스입니다.\n무엇을 도와드릴까요?');
  setStatus(!recog ? '음성 입력이 안 되는 기기예요. 키보드로 입력해 주세요.'
    : (continuousMode ? '오브를 한 번 탭하면 계속 대화할 수 있어요' : IDLE_HINT));
  setOrb('idle');
  if (!recog) openKeyboard();
}

// ════════════════════════════════════════════════
//  음성 출력 (TTS) + 음성 설정
// ════════════════════════════════════════════════
const VOICE_KEY = 'jarvis_voice_v1';
const voicePrefs = { voiceURI: '', rate: 1.0, pitch: 1.0 };
try { Object.assign(voicePrefs, JSON.parse(localStorage.getItem(VOICE_KEY) || '{}')); } catch (e) {}
function saveVoicePrefs() {
  try { localStorage.setItem(VOICE_KEY, JSON.stringify(voicePrefs)); } catch (e) {}
}

function allVoices() {
  return window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}
function sortedVoices() {
  return allVoices().slice().sort((a, b) => {
    const ak = /ko/i.test(a.lang) ? 0 : 1;
    const bk = /ko/i.test(b.lang) ? 0 : 1;
    if (ak !== bk) return ak - bk;
    return a.name.localeCompare(b.name);
  });
}
function currentVoice() {
  const vs = allVoices();
  if (voicePrefs.voiceURI) {
    const hit = vs.find((v) => v.voiceURI === voicePrefs.voiceURI);
    if (hit) return hit;
  }
  return vs.find((v) => v.lang === 'ko-KR') || vs.find((v) => /ko/i.test(v.lang)) || null;
}

let ttsPrimed = false;
// 사용자 제스처(탭/전송) 안에서 음성 출력을 미리 깨운다.
// 안드로이드·크롬은 첫 음성을 제스처 안에서 한 번 풀어주지 않으면 무음이 됨.
function primeTTS() {
  if (!window.speechSynthesis) return;
  try { window.speechSynthesis.resume(); } catch (e) {}
  if (ttsPrimed) return;
  ttsPrimed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

// ── 연속 대화(핸즈프리) 모드 ── 기본 ON
// 답변이 끝날 때마다 마이크가 자동으로 다시 열려서, 매번 탭하지 않아도 됨.
// (브라우저 보안상 첫 마이크는 사용자가 한 번 탭해야 켜짐)
let continuousMode = true;
try { if (localStorage.getItem('jarvis_handsfree') === '0') continuousMode = false; } catch (e) {}
function reListen() {
  if (!continuousMode) return;
  setTimeout(() => { if (continuousMode && !listening) startListening(); }, 450);
}
// 자비스가 말을 끝냈을 때 공통 처리
function onSpeakDone() {
  setOrb('idle');
  setStatus(continuousMode ? '연속 대화 모드 — 말씀하세요' : IDLE_HINT);
  reListen();
}

function speak(text) {
  if (!window.speechSynthesis) { onSpeakDone(); return; }
  try { window.speechSynthesis.cancel(); } catch (e) {}
  try { window.speechSynthesis.resume(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(String(text).replace(/[⚠️]/g, ''));
  const v = currentVoice();
  u.lang = (v && v.lang) || 'ko-KR';
  if (v) u.voice = v;
  u.rate = voicePrefs.rate;
  u.pitch = voicePrefs.pitch;
  let started = false;
  u.onstart = () => { started = true; setOrb('speaking'); };
  u.onend = () => onSpeakDone();
  u.onerror = () => onSpeakDone();
  window.speechSynthesis.speak(u);
  // 워치독 — 음성이 안 켜져도 오브가 '생각 중'에 멈추지 않도록
  setTimeout(() => { if (!started) onSpeakDone(); }, 1600);
}

// 중계서버가 보내준 자연스러운 음성 재생. 실패 시 폰 기본 음성으로 폴백.
// data URI를 바로 재생하면 모바일에서 시작이 끊기므로, Blob URL로 변환하고
// 충분히 버퍼된 뒤(canplaythrough) 재생한다.
const jarvisAudio = new Audio();
jarvisAudio.preload = 'auto';
let jarvisAudioUrl = null;
function revokeJarvisUrl() {
  if (jarvisAudioUrl) {
    try { URL.revokeObjectURL(jarvisAudioUrl); } catch (e) {}
    jarvisAudioUrl = null;
  }
}
function speakAudio(dataUri, fallbackText) {
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  let started = false, handled = false;
  const fallback = () => {
    if (!started && !handled) { handled = true; revokeJarvisUrl(); speak(fallbackText); }
  };

  let url;
  try {
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
  } catch (e) { speak(fallbackText); return; }

  revokeJarvisUrl();
  jarvisAudioUrl = url;

  jarvisAudio.onplay = () => { started = true; setOrb('speaking'); };
  jarvisAudio.onended = () => { revokeJarvisUrl(); onSpeakDone(); };
  jarvisAudio.onerror = fallback;
  jarvisAudio.oncanplaythrough = () => { jarvisAudio.play().catch(fallback); };

  jarvisAudio.src = url;
  jarvisAudio.load();
  // canplaythrough 가 안 와도 0.9초 뒤엔 재생 시도
  setTimeout(() => { if (!started) jarvisAudio.play().catch(fallback); }, 900);
}

// ── 음성 설정 시트 ──
const settingsModal = $('settingsModal');
const voiceSelect = $('voiceSelect');
const voiceHint = $('voiceHint');
const rateRange = $('rateRange');
const pitchRange = $('pitchRange');
const rateVal = $('rateVal');
const pitchVal = $('pitchVal');

function populateVoices() {
  const vs = sortedVoices();
  voiceSelect.innerHTML = '';
  if (!vs.length) {
    const o = document.createElement('option');
    o.textContent = '음성을 불러오는 중…';
    voiceSelect.appendChild(o);
    voiceHint.textContent = '';
    return;
  }
  vs.forEach((v) => {
    const o = document.createElement('option');
    o.value = v.voiceURI;
    o.textContent = (/ko/i.test(v.lang) ? '🇰🇷 ' : '') + v.name + ' (' + v.lang + ')';
    voiceSelect.appendChild(o);
  });
  const cur = currentVoice();
  if (cur) voiceSelect.value = cur.voiceURI;
  const koCount = vs.filter((v) => /ko/i.test(v.lang)).length;
  voiceHint.textContent = koCount > 1
    ? '한국어 음성 ' + koCount + '개가 있어요. 골라서 미리듣기 해보세요.'
    : '이 기기엔 한국어 음성이 1개뿐이에요. 휴대폰 [설정 > 접근성 > TTS]에서 음성 엔진을 추가하면 선택지가 늘어납니다.';
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    if (!settingsModal.hidden) populateVoices();
  };
}

function openSettings() {
  populateVoices();
  rateRange.value = voicePrefs.rate;
  pitchRange.value = voicePrefs.pitch;
  rateVal.textContent = Number(voicePrefs.rate).toFixed(2);
  pitchVal.textContent = Number(voicePrefs.pitch).toFixed(2);
  settingsModal.hidden = false;
}
function closeSettings() {
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  setOrb('idle');
  settingsModal.hidden = true;
}

$('settingsBtn').addEventListener('click', openSettings);
$('settingsClose').addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });

voiceSelect.addEventListener('change', () => {
  voicePrefs.voiceURI = voiceSelect.value;
  saveVoicePrefs();
});
rateRange.addEventListener('input', () => {
  voicePrefs.rate = Number(rateRange.value);
  rateVal.textContent = voicePrefs.rate.toFixed(2);
  saveVoicePrefs();
});
pitchRange.addEventListener('input', () => {
  voicePrefs.pitch = Number(pitchRange.value);
  pitchVal.textContent = voicePrefs.pitch.toFixed(2);
  saveVoicePrefs();
});
$('voiceTestBtn').addEventListener('click', () => {
  speak('안녕하세요 대표님, 자비스입니다. 이 목소리는 어떠세요?');
});

// ════════════════════════════════════════════════
//  Claude 중계 서버 연동 (2단계)
// ════════════════════════════════════════════════
// 정비소 데이터를 Claude가 이해할 수 있는 압축 텍스트로 만든다.
function buildContext() {
  if (!dataReady) return '';
  const recs = recordsArr();
  const lines = ['오늘 날짜: ' + todayStr() + ' (' + WEEKDAYS[new Date().getDay()] + '요일)'];

  const fmt = (arr) => arr.slice(0, 30).map((r) => {
    let s = r.carNum || '?';
    if (r.carModel) s += '/' + r.carModel;
    if (r.location) s += '/' + r.location;
    if (r.inDate) s += '/입고' + r.inDate;
    return s;
  }).join('; ');
  const byStatus = (s) => recs.filter((r) => r.status === s);
  const wait = byStatus('수리대기'), repair = byStatus('수리중'), done = byStatus('수리완료');
  lines.push('수리대기 ' + wait.length + '대: ' + (fmt(wait) || '없음'));
  lines.push('수리중 ' + repair.length + '대: ' + (fmt(repair) || '없음'));
  lines.push('수리완료(출고대기) ' + done.length + '대: ' + (fmt(done) || '없음'));
  lines.push('오늘 입고: ' + recs.filter((r) => r.inDate === todayStr()).length + '대');

  const sd = store.salesDaily || {};
  const g = (o) => (Number(o && o.labor) || 0) + (Number(o && o.parts) || 0);
  const sumDay = (rec) => rec ? (g(rec.warranty) + g(rec.func) + g(rec.disaster)) : 0;
  const today = sd[todayStr()], yest = sd[todayStr(-1)];
  if (today) lines.push('오늘 매출: 공임·부품 ' + won(sumDay(today)) + ', 수납금계 ' + won(today.received || 0));
  if (yest) lines.push('어제 매출: 공임·부품 ' + won(sumDay(yest)) + ', 수납금계 ' + won(yest.received || 0));
  let mTot = 0, mRec = 0, mDays = 0;
  const prefix = todayStr().slice(0, 7);
  Object.entries(sd).forEach(([d, rec]) => {
    if (d.startsWith(prefix) && rec) { mTot += sumDay(rec); mRec += Number(rec.received) || 0; mDays++; }
  });
  lines.push('이번 달 매출(' + mDays + '일치): 공임·부품 ' + won(mTot) + ', 수납금계 ' + won(mRec));

  Object.entries(store.emps || {}).forEach(([id, e]) => {
    if (!e || !e.name) return;
    const ud = Math.round((leaveUsedHours(id) / 8) * 10) / 10;
    const total = Number(e.totalLeave) || 0;
    lines.push('연차 ' + e.name + ': 총 ' + total + '일, 사용 ' + ud + '일, 잔여 ' + (Math.round((total - ud) * 10) / 10) + '일');
  });

  const bl = Object.values(store.blacklist || {});
  if (bl.length) {
    lines.push('블랙리스트 ' + bl.length + '대: ' +
      bl.slice(0, 20).map((b) => b.carNum + '(' + (b.reason || '사유미기재') + ')').join('; '));
  }

  // AOS 보험청구 미수금
  const aosDates = Object.keys(store.aos || {}).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (aosDates.length) {
    const latestD = aosDates[aosDates.length - 1];
    const latest = (store.aos[latestD] || {}).claims || {};
    const prevD = aosDates.length >= 2 ? aosDates[aosDates.length - 2] : null;
    const prev = prevD ? ((store.aos[prevD] || {}).claims || {}) : {};
    const owed = Object.values(latest).filter((c) => (Number(c.payAmount) || 0) <= 0);
    const owedTotal = owed.reduce((s, c) => s + (Number(c.claimAmount) || 0), 0);
    const paidNew = [];
    Object.keys(latest).forEach((k) => {
      const c = latest[k];
      const pp = prev[k] ? (Number(prev[k].payAmount) || 0) : 0;
      if ((Number(c.payAmount) || 0) > 0 && pp <= 0) paidNew.push(c);
    });
    const paidTotal = paidNew.reduce((s, c) => s + (Number(c.payAmount) || 0), 0);
    const fmtClaim = (c, amt) => c.carNum + (c.carName ? '/' + c.carName : '')
      + (c.insurer ? ' ' + c.insurer : '') + ' ' + won(amt);
    lines.push('');
    lines.push('[AOS 보험청구 미수금] ' + latestD + ' 기준');
    lines.push('미수금 합계: ' + won(owedTotal) + ' (' + owed.length + '건)');
    if (prevD) {
      lines.push('최근 입금(' + prevD + '→' + latestD + '): ' + won(paidTotal) + ' (' + paidNew.length + '건)');
      if (paidNew.length) {
        lines.push('입금된 청구: ' + paidNew.slice(0, 40).map((c) => fmtClaim(c, c.payAmount)).join('; '));
      }
    }
    if (owed.length) {
      const owedSorted = owed.slice().sort((a, b) => (Number(b.claimAmount) || 0) - (Number(a.claimAmount) || 0));
      lines.push('미수 청구(금액 큰 순): ' + owedSorted.slice(0, 40).map((c) => fmtClaim(c, c.claimAmount)).join('; '));
    }
  }

  return lines.join('\n');
}

async function askWorker(question) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: question, context: buildContext() }),
  });
  if (!res.ok) throw new Error('worker ' + res.status);
  const data = await res.json();
  if (!data || !data.answer) throw new Error(data && data.error ? data.error : 'no answer');
  return data;
}

// ════════════════════════════════════════════════
//  질문 처리 흐름
// ════════════════════════════════════════════════
async function handleQuery(text) {
  const q = String(text || '').trim();
  if (!q) return;
  fadeIn(capYou, '“' + q + '”');
  fadeIn(capJv, '');
  setOrb('thinking');
  setStatus('생각하는 중…');

  let reply, audio = null;
  if (WORKER_URL) {
    try {
      const data = await askWorker(q);
      reply = data.answer;
      audio = data.audio || null;
    } catch (e) {
      // 중계 서버 실패 → 1단계 키워드 모드로 폴백
      reply = answer(q);
    }
  } else {
    await new Promise((r) => setTimeout(r, 360));
    reply = answer(q);
  }
  fadeIn(capJv, reply);
  capJv.scrollTop = 0;
  if (audio) speakAudio(audio, reply);
  else speak(reply);
}

// ── 키보드 입력 (보조) ──
function openKeyboard() {
  inputWrap.hidden = false;
  kbToggle.classList.add('on');
  textInput.focus();
}
function closeKeyboard() {
  inputWrap.hidden = true;
  kbToggle.classList.remove('on');
}
kbToggle.addEventListener('click', () => {
  if (inputWrap.hidden) openKeyboard();
  else closeKeyboard();
});
function submitText() {
  const v = textInput.value.trim();
  if (!v) return;
  primeTTS();
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
    // 마이크 미터 실패해도 음성 인식엔 지장 없음
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
      setContinuous(false);
      setStatus('마이크 권한이 필요해요. 키보드로 입력해 주세요.');
      openKeyboard();
    } else if (e.error === 'no-speech') {
      if (continuousMode) { setStatus('연속 대화 모드 — 말씀하세요'); reListen(); }
      else setStatus('말소리를 못 들었어요. 오브를 다시 탭해 주세요.');
    } else {
      if (continuousMode) reListen();
      else setStatus(IDLE_HINT);
    }
  };
  recog.onend = () => {
    if (listening) stopListening();
  };
}

function startListening() {
  if (!recog || listening) return;
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  listening = true;
  setOrb('listening');
  setStatus('듣고 있어요…');
  startMicMeter();
  try {
    recog.start();
  } catch (e) {
    stopListening();
  }
}
function stopListening() {
  if (!listening) return;
  listening = false;
  stopMicMeter();
  try { recog.stop(); } catch (e) {}
  if (orb.classList.contains('listening')) setOrb('idle');
}

// 오브 = 자비스 본체. 탭하면 듣기 시작/중지.
orb.addEventListener('click', () => {
  if (!settingsModal.hidden) return;
  primeTTS();
  if (listening) { stopListening(); return; }
  // 말하는 중에 탭하면 멈춤
  if (orb.classList.contains('speaking')) {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    try { jarvisAudio.pause(); } catch (e) {}
    setOrb('idle');
    setStatus(continuousMode ? '연속 대화 모드 — 말씀하세요' : IDLE_HINT);
    return;
  }
  if (!recog) { openKeyboard(); return; }
  startListening();
});

// 연속 대화(핸즈프리) 모드 토글
function setContinuous(on) {
  continuousMode = on;
  try { localStorage.setItem('jarvis_handsfree', on ? '1' : '0'); } catch (e) {}
  if (handsfreeBtn) handsfreeBtn.classList.toggle('on', on);
  if (on) {
    primeTTS();
    if (!recog) {
      continuousMode = false;
      if (handsfreeBtn) handsfreeBtn.classList.remove('on');
      openKeyboard();
      return;
    }
    if (!listening) startListening();
    else setStatus('연속 대화 모드 — 말씀하세요');
  } else {
    stopListening();
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    try { jarvisAudio.pause(); } catch (e) {}
    setOrb('idle');
    setStatus(IDLE_HINT);
  }
}
if (handsfreeBtn) {
  handsfreeBtn.classList.toggle('on', continuousMode);
  handsfreeBtn.addEventListener('click', () => {
    if (!settingsModal.hidden) return;
    setContinuous(!continuousMode);
  });
}

// ════════════════════════════════════════════════
//  서비스 워커
// ════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
  });
}
