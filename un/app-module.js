// KGM 성수 내부 페이지 — 메인 모듈 (un-v2 리팩토링 2단계)
// Firebase 초기화 + 인증 + 거래·연차·게시판·블랙리스트 등 메인 로직

  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getDatabase, ref, onValue, push, update, remove, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
  import { getFirestore, collection, doc, setDoc, getDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import { getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject, listAll } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDkXYh2P-EJPf2A_jwq2Kk2gDs0ZFdMP2M",
    authDomain: "unmotors.firebaseapp.com",
    databaseURL: "https://unmotors-default-rtdb.firebaseio.com",
    projectId: "unmotors",
    storageBucket: "unmotors.firebasestorage.app",
    messagingSenderId: "1065890938470",
    appId: "1:1065890938470:web:d6d1c3503322fd1d9eb7a7",
    measurementId: "G-HG4L33W4KT"
  };

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const fsd = getFirestore(app);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  const storage = getStorage(app);
  getRedirectResult(auth).catch(function(e){
    var btn = document.getElementById('googleLoginBtn');
    var err = document.getElementById('loginError');
    if (btn) { btn.style.pointerEvents=''; btn.style.opacity=''; }
    if (err && e && e.message) {
      err.textContent = '로그인 실패: ' + e.message;
      err.style.display = 'block';
    }
  });
  const LOCAL_DASHBOARD_PREVIEW =
    new URLSearchParams(location.search).get('preview') === 'dashboard' &&
    ['127.0.0.1', 'localhost', ''].includes(location.hostname);
  // Storage 헬퍼 전역 노출 (사진 업로드/조회/삭제 로직에서 사용)
  window._storage = storage;
  window._sRef = sRef;
  window._uploadBytes = uploadBytes;
  window._getDownloadURL = getDownloadURL;
  window._deleteObject = deleteObject;
  window._listAll = listAll;

  // HTML escape (XSS 방지)
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  window.esc = esc;

  function renderLocalDashboardPreview() {
    document.body.classList.add('dashboard-preview');
    window._userRole = 'admin';
    window._userEmail = 'preview@local';
    window._userName = 'Preview';
    document.body.style.overflow = '';
    const loginScreen = document.getElementById('loginScreen');
    const loadingScreen = document.getElementById('loadingScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    if (loadingScreen) loadingScreen.style.display = 'none';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const dash = document.getElementById('page-dashboard');
    if (dash) dash.classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(tab => { tab.style.display = ''; });

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('stat-total', '22');
    setText('stat-wait', '7');
    setText('stat-repair', '5');
    setText('stat-done', '6');
    setText('stat-today', '7');
    setText('stat-kgm-today', '7');
    setText('stat-kgm-week', '24');
    setText('stat-kgm-month', '86');
    setText('stat-kgm-quarter', '214');
    setText('kgm-daily-avg', '4.3');
    setText('kgm-week-diff', '+6대 ↑');
    setText('daily-sales-date', '05/18 기준');
    setText('daily-parts-value', '1,240,000원');
    setText('daily-function-value', '820,000원');
    setText('monthly-deposit-value', '4,800,000원');
    setText('daily-parts-trend', '데이터 있음');
    setText('daily-function-trend', '데이터 있음');
    setText('deposit-status', '입력됨');

    const spark = (id, values, color) => {
      const el = document.getElementById(id);
      if (!el) return;
      const max = Math.max(1, ...values);
      const pts = values.map((v, i) => {
        const x = 6 + i * (188 / (values.length - 1));
        const y = 30 - (v / max * 22);
        return { x, y };
      });
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
      el.innerHTML = '<svg viewBox="0 0 204 34" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">'
        + '<path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<circle cx="'+pts[pts.length-1].x+'" cy="'+pts[pts.length-1].y+'" r="3.5" fill="'+color+'"/>'
        + '</svg>';
    };
    spark('daily-parts-spark', [0,2,1,3,5,4,6,7,5,8,9,8,10,9], '#fb923c');
    spark('daily-function-spark', [1,1,2,3,2,4,3,5,6,5,7,7,8,8], '#34d399');
    spark('deposit-spark', [3,4,3,5,6,8], '#fbbf24');

    const chart = document.getElementById('kgmIntakeChart');
    if (chart) {
      const values = [4,6,9,14,11,7,16,8,10,12,14,18,15,6];
      const max = Math.max(...values);
      const pts = values.map((v, i) => ({ x: 38 + i * 52, y: 136 - (v / max * 104), v }));
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ');
      const area = line + ' L ' + pts[pts.length-1].x + ' 148 L ' + pts[0].x + ' 148 Z';
      chart.innerHTML = '<svg viewBox="0 0 760 190" preserveAspectRatio="none" style="width:100%;height:185px;display:block;">'
        + '<defs><linearGradient id="previewArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity=".45"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity=".02"/></linearGradient></defs>'
        + '<line x1="30" y1="148" x2="736" y2="148" stroke="rgba(255,255,255,.06)" stroke-dasharray="3,3"/>'
        + '<line x1="30" y1="92" x2="736" y2="92" stroke="rgba(255,255,255,.06)" stroke-dasharray="3,3"/>'
        + '<path d="'+area+'" fill="url(#previewArea)"/>'
        + '<path d="'+line+'" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        + pts.map((p, i) => '<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#a78bfa" stroke="#111827" stroke-width="2"/><text x="'+p.x+'" y="172" text-anchor="middle" font-size="10" fill="#94a3b8">'+(i+5)+'</text>').join('')
        + '</svg>';
    }

    renderCumulativeSalesChart({
      parts: [18,22,21,25,30,28,33,36,34,38,41,43],
      func: [9,11,13,12,16,18,17,21,23,22,25,27],
      deposit: [5,6,6,7,7,8,9,9,10,11,12,13],
      partsAmount: 11820000,
      functionAmount: 6820000,
      depositAmount: 4800000,
      totalText: '18,640,000원',
      partsText: '11,820,000원',
      functionText: '6,820,000원'
    });

    const statsChart = document.getElementById('stats-chart');
    if (statsChart) {
      const months = [20,27,12,9,14,10,18,20,19,28,17,8,6,9,26,11,16,19,18,10,26,7,19,12,23,6,11,18,28,4,24];
      const max = Math.max(...months);
      statsChart.innerHTML = months.map((v, i) => {
        const h = Math.max(4, Math.round(v / max * 120));
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;">'
          + '<div style="width:100%;height:'+h+'px;border-radius:4px 4px 2px 2px;background:linear-gradient(180deg,#8b5cf6,#4c1d95);box-shadow:0 0 18px rgba(139,92,246,.18);"></div>'
          + (i % 2 === 0 ? '<div style="font-size:10px;color:#8b95a8;">'+(i+1)+'</div>' : '<div style="height:12px;"></div>')
          + '</div>';
      }).join('');
    }
  }

  function renderCumulativeSalesChart(opts) {
    const chart = document.getElementById('cumSalesChart');
    if (!chart) return;
    const parts = opts?.parts || [];
    const func = opts?.func || [];
    const deposit = opts?.deposit || [];
    const partsAmount = Number(opts?.partsAmount ?? parts[parts.length - 1]) || 0;
    const funcAmount = Number(opts?.functionAmount ?? func[func.length - 1]) || 0;
    const depositAmount = Number(opts?.depositAmount ?? deposit[deposit.length - 1]) || 0;
    const totalEl = document.getElementById('cum-sales-total');
    const partsEl = document.getElementById('cum-sales-parts');
    const funcEl = document.getElementById('cum-sales-function');
    if (totalEl) totalEl.textContent = opts?.totalText || '0원';
    if (partsEl) partsEl.textContent = opts?.partsText || '0원';
    if (funcEl) funcEl.textContent = opts?.functionText || '0원';
    const len = Math.max(parts.length, func.length, deposit.length, 1);
    const carry = (arr) => Array.from({ length: len }, (_, i) => {
      if (!arr.length) return 0;
      return Number(arr[Math.min(i, arr.length - 1)]) || 0;
    });
    const pSeries = carry(parts);
    const fSeries = carry(func);
    const dSeries = carry(deposit);
    const totals = pSeries.map((v, i) => v + fSeries[i] + dSeries[i]);
    const max = Math.max(1, ...totals, ...pSeries, ...fSeries, ...dSeries);
    const W = 760, H = 210, padL = 34, padR = 26, padT = 22, padB = 34;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const pt = (value, i) => ({
      x: padL + (len === 1 ? innerW / 2 : i * (innerW / (len - 1))),
      y: padT + innerH - (value / max) * innerH
    });
    const path = (values) => values.map((v, i) => {
      const p = pt(v, i);
      return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    }).join(' ');
    const areaPath = (() => {
      const top = path(totals);
      const first = pt(totals[0], 0);
      const last = pt(totals[totals.length - 1], totals.length - 1);
      const base = padT + innerH;
      return `${top} L ${last.x.toFixed(1)} ${base} L ${first.x.toFixed(1)} ${base} Z`;
    })();
    const lastX = pt(totals[totals.length - 1], totals.length - 1).x.toFixed(1);
    const labels = [
      { name: '\uBD80\uD488', value: partsAmount, color: '#fb923c' },
      { name: '\uAE30\uB2A5', value: funcAmount, color: '#34d399' },
      { name: '\uBCF4\uC99D\uAE08', value: depositAmount, color: '#fbbf24' }
    ];
    chart.innerHTML = '<svg viewBox="0 0 760 210" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">'
      + '<defs><linearGradient id="cumSalesTotalArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity=".22"/><stop offset="100%" stop-color="#38bdf8" stop-opacity=".015"/></linearGradient><filter id="cumSalesGlow"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
      + '<line x1="'+padL+'" y1="'+(padT+innerH)+'" x2="'+(W-padR)+'" y2="'+(padT+innerH)+'" stroke="rgba(255,255,255,.08)"/>'
      + '<line x1="'+padL+'" y1="'+(padT+innerH/2)+'" x2="'+(W-padR)+'" y2="'+(padT+innerH/2)+'" stroke="rgba(255,255,255,.055)" stroke-dasharray="4,6"/>'
      + '<path d="'+areaPath+'" fill="url(#cumSalesTotalArea)"/>'
      + '<path d="'+path(totals)+'" fill="none" stroke="#38bdf8" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#cumSalesGlow)"/>'
      + '<path d="'+path(pSeries)+'" fill="none" stroke="#fb923c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>'
      + '<path d="'+path(fSeries)+'" fill="none" stroke="#34d399" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>'
      + '<path d="'+path(dSeries)+'" fill="none" stroke="#fbbf24" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>'
      + '<circle cx="'+lastX+'" cy="'+pt(totals[totals.length - 1], totals.length - 1).y.toFixed(1)+'" r="5.5" fill="#e0f2fe" stroke="#0b1020" stroke-width="2.5"/>'
      + '<text x="'+lastX+'" y="'+Math.max(15, pt(totals[totals.length - 1], totals.length - 1).y - 12).toFixed(1)+'" text-anchor="middle" fill="#e0f2fe" font-size="11" font-weight="900">TOTAL</text>'
      + '</svg>';

    const mix = document.getElementById('cumSalesMixChart');
    if (mix) {
      const total = Math.max(1, partsAmount + funcAmount + depositAmount);
      mix.innerHTML = labels.map(item => {
        const pct = Math.round((item.value / total) * 100);
        return '<div class="cum-sales-breakdown-row" style="--seg-color:'+item.color+';--seg-width:'+pct+'%;">'
          + '<div class="cum-sales-breakdown-head"><span>'+item.name+'</span><strong>'+_fmtKRW(item.value)+'</strong><em>'+pct+'%</em></div>'
          + '<div class="cum-sales-breakdown-track"><i></i></div>'
          + '</div>';
      }).join('');
    }
    const mixMain = document.getElementById('cum-sales-mix-main');
    const mixSub = document.getElementById('cum-sales-mix-sub');
    const top = [
      { name: '부품 중심', value: partsAmount, pct: partsAmount / Math.max(1, partsAmount + funcAmount + depositAmount) },
      { name: '기능 중심', value: funcAmount, pct: funcAmount / Math.max(1, partsAmount + funcAmount + depositAmount) },
      { name: '보증 중심', value: depositAmount, pct: depositAmount / Math.max(1, partsAmount + funcAmount + depositAmount) }
    ].sort((a,b) => b.value - a.value)[0];
    if (mixMain) mixMain.textContent = top.name;
    if (mixSub) mixSub.textContent = '최대 비중 ' + Math.round(top.pct * 100) + '%';
  }

  // 전화번호 → tel: 링크 셀 (테이블 표시 + 클릭 다이얼)
  function phoneCell(phone) {
    if (!phone) return '-';
    var digits = String(phone).replace(/[^0-9+]/g, '');
    if (!digits) return esc(phone);
    return '<a href="tel:' + esc(digits) + '" onclick="event.stopPropagation();" style="color:var(--text);text-decoration:none;" title="전화 걸기"> ' + esc(phone) + '</a>';
  }

  // 역할��� 접근 가능 메뉴
  const ROLE_MENUS = {
    admin: ['dashboard','list','status','complete','out','migyeol','leave','board','estimate','insurance','sales','usermgmt'],
    staff: ['status','complete','leave','board','estimate','insurance','sales'],
    viewer: ['status','complete','leave','board']
  };
  // 'blacklist' 페이지는 ROLE_MENUS에 포함하지 않음 — 출고완료 페이지의 작은 버튼으로만 진입 (admin 전용 가드)

  // Google 로그인 — 팝업 방식 (모바일 포함)
  window.authGoogleLogin = async function(){
    try {
      document.getElementById('loginError').style.display='none';
      document.getElementById('loginDenied').style.display='none';
      document.getElementById('googleLoginBtn').style.pointerEvents='none';
      document.getElementById('googleLoginBtn').style.opacity='0.5';
      await signInWithPopup(auth, provider);
    } catch(e) {
      document.getElementById('googleLoginBtn').style.pointerEvents='';
      document.getElementById('googleLoginBtn').style.opacity='';
      // 사용자가 직접 취소한 경우는 에러 안 보여줌
      if(e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      document.getElementById('loginError').textContent='로그인 실패: '+e.message;
      document.getElementById('loginError').style.display='block';
    }
  };
  window.authSignOut = async function(){
    await signOut(auth);
    document.getElementById('loginDenied').style.display='none';
    document.getElementById('loginError').style.display='none';
    document.getElementById('googleLoginBtn').style.display='flex';
  };

  // 인증 상태 감시
  onAuthStateChanged(auth, async(user)=>{
    const loginScreen = document.getElementById('loginScreen');
    const loadingScreen = document.getElementById('loadingScreen');

    if(!user){
      if (LOCAL_DASHBOARD_PREVIEW) {
        renderLocalDashboardPreview();
        setTimeout(renderLocalDashboardPreview, 300);
        setTimeout(renderLocalDashboardPreview, 1000);
        return;
      }
      loginScreen.style.display='flex';
      document.body.style.overflow='hidden';
      return;
    }

    // 로그인됨 → Firestore에서 역할 확인
    document.getElementById('googleLoginBtn').style.display='none';
    try {
      const userDoc = await getDoc(doc(fsd, 'users', user.email));
      if(!userDoc.exists()){
        // 미등록 사용자 → Firestore에 접근 요청 기록
        await setDoc(doc(fsd, 'access_requests', user.email), {
          email: user.email,
          name: user.displayName || '',
          photo: user.photoURL || '',
          requestedAt: new Date().toISOString(),
          status: 'pending'
        });
        document.getElementById('loginDenied').style.display='block';
        return;
      }
      const userData = userDoc.data();
      const role = userData.role || 'viewer';
      window._userRole = role;
      window._userEmail = user.email;
      window._userName = user.displayName || user.email;

      // 메뉴 권한 적용
      const allowedMenus = ROLE_MENUS[role] || ROLE_MENUS.viewer;
      document.querySelectorAll('.nav-tab').forEach(tab=>{
        const page = tab.getAttribute('onclick')?.match(/switchPage\('(.+?)'\)/)?.[1];
        if(page){
          tab.style.display = allowedMenus.includes(page) ? '' : 'none';
        }
      });
      // 권한 없는 페이지가 active면 첫 허용 페이지로 자동 전환 (예: 비admin이 대시보드 못 봄)
      const activeEl = document.querySelector('.page.active');
      const activePage = activeEl ? activeEl.id.replace('page-','') : '';
      if (activePage && !allowedMenus.includes(activePage) && allowedMenus.length > 0) {
        if (typeof switchPage === 'function') switchPage(allowedMenus[0]);
      }
      // 견적 권한 없는 역할(viewer)은 등록 모달의 "저장 후 견적도우미" 버튼 숨김
      const saveAndEstimateGroup = document.getElementById('saveAndEstimateGroup');
      if (saveAndEstimateGroup) saveAndEstimateGroup.style.display = allowedMenus.includes('estimate') ? '' : 'none';

      // 사이드바 하단 사용자 뱃지 (대시보드 사이드바 모드 ::before 콘텐츠)
      try {
        const header = document.querySelector('.header');
        if (header) {
          const firstName = (window._userName || '').split(' ')[0] || (user.email || '').split('@')[0] || 'USER';
          const roleLabel = role === 'admin' ? 'ADMIN' : (role === 'staff' ? 'STAFF' : 'VIEWER');
          header.setAttribute('data-user-badge', firstName + '   ' + roleLabel);
        }
      } catch(_) {}

      // 헤더에 사용자 정보 표시 (중복 방지)
      const headerRight = document.querySelector('.header-right');
      const existingBadge = document.getElementById('user-badge');
      if(existingBadge) existingBadge.remove();
      if(headerRight){
        const badge = document.createElement('div');
        badge.id = 'user-badge';
        badge.className='date-badge';
        badge.style.cssText='cursor:pointer;display:flex;align-items:center;gap:6px;';
        badge.innerHTML='<img src="'+(user.photoURL||'')+'" style="width:20px;height:20px;border-radius:50%;border:1px solid rgba(139,92,246,.3)">'
          +'<span style="font-family:Inter,sans-serif;font-size:11px;">'+(window._userName||'').split(' ')[0]+'</span>'
          +'<span style="font-size:9px;color:var(--accent);font-weight:700;text-transform:uppercase;">'+role+'</span>';
        badge.onclick=function(){if(confirm('로그아웃 하시겠습니까?'))authSignOut();};
        headerRight.appendChild(badge);
      }

      // 로그인 화면 숨기기 → 앱 표시
      loginScreen.style.display='none';
      document.body.style.overflow='';
      // Matrix 배경 애니메이션 중지 (성능)
      if(window._matrixTimer){clearInterval(window._matrixTimer);window._matrixTimer=null;}
      var mc=document.getElementById('matrixBg');if(mc)mc.style.display='none';

      // 공지사항 admin 버튼 가시화 + 중요 공지 팝업 트리거
      try { if (window._renderBoardNotices) window._renderBoardNotices(); } catch(_) {}
      setTimeout(function(){ try { if (window._maybeShowImportantBoardNotice) window._maybeShowImportantBoardNotice(); } catch(_) {} }, 600);

    } catch(e){
      document.getElementById('loginError').textContent='권한 확인 실패: '+e.message;
      document.getElementById('loginError').style.display='block';
    }
  });

  window.authGoogleLogin = async function(){
    var btn = document.getElementById('googleLoginBtn');
    var err = document.getElementById('loginError');
    var denied = document.getElementById('loginDenied');
    try {
      if (err) err.style.display='none';
      if (denied) denied.style.display='none';
      if (btn) { btn.style.pointerEvents='none'; btn.style.opacity='0.5'; }
      await signInWithPopup(auth, provider);
    } catch(e) {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        e = redirectError;
      }
      if (btn) { btn.style.pointerEvents=''; btn.style.opacity=''; }
      if (err) {
        err.textContent = '로그인 실패: ' + (e && e.message ? e.message : e);
        err.style.display='block';
      }
    }
  };
  document.getElementById('googleLoginBtn').addEventListener('click', window.authGoogleLogin);

  // 관리자: 접근 요청 목록 로드
  window.loadAccessRequests = async function(){
    if(window._userRole!=='admin') return;
    try {
      const snap = await getDocs(collection(fsd, 'access_requests'));
      const reqs = snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.status==='pending');
      const panel = document.getElementById('accessRequests');
      const list = document.getElementById('arList');
      if(!reqs.length){ panel.style.display='none'; return; }
      panel.style.display='block';
      document.getElementById('arCount').textContent=reqs.length+'명 대기중';
      list.innerHTML = reqs.map(r=>
        '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">'
        +(r.photo?'<img src="'+r.photo+'" style="width:28px;height:28px;border-radius:50%;">':'')
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:12px;font-weight:600;color:var(--text);">'+((r.name||r.email))+'</div>'
        +'<div style="font-size:10px;color:var(--text-dim);">'+r.email+'</div>'
        +'<div style="font-size:9px;color:var(--text-dim);">'+r.requestedAt+'</div>'
        +'</div>'
        +'<select id="role-'+r.id.replace(/[@.]/g,'_')+'" style="padding:4px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;">'
        +'<option value="staff">Staff 1단계</option><option value="viewer">Staff 2단계</option><option value="admin">관리자</option></select>'
        +'<button onclick="approveUser(\''+r.email+'\',\''+r.id.replace(/[@.]/g,'_')+'\')" style="padding:5px 12px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">승인</button>'
        +'<button onclick="denyUser(\''+r.email+'\')" style="padding:5px 8px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-dim);font-size:11px;cursor:pointer;">거절</button>'
        +'</div>'
      ).join('');
    }catch(e){console.error('AR load error:',e);}
  };

  // 승인
  window.approveUser = async function(email, safeId){
    const role = document.getElementById('role-'+safeId).value;
    await setDoc(doc(fsd, 'users', email), {
      email: email, role: role, name: email.split('@')[0],
      approvedAt: new Date().toISOString(), approvedBy: window._userEmail
    });
    await setDoc(doc(fsd, 'access_requests', email), { status: 'approved' }, { merge: true });
    alert(email+' → '+role+' 승인 완료!');
    window.loadAccessRequests();
  };

  // 거절
  window.denyUser = async function(email){
    await setDoc(doc(fsd, 'access_requests', email), { status: 'denied' }, { merge: true });
    window.loadAccessRequests();
  };

  // 페이지 로드 후 접근 요청 확인
  setTimeout(()=>{
    if(window._userRole==='admin'){
      window.loadAccessRequests();
      // 관리자만 사용자관리 탭 표시
      var umTab=document.getElementById('tab-usermgmt');
      if(umTab) umTab.style.display='';
      var lvTab=document.getElementById('tab-leave');
      if(lvTab) lvTab.style.display='';
      var bdTab=document.getElementById('tab-board');
      if(bdTab) bdTab.style.display='';
      // 출고완료 페이지 안의 블랙리스트 진입 버튼 표시
      var blBtn=document.getElementById('blacklistEntryBtn');
      if(blBtn) blBtn.style.display='';
      // 블랙 차량 입고 배너 초기 평가 (admin 권한 확정된 직후)
      if (window._refreshBlacklistAlerts) window._refreshBlacklistAlerts(true);
    }
    // 권한이 결정된 후 연차 화면을 한 번 더 그려서 admin/비admin 분기를 정확히 반영
    if(window._renderLeave) try{ window._renderLeave(); }catch(e){ console.error(e); }
  }, 2000);

  // 사용자 관리 (역할 라벨/설명/색상)
  var _RL={'admin':' 관리자','staff':' Staff 1단계','viewer':' Staff 2단계'};
  var _RD={'admin':'전체 메뉴','staff':'대시보드, 수리완료, 연차, 게시판·일정, 견적','viewer':'대시보드, 수리완료, 연차, 게시판·일정'};
  var _RC={'admin':'var(--accent)','staff':'var(--blue)','viewer':'var(--text-dim)'};

  window.loadUserMgmt = async function(){
    console.log('loadUserMgmt called, role:', window._userRole);
    if(window._userRole!=='admin') return;
    var tbody=document.getElementById('umApproved');
    var ptbody=document.getElementById('umPending');
    if(!tbody||!ptbody){console.log('DOM not found');return;}

    // 사진 맵
    var pm={};
    try{
      var as=await getDocs(collection(fsd,'access_requests'));
      as.docs.forEach(function(d){var x=d.data();if(x.photo)pm[d.id]=x.photo;if(x.name)pm[d.id+'_n']=x.name;});
    }catch(e){console.log('ar error',e);}

    // 승인된 사용자
    try{
      var us=await getDocs(collection(fsd,'users'));
      var rows='';
      us.docs.forEach(function(d){
        var u=d.data();
        if(u._deleted||u.role==='removed') return;
        var email=d.id;
        var photo=u.photo||pm[email]||'';
        var name=pm[email+'_n']||u.name||email.split('@')[0];
        var role=u.role||'viewer';
        var si=email.replace(/[@.]/g,'_');
        var isSelf=(email===window._userEmail);
        rows+='<tr>'
          +'<td>'+(photo?'<img src="'+photo+'" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);" onerror="this.style.display=\'none\'">':'—')+'</td>'
          +'<td style="font-size:12px;font-family:monospace;">'+email+'</td>'
          +'<td style="font-size:12px;">'+name+'</td>'
          +'<td><span style="color:'+(_RC[role]||'#aaa')+';font-weight:700;font-size:12px;">'+(_RL[role]||role)+'</span></td>'
          +'<td style="font-size:11px;color:var(--text-dim);">'+(_RD[role]||'-')+'</td>'
          +'<td style="font-size:11px;color:var(--text-dim);">'+(u.approvedAt||u.createdAt||'-').toString().slice(0,10)+'</td>'
          +'<td>'+(isSelf?'<span style="font-size:10px;color:var(--text-dim);">본인</span>'
            :'<select id="umr-'+si+'" style="padding:3px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;">'
            +'<option value="admin"'+(role==='admin'?' selected':'')+'>관리자</option>'
            +'<option value="staff"'+(role==='staff'?' selected':'')+'>Staff 1단계</option>'
            +'<option value="viewer"'+(role==='viewer'?' selected':'')+'>Staff 2단계</option>'
            +'</select> '
            +'<button onclick="umChange(\''+email+'\',\''+si+'\')" style="padding:3px 8px;background:var(--accent);border:none;border-radius:4px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;">변경</button> '
            +'<button onclick="umRemove(\''+email+'\')" style="padding:3px 8px;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--red);font-size:10px;cursor:pointer;">삭제</button>')
          +'</td></tr>';
      });
      tbody.innerHTML=rows||'<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px;">사용자 없음</td></tr>';
    }catch(e){console.error('users load error:',e);tbody.innerHTML='<tr><td colspan="7" style="color:var(--red);padding:12px;">로드 실패: '+e.message+'</td></tr>';}

    // 대기 요청
    try{
      var as2=await getDocs(collection(fsd,'access_requests'));
      var pend=[];
      as2.docs.forEach(function(d){var x=d.data();if(x.status==='pending')pend.push({id:d.id,...x});});
      if(!pend.length){
        ptbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">대기 중인 요청이 없습니다</td></tr>';
      } else {
        var pr='';
        pend.forEach(function(r){
          var si=r.email.replace(/[@.]/g,'_');
          pr+='<tr>'
            +'<td>'+(r.photo?'<img src="'+r.photo+'" style="width:28px;height:28px;border-radius:50%;" onerror="this.style.display=\'none\'">':'—')+'</td>'
            +'<td style="font-size:12px;font-family:monospace;">'+r.email+'</td>'
            +'<td style="font-size:12px;">'+(r.name||'-')+'</td>'
            +'<td style="font-size:11px;color:var(--text-dim);">'+(r.requestedAt||'').slice(0,10)+'</td>'
            +'<td><select id="umpr-'+si+'" style="padding:4px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;">'
            +'<option value="staff">Staff 1단계</option><option value="viewer">Staff 2단계</option><option value="admin">관리자</option></select></td>'
            +'<td><button onclick="umApprove(\''+r.email+'\',\''+si+'\',\''+((r.name||'').replace(/'/g,''))+'\')" style="padding:4px 12px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">승인</button> '
            +'<button onclick="umDeny(\''+r.email+'\')" style="padding:4px 8px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-dim);font-size:11px;cursor:pointer;">거절</button></td></tr>';
        });
        ptbody.innerHTML=pr;
      }
    }catch(e){console.error('pending load error:',e);}
  };

  window.umChange = async function(email,si){
    var sel=document.getElementById('umr-'+si);
    if(!sel)return;
    await setDoc(doc(fsd,'users',email),{role:sel.value},{merge:true});
    alert(email+' → '+(_RL[sel.value]||sel.value)+' 변경 완료!');
    loadUserMgmt();
  };

  window.umRemove = async function(email){
    if(!confirm(email+' 삭제하시겠습니까?')) return;
    await setDoc(doc(fsd,'users',email),{_deleted:true,role:'removed'},{merge:true});
    alert(email+' 삭제 완료');
    loadUserMgmt();
  };

  window.umApprove = async function(email,si,name){
    var sel=document.getElementById('umpr-'+si);
    var role=sel?sel.value:'staff';
    await setDoc(doc(fsd,'users',email),{
      email:email,role:role,name:name||email.split('@')[0],
      approvedAt:new Date().toISOString(),approvedBy:window._userEmail
    });
    await setDoc(doc(fsd,'access_requests',email),{status:'approved'},{merge:true});
    alert(email+' → '+(_RL[role]||role)+' 승인!');
    loadUserMgmt();
    if(window.loadAccessRequests)loadAccessRequests();
  };

  window.umDeny = async function(email){
    await setDoc(doc(fsd,'access_requests',email),{status:'denied'},{merge:true});
    loadUserMgmt();
  };

  // usermgmt 페이지가 active되면 자동 로드
  var _umObs = new MutationObserver(function(muts){
    muts.forEach(function(m){
      if(m.target.id==='page-usermgmt' && m.target.classList.contains('active')){
        console.log('usermgmt page active detected');
        if(window.loadUserMgmt) window.loadUserMgmt();
      }
    });
  });
  var _umEl = document.getElementById('page-usermgmt');
  if(_umEl) _umObs.observe(_umEl, {attributes:true, attributeFilter:['class']});

  window.fsSaveMp=async(e)=>{try{await setDoc(doc(fsd,"mappings",e.label),{...e,at:serverTimestamp()});return true;}catch{return false;}};
  window.fsSaveEst=async(e)=>{try{const id="E"+Date.now();await setDoc(doc(fsd,"estimates",id),{...e,id,at:serverTimestamp()});return id;}catch{return null;}};
  window.fsLoadEst=async()=>{try{const s=await getDocs(collection(fsd,"estimates"));return s.docs.map(d=>d.data()).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));}catch{return[];}};
  window.fsLoadMp=async()=>{try{const s=await getDocs(collection(fsd,"mappings"));return s.docs.map(d=>d.data());}catch{return[];}};
  // 견적↔차량 연동용: Firebase RTDB update/ref 전역 노출
  window._fbDb=db; window._fbRef=ref; window._fbUpdate=update;
  (async()=>{const ms=await window.fsLoadMp();if(ms.length){let lc=[];try{lc=JSON.parse(localStorage.getItem("kgm_custom")||"[]");}catch{}const mg=[...ms,...lc.filter(l=>!ms.some(c=>c.label===l.label))];localStorage.setItem("kgm_custom",JSON.stringify(mg));}})();
  const recordsRef = ref(db, 'records');
  const blacklistRef = ref(db, 'blacklist');
  const kgmDailyRef = ref(db, 'kgmDailyCount');
  const salesDailyRef = ref(db, 'salesDaily');     // { 'YYYY-MM-DD': { parts, function } }
  const depositRef = ref(db, 'monthlyDeposit');    // { 'YYYY-MM': number }

  let records = {};
  let blacklistMap = {};
  let kgmDailyMap = {};
  let salesDailyMap = {};  // { 'YYYY-MM-DD': { parts:N, function:N } }
  let depositMap = {};      // { 'YYYY-MM': N }
  let editingId = null;
  window._getRecord = function(id){ return records[id]; };

  // 차량번호 정규화: 공백 제거, 대문자 (DB 키로도 사용)
  function normalizeCarNum(s) { return String(s||'').replace(/\s+/g,'').toUpperCase(); }
  window._getBlacklistEntry = function(carNum) {
    return blacklistMap[normalizeCarNum(carNum)] || null;
  };
  window._isAdmin = function() {
    return (window._userRole === 'admin') || (window.currentUser && window.currentUser.role === 'admin');
  };

  // 블랙리스트 실시간 구독
  onValue(blacklistRef, (snapshot) => {
    blacklistMap = snapshot.val() || {};
    // 현재 열려있는 입출고 폼이 있으면 경고 다시 평가
    if (typeof window._checkBlacklistWarning === 'function') {
      const inp = document.getElementById('f-carnum');
      if (inp && inp.value) window._checkBlacklistWarning();
    }
    if (typeof window._renderBlacklist === 'function') window._renderBlacklist();
    // 블랙 목록이 갱신되면 알림도 다시 계산 (새로 블랙 등록된 차량이 이미 입고 중인 경우 포함)
    if (typeof window._refreshBlacklistAlerts === 'function') window._refreshBlacklistAlerts(true);
  }, (err) => { console.warn('blacklist subscribe', err); });

  // 이전에 알린 블랙 차량 추적 (같은 차량 반복 토스트 방지)
  var _notifiedBlackKeys = new Set();
  var _blacklistAlertsInitialized = false;

  window._refreshBlacklistAlerts = function(skipToast) {
    if (!window._isAdmin || !window._isAdmin()) {
      var banner = document.getElementById('blacklistAlertBanner');
      if (banner) banner.style.display = 'none';
      return;
    }
    // 현재 입고 중(출고 아닌) + 블랙 등록된 차량 모두 찾기
    var currentlyIn = [];
    Object.entries(records || {}).forEach(function(kv){
      var r = kv[1] || {};
      if (r.status === '출고') return;
      var key = normalizeCarNum(r.carNum || '');
      if (!key) return;
      if (blacklistMap[key]) {
        currentlyIn.push({ recordId: kv[0], record: r, blEntry: blacklistMap[key], key: key });
      }
    });
    // 배너 렌더
    var banner = document.getElementById('blacklistAlertBanner');
    var countEl = document.getElementById('blacklistAlertCount');
    var listEl = document.getElementById('blacklistAlertList');
    if (banner) {
      if (!currentlyIn.length) {
        banner.style.display = 'none';
      } else {
        banner.style.display = 'block';
        if (countEl) countEl.textContent = '현재 ' + currentlyIn.length + '대 — 즉시 확인 필요';
        if (listEl) {
          listEl.innerHTML = currentlyIn.map(function(c){
            var sev = c.blEntry.severity || 'medium';
            var sevColor = sev === 'high' ? '#e8442a' : sev === 'low' ? '#fbbf24' : '#ef4444';
            return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:rgba(232,68,42,.18);border:1px solid rgba(232,68,42,.4);border-radius:5px;font-size:12px;cursor:pointer;" onclick="window._openModal(\'' + esc(c.recordId) + '\')" title="' + esc(c.blEntry.reason||'') + '">'
              + '<span style="width:6px;height:6px;border-radius:50%;background:' + sevColor + ';"></span>'
              + '<span style="font-family:JetBrains Mono,monospace;font-weight:800;color:#fafafa;">' + esc(c.record.carNum||'') + '</span>'
              + (c.record.name ? '<span style="color:rgba(250,250,250,.7);">' + esc(c.record.name) + '</span>' : '')
              + '</span>';
          }).join('');
        }
      }
    }
    // 토스트: 신규 차량만 (첫 호출은 토스트 생략 — 페이지 로드 직후 기존 차량까지 토스트되면 시끄러움)
    if (!skipToast && _blacklistAlertsInitialized) {
      currentlyIn.forEach(function(c){
        var dedupeKey = c.recordId + '|' + c.key;
        if (!_notifiedBlackKeys.has(dedupeKey)) {
          _notifiedBlackKeys.add(dedupeKey);
          showNotif(' 블랙 차량 입고: ' + (c.record.carNum||'') + ' — ' + (c.blEntry.reason||'사유 미입력'), true);
        }
      });
    } else {
      // 초기 한 번은 토스트 없이 기존 차량 표시만 — dedupe set에 미리 등록해 중복 방지
      currentlyIn.forEach(function(c){ _notifiedBlackKeys.add(c.recordId + '|' + c.key); });
      _blacklistAlertsInitialized = true;
    }
    // 출고/삭제된 차량은 dedupe에서 제거 (재입고 시 다시 알림 받게)
    var presentKeys = new Set(currentlyIn.map(function(c){ return c.recordId + '|' + c.key; }));
    Array.from(_notifiedBlackKeys).forEach(function(k){ if (!presentKeys.has(k)) _notifiedBlackKeys.delete(k); });
  };

  // 실시간 데이터 수신
  onValue(recordsRef, (snapshot) => {
    records = snapshot.val() || {};
    document.getElementById('loadingScreen').style.display = 'none';
    refreshAll();
    if (typeof window._refreshBlacklistAlerts === 'function') window._refreshBlacklistAlerts();
  }, (error) => {
    document.getElementById('loadingScreen').style.display = 'none';
    showNotif(' Firebase 연결 실패. databaseURL을 확인해주세요.', true);
    console.error(error);
  });

  // KGM 일일 카운트 실시간 수신
  onValue(kgmDailyRef, (snap) => {
    const val = snap.val() || {};
    kgmDailyMap = {};
    Object.entries(val).forEach(([k, v]) => {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) kgmDailyMap[k] = n;
    });
    if (typeof renderDashboard === 'function') { try { renderDashboard(); } catch(e){} }
    if (typeof renderSalesWidget === 'function') { try { renderSalesWidget(); } catch(e){} }
  }, (err) => { console.warn('kgmDaily subscribe', err); });

  // 일일 매출 실시간 수신
  onValue(salesDailyRef, (snap) => {
    salesDailyMap = snap.val() || {};
    if (typeof renderSalesWidget === 'function') { try { renderSalesWidget(); } catch(e){} }
  }, (err) => { console.warn('salesDaily subscribe', err); });

  // 매달 보증금 실시간 수신
  onValue(depositRef, (snap) => {
    depositMap = snap.val() || {};
    if (typeof renderSalesWidget === 'function') { try { renderSalesWidget(); } catch(e){} }
  }, (err) => { console.warn('deposit subscribe', err); });

  // ── 매출 / 보증금 위젯 ──
  const SALES_CATS = ['parts', 'function'];
  const SALES_LABELS = { parts: '부품', function: '기능' };
  function _todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function _thisMonthStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  }
  function _fmtKRW(n) {
    return '₩' + (Number(n)||0).toLocaleString('ko-KR');
  }
  // 매출 보고 페이지 활성 날짜·월 (사용자가 input에서 선택; 없으면 오늘/이번달)
  function _getActiveSalesDate() {
    return (window._activeSalesDate && /^\d{4}-\d{2}-\d{2}$/.test(window._activeSalesDate))
      ? window._activeSalesDate : _todayStr();
  }
  function _getActiveSalesMonth() {
    return (window._activeSalesMonth && /^\d{4}-\d{2}$/.test(window._activeSalesMonth))
      ? window._activeSalesMonth : _thisMonthStr();
  }
  window._setSalesDate = function(d) {
    window._activeSalesDate = (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d : null;
    var inp = document.getElementById('sales-page-date');
    if (inp && !window._activeSalesDate) inp.value = '';
    if (typeof renderSalesWidget === 'function') { try { renderSalesWidget(); } catch(_) {} }
  };
  window._setSalesMonth = function(m) {
    window._activeSalesMonth = (m && /^\d{4}-\d{2}$/.test(m)) ? m : null;
    var inp = document.getElementById('sales-page-month');
    if (inp && !window._activeSalesMonth) inp.value = '';
    if (typeof renderSalesWidget === 'function') { try { renderSalesWidget(); } catch(_) {} }
  };
  // 14일치 일자별 값 추출 (오래된 → 최신)
  function _last14Days() {
    const days = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      days.push(ds);
    }
    return days;
  }
  // 최근 6개월 키 (오래된 → 최신)
  function _last6Months() {
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
    }
    return months;
  }
  // 스파크라인 SVG (라인 + 그라데이션 영역 + 마지막 포인트)
  function _renderSpark(elId, values, color) {
    const el = document.getElementById(elId);
    if (!el) return;
    const W = 280, H = 36, padX = 2, padY = 4;
    const innerW = W - padX*2, innerH = H - padY*2;
    const maxV = Math.max(1, ...values);
    const n = values.length;
    const pts = values.map((v, i) => {
      const x = padX + (n === 1 ? innerW/2 : (i/(n-1)) * innerW);
      const y = padY + innerH - (v / maxV) * innerH;
      return [x, y];
    });
    const linePath = 'M ' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ');
    const areaPath = linePath + ' L ' + (padX + innerW).toFixed(1) + ' ' + (padY + innerH) + ' L ' + padX + ' ' + (padY + innerH) + ' Z';
    const lastPt = pts[pts.length - 1];
    const gradId = 'spark-grad-' + elId;
    el.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
      `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>` +
        `<stop offset="100%" stop-color="${color}" stop-opacity="0"/>` +
      `</linearGradient></defs>` +
      `<path d="${areaPath}" fill="url(#${gradId})"/>` +
      `<path d="${linePath}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="3" fill="${color}" stroke="#1a1c20" stroke-width="2"/>` +
      `</svg>`;
  }
  // 추세 계산: 오늘 vs 어제 비교
  function _trendLabel(today, yesterday) {
    if (yesterday === 0 && today === 0) return { cls: 'flat', text: '데이터 없음' };
    if (yesterday === 0) return { cls: 'up', text: '신규' };
    const diff = today - yesterday;
    const pct = Math.round((diff / yesterday) * 100);
    if (pct === 0) return { cls: 'flat', text: '어제 동일' };
    if (pct > 0) return { cls: 'up', text: '↑ 어제 +' + pct + '%' };
    return { cls: 'down', text: '↓ 어제 ' + pct + '%' };
  }

  function renderSalesWidget() {
    const today = _todayStr();
    const mo = _thisMonthStr();
    const todayData = salesDailyMap[today] || {};
    const depositVal = Number(depositMap[mo]) || 0;
    const dateLabel = today.replace(/^\d{4}-/, '').replace('-', '/');
    const monthLabel = mo.replace('-', '년 ') + '월';

    // 대시보드 오늘 매출 위젯
    const dateEl = document.getElementById('daily-sales-date');
    if (dateEl) dateEl.textContent = dateLabel + ' 기준';

    // 14일 데이터 추출
    const days14 = _last14Days();
    const yesterdayKey = days14[days14.length - 2];
    const yesterdayData = salesDailyMap[yesterdayKey] || {};

    const CAT_COLORS = { parts: '#fb923c', function: '#34d399' };
    SALES_CATS.forEach(cat => {
      const v = Number(todayData[cat]) || 0;
      const yv = Number(yesterdayData[cat]) || 0;
      const valEl = document.getElementById('daily-' + cat + '-value');
      if (valEl) {
        valEl.textContent = _fmtKRW(v);
        valEl.classList.toggle('zero', v === 0);
      }
      // 추세
      const trendEl = document.getElementById('daily-' + cat + '-trend');
      if (trendEl) {
        const t = _trendLabel(v, yv);
        trendEl.textContent = t.text;
        trendEl.className = 'dsr-trend ' + t.cls;
      }
      // 14일 스파크라인
      const series = days14.map(d => Number((salesDailyMap[d] || {})[cat]) || 0);
      _renderSpark('daily-' + cat + '-spark', series, CAT_COLORS[cat]);
    });

    // 보증금
    const depEl = document.getElementById('monthly-deposit-value');
    if (depEl) {
      depEl.textContent = _fmtKRW(depositVal);
      depEl.classList.toggle('zero', depositVal === 0);
    }
    // 보증금 상태 라벨
    const depStatusEl = document.getElementById('deposit-status');
    if (depStatusEl) {
      if (depositVal > 0) {
        depStatusEl.textContent = monthLabel + ' 보고 완료';
        depStatusEl.className = 'dsr-trend up';
      } else {
        depStatusEl.textContent = '미입력';
        depStatusEl.className = 'dsr-trend flat';
      }
    }
    // 보증금 6개월 스파크라인
    const months6 = _last6Months();
    const depSeries = months6.map(m => Number(depositMap[m]) || 0);
    _renderSpark('deposit-spark', depSeries, '#fbbf24');

    const monthDays = Object.keys(salesDailyMap).filter(d => d.startsWith(mo)).sort();
    let partsRun = 0, funcRun = 0;
    const partsCum = [];
    const funcCum = [];
    monthDays.forEach(d => {
      const dayData = salesDailyMap[d] || {};
      partsRun += Number(dayData.parts) || 0;
      funcRun += Number(dayData.function) || 0;
      partsCum.push(partsRun);
      funcCum.push(funcRun);
    });
    const depCum = partsCum.map((_, i) => Math.round(depositVal * ((i + 1) / Math.max(1, partsCum.length))));
    renderCumulativeSalesChart({
      parts: partsCum.length ? partsCum : [0],
      func: funcCum.length ? funcCum : [0],
      deposit: depCum.length ? depCum : [depositVal],
      partsAmount: partsRun,
      functionAmount: funcRun,
      depositAmount: depositVal,
      totalText: _fmtKRW(partsRun + funcRun + depositVal),
      partsText: _fmtKRW(partsRun),
      functionText: _fmtKRW(funcRun)
    });

    // ── 매출 보고 페이지 — 활성 날짜·월로 표시 ──
    const pageDay = _getActiveSalesDate();
    const pageMo  = _getActiveSalesMonth();
    const pageData = salesDailyMap[pageDay] || {};
    const pageDeposit = Number(depositMap[pageMo]) || 0;
    const pageDateLabel = pageDay.replace(/^\d{4}-/, '').replace('-', '/');
    const pageMonthLabel = pageMo.replace('-', '년 ') + '월';
    const isToday = pageDay === today;
    const isThisMonth = pageMo === mo;

    // 헤더 라벨 + input 동기화
    const dailyReportDate = document.getElementById('daily-report-date');
    if (dailyReportDate) {
      dailyReportDate.textContent = isToday ? (pageDay + ' (오늘)') : pageDay;
    }
    const monthlyReportMonth = document.getElementById('monthly-report-month');
    if (monthlyReportMonth) {
      monthlyReportMonth.textContent = isThisMonth ? (pageMonthLabel + ' (이번달)') : pageMonthLabel;
    }
    const salesDateInp = document.getElementById('sales-page-date');
    if (salesDateInp && !salesDateInp.value && window._activeSalesDate) {
      salesDateInp.value = window._activeSalesDate;
    }
    const salesMonthInp = document.getElementById('sales-page-month');
    if (salesMonthInp && !salesMonthInp.value && window._activeSalesMonth) {
      salesMonthInp.value = window._activeSalesMonth;
    }

    // 부품·기능 카드 값 (활성 날짜)
    SALES_CATS.forEach(cat => {
      const v = Number(pageData[cat]) || 0;
      const pgValEl = document.getElementById('sales-page-value-' + cat);
      if (pgValEl) {
        pgValEl.textContent = _fmtKRW(v);
        pgValEl.classList.toggle('zero', v === 0);
      }
    });
    // KGM 정비 대수 (활성 날짜)
    const kgmPgCnt = kgmDailyMap[pageDay] || 0;
    const kgmPgEl = document.getElementById('sales-page-value-kgm');
    if (kgmPgEl) {
      kgmPgEl.textContent = kgmPgCnt + '대';
      kgmPgEl.classList.toggle('zero', kgmPgCnt === 0);
    }
    // 보증 (활성 월)
    const depPgEl = document.getElementById('deposit-value');
    if (depPgEl) {
      depPgEl.textContent = _fmtKRW(pageDeposit);
      depPgEl.classList.toggle('zero', pageDeposit === 0);
    }
  }
  window._renderSalesWidget = renderSalesWidget;

  // 일일 매출 저장 (부품 / 기능) — 매출 보고 페이지에서 호출
  window._salesSavePage = async function(cat) {
    if (SALES_CATS.indexOf(cat) < 0) return;
    const inp = document.getElementById('sales-page-input-' + cat);
    if (!inp) return;
    const raw = String(inp.value || '').trim();
    if (raw === '') { showNotif('금액을 입력해주세요', true); inp.focus(); return; }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0 || n > 999999999) {
      showNotif('0 ~ 9억9천만원 범위로 입력', true);
      inp.focus(); inp.select();
      return;
    }
    const day = _getActiveSalesDate();
    try {
      await update(ref(db, 'salesDaily/' + day), { [cat]: n });
      showNotif(SALES_LABELS[cat] + ' ' + day + ' ' + _fmtKRW(n) + ' 저장 ');
      inp.value = '';
    } catch(e) {
      console.error('salesDaily save fail', e);
      showNotif('저장 실패: ' + (e.message || e), true);
    }
  };

  // KGM 오늘 정비 대수 저장 — 매출 보고 페이지에서 호출
  window._kgmDailySavePage = async function() {
    const inp = document.getElementById('sales-page-input-kgm');
    if (!inp) return;
    const raw = String(inp.value || '').trim();
    if (raw === '') { showNotif('대수를 입력해주세요', true); inp.focus(); return; }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0 || n > 999) {
      showNotif('0 ~ 999 사이 숫자만 입력', true);
      inp.focus(); inp.select();
      return;
    }
    const day = _getActiveSalesDate();
    try {
      await update(ref(db, 'kgmDailyCount'), { [day]: n });
      showNotif('KGM 정비 ' + day + ' ' + n + '대 저장 ');
      inp.value = '';
    } catch(e) {
      console.error('kgmDaily save fail', e);
      showNotif('저장 실패: ' + (e.message || e), true);
    }
  };

  // 매달 보증금 저장 — 매출 보고 페이지에서 호출
  window._depositSave = async function() {
    const inp = document.getElementById('deposit-input');
    if (!inp) return;
    const raw = String(inp.value || '').trim();
    if (raw === '') { showNotif('보증금액을 입력해주세요', true); inp.focus(); return; }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0 || n > 999999999) {
      showNotif('0 ~ 9억9천만원 범위로 입력', true);
      inp.focus(); inp.select();
      return;
    }
    const mo = _getActiveSalesMonth();
    try {
      await update(ref(db, 'monthlyDeposit'), { [mo]: n });
      showNotif(mo + ' 보증 ' + _fmtKRW(n) + ' 저장 ');
      inp.value = '';
    } catch(e) {
      console.error('deposit save fail', e);
      showNotif('저장 실패: ' + (e.message || e), true);
    }
  };

  // ── KGM 일일 카운트 저장 — 입력값 → 오늘 자리에 덮어쓰기 ──
  function kgmTodayStr() { return new Date().toISOString().split('T')[0]; }
  window._kgmDailySave = async function() {
    const inp = document.getElementById('kgm-today-input');
    if (!inp) return;
    const raw = String(inp.value || '').trim();
    if (raw === '') { showNotif('숫자를 입력해주세요', true); inp.focus(); return; }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0 || n > 999) {
      showNotif('0 ~ 999 사이 숫자만 입력', true);
      inp.focus(); inp.select();
      return;
    }
    try {
      await update(ref(db, 'kgmDailyCount'), { [kgmTodayStr()]: n });
      showNotif('오늘 정비 ' + n + '대 저장됨 ');
      inp.value = '';  // 저장 후 입력란 비움
    } catch(e) {
      console.error('kgmDaily save fail', e);
      showNotif('저장 실패: ' + (e.message || e), true);
    }
  };

  function getList() {
    return Object.entries(records).map(([id, val]) => ({ id, ...val }));
  }

  function _activePage() {
    const el = document.querySelector('.page.active');
    return el ? el.id.replace('page-','') : 'dashboard';
  }
  function refreshAll() {
    try { renderDashboard(); } catch(e) { console.error('renderDashboard error:', e); }
    try { renderList(); } catch(e) { console.error('renderList error:', e); }
    try { renderComplete(); } catch(e) {
      // 에러 발생 시 화면에 직접 표시
      var el = document.getElementById('complete-empty');
      if(el) { el.style.display='block'; el.innerHTML='<div class="empty-icon"></div><div>renderComplete 에러: '+e.message+'</div>'; }
    }
    try { renderOut(); } catch(e) { console.error('renderOut error:', e); }
    try { initYearSelect(); renderStats(); } catch(e) { console.error('renderStats error:', e); }
  }

  // ---- HELPERS ----
  function statusBadge(s) {
    const map = { '입고': 'badge-in', '수리대기': 'badge-wait', '수리중': 'badge-repair', '수리완료': 'badge-done', '출고': 'badge-out', '미수리 출고': 'badge-out-norepair' };
    return `<span class="badge ${map[s]||''}"><span class="bdot"></span>${s}</span>`;
  }
  function locationBadge(loc, status) {
    if (!loc) return '-';
    if (status === '출고' || status === '미수리 출고') return '-';
    const colors = { '1층':'#a78bfa', '판금':'#f472b6', '도장':'#fb923c', '정비':'#34d399', '도장대기중':'#fbbf24', '조립대기중':'#2dd4bf', '조립중':'#84cc16', '5층':'#60a5fa', '지하':'#94a3b8' };
    const c = colors[loc]||'#94a3b8';
    return `<span style="display:inline-block;white-space:nowrap;background:${c}22;color:${c};padding:2px 10px;border-radius:5px;font-size:12px;font-weight:700;border:1px solid ${c}44;">${loc}</span>`;
  }
  function insBadge(val, label) {
    if (!val) return `<span style="color:var(--text-dim);font-size:12px;">-</span>`;
    return `<span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;"><span style="font-size:10px;color:var(--text-dim);">${esc(label)}</span><span style="background:rgba(75,156,255,0.12);color:var(--blue);padding:2px 7px;border-radius:5px;font-size:12px;white-space:nowrap;">${esc(val)}</span></span>`;
  }
  function fmt(d) { if (!d) return '-'; const x = new Date(d); return `${x.getMonth()+1}/${x.getDate()}`; }
  function fmtCost(v) { return (!v || v==0) ? '-' : Number(v).toLocaleString()+'원'; }
  function repairCell(text, id) {
    if (!text) return '-';
    const escaped = esc(text);
    const short = text.length > 20 ? esc(text.substring(0,20))+'…' : escaped;
    const hasMore = text.length > 20;
    if (!hasMore) return `<span style="font-size:13px;">${escaped}</span>`;
    return `<span class="repair-cell" onclick="toggleRepair(this)" data-full="${escaped}" data-short="${short}" style="cursor:pointer;font-size:13px;color:var(--text);">${short}<span style="margin-left:5px;font-size:10px;color:#f5a623;background:rgba(245,166,35,0.12);padding:1px 6px;border-radius:4px;border:1px solid rgba(245,166,35,0.3);">더보기</span></span>`;
  }
  window.toggleRepair = function(el) {
    const isFull = el.dataset.expanded === 'true';
    if (isFull) {
      el.innerHTML = el.dataset.short + `<span style="margin-left:5px;font-size:10px;color:#f5a623;background:rgba(245,166,35,0.12);padding:1px 6px;border-radius:4px;border:1px solid rgba(245,166,35,0.3);">더보기</span>`;
      el.dataset.expanded = 'false';
      el.style.whiteSpace = '';
    } else {
      el.innerHTML = el.dataset.full + `<span style="margin-left:5px;font-size:10px;color:var(--text-dim);background:rgba(124,130,150,0.12);padding:1px 6px;border-radius:4px;border:1px solid rgba(124,130,150,0.3);">접기</span>`;
      el.dataset.expanded = 'true';
      el.style.whiteSpace = 'pre-wrap';
    }
  };

  // 위치별 색 (시인성 — 위치마다 다른 색)
  const LOC_CHIP_COLORS = {
    '1층': '#a78bfa', '판금': '#f472b6', '도장': '#fb923c', '정비': '#34d399',
    '도장대기중': '#fbbf24', '조립대기중': '#2dd4bf', '조립중': '#84cc16',
    '5층': '#60a5fa', '지하': '#94a3b8'
  };
  // 상태별 색
  const STATUS_CHIP_COLORS = {
    '입고': '#fb923c', '수리대기': '#fbbf24', '수리중': '#3b82f6',
    '수리완료': '#10b981', '출고': '#64748b', '미수리출고': '#ef4444'
  };
  function _chipStyle(c) {
    return `--chip-color:${c};background:linear-gradient(135deg,${c}2e,${c}10);border-color:${c}66;color:${c};`;
  }

  // 위치 빠른변경 셀
  function locationQuickCell(id, loc, status) {
    if (status === '출고' || status === '미수리 출고') return '-';
    const label = loc || '위치없음';
    const emptyClass = loc ? '' : ' empty';
    const styleAttr = loc ? ` style="${_chipStyle(LOC_CHIP_COLORS[loc] || '#94a3b8')}"` : '';
    return `<button class="ops-chip ops-location${emptyClass}"${styleAttr} onclick="openLocPicker('${id}','${loc||''}')" type="button" title="클릭하여 위치 선택"><span>${esc(label)}</span></button>`;
  }

  // 상태 빠른변경 셀
  function statusQuickCell(id, status) {
    const key = (status || '').replace(/\s/g, '');
    const styleAttr = ` style="${_chipStyle(STATUS_CHIP_COLORS[key] || '#94a3b8')}"`;
    return `<button class="ops-chip ops-status status-${esc(key)}"${styleAttr} onclick="openStatusPicker('${id}','${status}')" type="button" title="클릭하여 상태 선택"><span>${esc(status || '상태없음')}</span></button>`;
  }

  window.openStatusPicker = function(id, current) {
    document.getElementById('statusPickerId').value = id;
    document.querySelectorAll('.status-pick-btn').forEach(btn => {
      btn.style.opacity = btn.dataset.val === current ? '1' : '0.5';
      btn.style.transform = btn.dataset.val === current ? 'scale(1.05)' : 'scale(1)';
    });
    document.getElementById('statusPickerModal').classList.add('open');
  };

  window.saveStatus = async function(val) {
    const id = document.getElementById('statusPickerId').value;
    const updateData = { status: val, updatedAt: new Date().toISOString() };
    if (val === '출고' || val === '미수리 출고') updateData.outDate = new Date().toISOString().split('T')[0];
    try {
      await update(ref(db, `records/${id}`), updateData);
      showNotif(`상태가 "${val}"(으)로 변경되었습니다 `);
    } catch(e) { showNotif('변경 실패', true); }
    document.getElementById('statusPickerModal').classList.remove('open');
  };

  // 위치 선택 팝업 열기
  window.openLocPicker = function(id, current) {
    document.getElementById('locPickerId').value = id;
    document.querySelectorAll('.loc-pick-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === current);
    });
    document.getElementById('locPickerModal').classList.add('open');
  };

  // 위치 저장
  window.saveLocation = async function(val) {
    const id = document.getElementById('locPickerId').value;
    try {
      await update(ref(db, `records/${id}`), { location: val, updatedAt: new Date().toISOString() });
      showNotif(`위치가 "${val}"(으)로 변경되었습니다 `);
    } catch(e) { showNotif('변경 실패', true); }
    document.getElementById('locPickerModal').classList.remove('open');
  };

  window.clearLocation = async function() {
    const id = document.getElementById('locPickerId').value;
    try {
      await update(ref(db, `records/${id}`), { location: '', updatedAt: new Date().toISOString() });
      showNotif('위치가 초기화되었습니다');
    } catch(e) { showNotif('변경 실패', true); }
    document.getElementById('locPickerModal').classList.remove('open');
  };

  // ---- DASHBOARD ----
  function _weekRange(offset) {
    const now = new Date();
    const day = now.getDay() || 7; // 일요일=7로 처리
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1 + offset * 7);
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return { start: monday.getTime(), end: sunday.getTime() };
  }
  function renderOutSchedule() {
    const list = getList().filter(r => r.status !== '출고' && r.status !== '미수리 출고' && r.outDate);
    const tw = _weekRange(0);
    const nw = _weekRange(1);
    const inRange = (d, r) => { const t = new Date(d).getTime(); return !isNaN(t) && t >= r.start && t <= r.end; };
    const thisWk = list.filter(r => inRange(r.outDate, tw)).sort((a,b)=> new Date(a.outDate)-new Date(b.outDate));
    const nextWk = list.filter(r => inRange(r.outDate, nw)).sort((a,b)=> new Date(a.outDate)-new Date(b.outDate));
    const dayLabel = (d) => { const x = new Date(d); const wk = ['일','월','화','수','목','금','토'][x.getDay()]; return `${x.getMonth()+1}/${x.getDate()}(${wk})`; };
    const itemHtml = (r) => `<div class="item" onclick="openDetailModal('${esc(r.id)}')" title="클릭하여 상세보기"><div class="car">${esc(r.carNum)}${r.carModel ? ` <span style="font-size:11px;color:var(--text-dim);font-weight:500;">${esc(r.carModel)}</span>` : ''}</div><div class="meta"><span class="nm">${esc(r.name)||'-'}</span><span>${dayLabel(r.outDate)}</span></div></div>`;
    const tEl = document.getElementById('outSideThis');
    const nEl = document.getElementById('outSideNext');
    if (tEl) tEl.innerHTML = thisWk.length ? thisWk.map(itemHtml).join('') : `<div class="empty-mini">예정 없음</div>`;
    if (nEl) nEl.innerHTML = nextWk.length ? nextWk.map(itemHtml).join('') : `<div class="empty-mini">예정 없음</div>`;
    const tc = document.getElementById('outSideThisCnt');
    const nc = document.getElementById('outSideNextCnt');
    if (tc) tc.textContent = thisWk.length;
    if (nc) nc.textContent = nextWk.length;
  }

  function renderDashboard() {
    if (LOCAL_DASHBOARD_PREVIEW) {
      renderLocalDashboardPreview();
      return;
    }
    const list = getList();
    const active = list.filter(r => r.status !== '출고' && r.status !== '미수리 출고');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('stat-total').textContent = active.length;
    document.getElementById('stat-wait').textContent = list.filter(r=>r.status==='수리대기').length;
    document.getElementById('stat-repair').textContent = list.filter(r=>r.status==='수리중').length;
    document.getElementById('stat-done').textContent = list.filter(r=>r.status==='수리완료').length;
    document.getElementById('stat-today').textContent = list.filter(r=>r.inDate===today).length;

    // 정비차량 (KGM) 일일 카운트 — kgmDailyMap 기반
    const thisMonth = today.slice(0, 7); // 'YYYY-MM'
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const todayCount = kgmDailyMap[today] || 0;
    let monthSum = 0;
    Object.entries(kgmDailyMap).forEach(([day, cnt]) => { if (day.startsWith(thisMonth)) monthSum += cnt; });
    setText('stat-kgm-today', todayCount);
    setText('stat-kgm-month', monthSum);

    // 이번 주 (월요일 ~ 오늘) 누적
    const nowD = new Date();
    const dow = nowD.getDay(); // 0=일, 1=월, ..., 6=토
    const daysFromMon = (dow + 6) % 7; // 월=0, 일=6
    const weekStart = new Date(nowD); weekStart.setDate(nowD.getDate() - daysFromMon); weekStart.setHours(0,0,0,0);
    let weekSum = 0;
    Object.entries(kgmDailyMap).forEach(([day, cnt]) => {
      const d = new Date(day + 'T00:00:00');
      if (d >= weekStart && d <= nowD) weekSum += cnt;
    });
    setText('stat-kgm-week', weekSum);

    // 이번 분기 (1~3월=Q1, 4~6=Q2, 7~9=Q3, 10~12=Q4)
    const curMonth = nowD.getMonth(); // 0-11
    const qStartMonth = Math.floor(curMonth / 3) * 3;
    const qStart = new Date(nowD.getFullYear(), qStartMonth, 1);
    let quarterSum = 0;
    Object.entries(kgmDailyMap).forEach(([day, cnt]) => {
      const d = new Date(day + 'T00:00:00');
      if (d >= qStart && d <= nowD) quarterSum += cnt;
    });
    setText('stat-kgm-quarter', quarterSum);

    // 인사이트: 이번 달 일평균 (지난 일수 기준)
    const daysIntoMonth = nowD.getDate(); // 1-31
    const avg = (monthSum / daysIntoMonth).toFixed(1);
    setText('kgm-daily-avg', avg);

    // 인사이트: 지난 주 대비 (지난 주 월~일 합계 vs 이번 주까지 합계)
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart); lastWeekEnd.setDate(weekStart.getDate() - 1); lastWeekEnd.setHours(23,59,59,999);
    let lastWeekSum = 0;
    Object.entries(kgmDailyMap).forEach(([day, cnt]) => {
      const d = new Date(day + 'T00:00:00');
      if (d >= lastWeekStart && d <= lastWeekEnd) lastWeekSum += cnt;
    });
    const diff = weekSum - lastWeekSum;
    const diffEl = document.getElementById('kgm-week-diff');
    if (diffEl) {
      if (lastWeekSum === 0 && weekSum === 0) {
        diffEl.textContent = '—';
        diffEl.style.color = '#a0a4ac';
      } else if (diff > 0) {
        diffEl.textContent = '+' + diff + '대 ↑';
        diffEl.style.color = '#69db7c';
      } else if (diff < 0) {
        diffEl.textContent = diff + '대 ↓';
        diffEl.style.color = '#ff8787';
      } else {
        diffEl.textContent = '동일';
        diffEl.style.color = '#a0a4ac';
      }
    }

    // 메타: 저장 상태 안내
    const metaEl = document.getElementById('kgm-today-meta');
    if (metaEl) metaEl.textContent = todayCount > 0 ? '저장됨' : '하루 끝에 저장';

    renderKgmIntakeChart();  // kgmDailyMap 사용
    renderLocationDonut(active);

    // 월별 통계도 대시보드로 통합됨 → 같이 렌더
    if (typeof initYearSelect === 'function') { try { initYearSelect(); } catch(e){} }
    if (typeof renderStats === 'function') { try { renderStats(); } catch(e){} }

    renderOutSchedule();

    const dq = (document.getElementById('dashSearchInput')?.value||'').toLowerCase().trim();
    const dLoc = document.getElementById('dashFilterLoc')?.value||'';
    const dSt = document.getElementById('dashFilterStatus')?.value||'';
    const resultEl = document.getElementById('dashSearchResult');

    const show = list.filter(r => {
      if (r.status === '출고' || r.status === '미수리 출고') return false;
      const mq = !dq || r.carNum.toLowerCase().includes(dq) || (r.name||'').toLowerCase().includes(dq) || (r.phone||'').includes(dq) || (r.repair||'').toLowerCase().includes(dq);
      const ml = !dLoc || (r.location||'') === dLoc;
      const ms = !dSt || r.status === dSt;
      return mq && ml && ms;
    }).sort((a,b) => new Date(b.inDate)-new Date(a.inDate));

    const recentTbody = document.getElementById('recent-dashboard-tbody');
    if (recentTbody) {
      const recent = show.slice(0, 5);
      recentTbody.innerHTML = recent.length ? recent.map(r => `
        <tr>
          <td>${fmt(r.inDate)}</td>
          <td><span class="car-num" onclick="openDetailModal('${esc(r.id)}')" style="cursor:pointer;" title="클릭하여 상세보기">${esc(r.carNum)}</span></td>
          <td>${esc(r.carModel)||'-'}</td>
          <td>${statusQuickCell(r.id, r.status)}</td>
        </tr>`).join('') : `<tr><td colspan="4" class="empty" style="padding:22px">최근 입고 차량이 없습니다</td></tr>`;
    }

    if (dq || dLoc || dSt) {
      resultEl.style.display = 'block';
      resultEl.textContent = `검색 결과: ${show.length}대` + (dq ? ` (\"${dq}\")` : '') + (dLoc ? ` · 위치: ${dLoc}` : '') + (dSt ? ` · 상태: ${dSt}` : '');
    } else {
      resultEl.style.display = 'none';
    }

    const tbody = document.getElementById('dashboard-tbody');
    if (!show.length) { tbody.innerHTML = `<tr><td colspan="12" class="empty" style="padding:30px">${(dq||dLoc||dSt) ? '검색 결과가 없습니다' : '입고 차량이 없습니다'}</td></tr>`; return; }
    tbody.innerHTML = show.map(r => `
      <tr>
        <td><span class="car-num" onclick="openDetailModal('${esc(r.id)}')" style="cursor:pointer;" title="클릭하여 상세보기"> ${esc(r.carNum)}</span></td>
        <td>${esc(r.carModel)||'-'}</td>
        <td>${phoneCell(r.phone)}</td>
        <td>${locationQuickCell(r.id, r.location, r.status)}</td>
        <td>${statusQuickCell(r.id, r.status)}</td>
        <td>${insBadge(r.insDaemul,'대물')}</td>
        <td>${insBadge(r.insJacha,'자차')}</td>
        <td>${repairCell(r.repair)}</td>
        <td>${r.rent ? `<span style="background:rgba(251,146,60,0.12);color:#fb923c;padding:2px 8px;border-radius:5px;font-size:12px;font-weight:600;"> ${esc(r.rent)}</span>` : '-'}</td>
        <td>${fmt(r.inDate)}</td>
        <td>${fmt(r.outDate)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="window._openModal('${esc(r.id)}')">수정</button></td>
      </tr>`).join('');
  }

  // ── 정비차량 (KGM) 14일 입고 추이 SVG 차트 — kgmDailyMap 기반 ──
  function renderKgmIntakeChart() {
    const el = document.getElementById('kgmIntakeChart');
    if (!el) return;
    const today = new Date();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const count = kgmDailyMap[ds] || 0;
      const dow = ['일','월','화','수','목','금','토'][d.getDay()];
      days.push({
        date: ds, count: count,
        label: (d.getMonth()+1) + '/' + d.getDate(),
        dow: dow,
        isToday: i === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    const max = Math.max(2, ...days.map(d => d.count));
    const w = 760, h = 210, padL = 32, padR = 16, padB = 46, padT = 18;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const slot = innerW / days.length;
    const yTicks = [0, Math.ceil(max/2), max];

    const yLines = yTicks.map(v => {
      const y = h - padB - (innerH * v) / max;
      return `<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3,3"/>` +
             `<text x="${padL-6}" y="${y+3}" text-anchor="end" font-size="10" fill="#a0a4ac" font-family="JetBrains Mono,monospace">${v}</text>`;
    }).join('');

    const points = days.map((d, i) => {
      const x = padL + i * slot + slot / 2;
      const y = h - padB - (innerH * d.count) / max;
      return { x, y, d };
    });
    const linePath = points.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    const areaPath = linePath + ` L ${points[points.length-1].x.toFixed(1)} ${h-padB} L ${points[0].x.toFixed(1)} ${h-padB} Z`;

    const labels = points.map((p, i) => {
      const d = p.d;
      const labelColor = d.isWeekend ? '#94a3b8' : '#c1c5cc';
      return `<g>` +
        `<circle cx="${p.x}" cy="${p.y}" r="${d.isToday ? 4 : 3}" fill="${d.isToday ? '#c4b5fd' : '#8b5cf6'}" stroke="#111827" stroke-width="2"/>` +
        `<text x="${p.x}" y="${h - padB + 16}" text-anchor="middle" font-size="10" fill="${labelColor}" font-family="JetBrains Mono,monospace">${d.label}</text>` +
        `<text x="${p.x}" y="${h - padB + 30}" text-anchor="middle" font-size="9" fill="${labelColor}" opacity="0.7">${d.dow}</text>` +
      `</g>`;
    }).join('');

    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;min-width:600px;height:${h}px;display:block;">` +
      `<defs><linearGradient id="kgmArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity=".42"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity=".02"/></linearGradient><filter id="kgmGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
      yLines +
      `<path d="${areaPath}" fill="url(#kgmArea)"/>` +
      `<path d="${linePath}" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#kgmGlow)"/>` +
      labels +
      `</svg>`;
  }
  window._renderKgmIntakeChart = renderKgmIntakeChart;

  // ── 건물 모양 위치 분포 (5층 + 도장팀 + 판금팀 + 정비팀 + 지하) ──
  // 실제 location 값들을 5개 층으로 그룹핑
  // 실제 건물 구조: 5층=주차장 / 3층=도장 / 2층=판금 / 1층=정비+마당 / 지하=주차장
  // (4층 없음. 도장대기중은 주로 5층, 조립*은 2층 기본)
  const FLOOR_MAP = {
    '5층':         { floor: '5층' },
    '도장대기중':  { floor: '5층' },
    '도장':        { floor: '3층' },
    '판금':        { floor: '2층' },
    '조립대기중':  { floor: '2층' },
    '조립중':      { floor: '2층' },
    '정비':        { floor: '1층' },
    '1층':         { floor: '1층' },
    '지하':        { floor: '지하' },
  };
  const FLOOR_ORDER = ['5층', '3층', '2층', '1층', '지하'];
  const FLOOR_ROLES = {
    '5층':   '주차장',
    '3층':   '도장',
    '2층':   '판금',
    '1층':   '정비·마당',
    '지하':   '주차장',
  };
  const FLOOR_COLORS = {
    '5층':   '#60a5fa',  // 파랑 (옥상 주차장)
    '3층':   '#fb923c',  // 오렌지 (도장)
    '2층':   '#f472b6',  // 핑크 (판금)
    '1층':   '#34d399',  // 그린 (정비)
    '지하':   '#94a3b8',  // 회색 (지하 주차장)
    '미지정': '#6b7280',
  };

  function renderLocationDonut(activeList) {
    const el = document.getElementById('locationBuilding');
    const totalEl = document.getElementById('loc-total');
    if (!el) return;

    // 층별 카운트 + 미지정 위치
    const floorCounts = { '5층':0, '3층':0, '2층':0, '1층':0, '지하':0 };
    let unmapped = 0;
    activeList.forEach(r => {
      const loc = (r.location || '').trim();
      const mapped = FLOOR_MAP[loc];
      if (mapped) floorCounts[mapped.floor]++;
      else unmapped++;
    });
    const total = activeList.length;
    if (totalEl) totalEl.textContent = total;

    if (total === 0) {
      el.innerHTML = '<div style="text-align:center;padding:36px 10px;color:var(--text-dim);font-size:13px;">현재 입고된 차량이 없습니다</div>';
      return;
    }

    const floors = FLOOR_ORDER.map(name => {
      const cnt = floorCounts[name];
      const color = FLOOR_COLORS[name];
      const role = FLOOR_ROLES[name] || '';
      const dots = Array.from({length: cnt}, () => `<span class="car-dot" style="--car-color:${color};"></span>`).join('');
      const countCls = cnt === 0 ? 'floor-count zero' : 'floor-count';
      return `<div class="floor">` +
        `<div class="floor-name"><span>${name}</span><span class="floor-sub" style="color:${color};">${role}</span></div>` +
        `<div class="floor-cars">${dots}</div>` +
        `<div class="${countCls}">${cnt}</div>` +
      `</div>`;
    }).join('');

    // 매핑 안 된 차량(미지정 등) 있으면 추가 표시
    let unmappedFloor = '';
    if (unmapped > 0) {
      const color = FLOOR_COLORS['미지정'];
      const dots = Array.from({length: unmapped}, () => `<span class="car-dot" style="--car-color:${color};"></span>`).join('');
      unmappedFloor = `<div class="floor"><div class="floor-name">미지정<span class="floor-sub" style="color:${color};opacity:0.85;">●</span></div><div class="floor-cars">${dots}</div><div class="floor-count">${unmapped}</div></div>`;
    }

    el.innerHTML = floors + unmappedFloor;
  }
  window._renderLocationDonut = renderLocationDonut;

  // ---- LIST ----
  function renderList() {
    const q = (document.getElementById('searchInput')?.value||'').toLowerCase();
    const fs = document.getElementById('filterStatus')?.value||'';
    let data = getList().filter(r => {
      const m = !q || r.carNum.toLowerCase().includes(q) || (r.name||'').toLowerCase().includes(q) || (r.phone||'').includes(q);
      return m && (!fs || r.status===fs);
    }).sort((a,b) => new Date(b.inDate)-new Date(a.inDate));

    const tbody = document.getElementById('list-tbody');
    const empty = document.getElementById('list-empty');
    if (!data.length) { tbody.innerHTML=''; empty.style.display='block'; return; }
    empty.style.display='none';
    tbody.innerHTML = data.map(r => `
      <tr>
        <td><span class="car-num">${esc(r.carNum)}</span></td>
        <td>${esc(r.carModel)||'-'}</td>
        <td>${phoneCell(r.phone)}</td>
        <td>${locationBadge(r.location, r.status)}</td>
        <td>${insBadge(r.insDaemul,'대물')}</td>
        <td>${insBadge(r.insJacha,'자차')}</td>
        <td>${repairCell(r.repair)}</td>
        <td>${fmt(r.inDate)}</td>
        <td>${fmt(r.outDate)}</td>
        <td style="color:var(--green);font-weight:600;">${fmtCost(r.cost)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>
          <div style="display:flex;gap:5px;">
            <button class="btn btn-ghost btn-sm" onclick="window._openModal('${esc(r.id)}')">수정</button>
            <button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);" onclick="window._delete('${esc(r.id)}','${esc(r.carNum)}','${esc(r.name)}')">삭제</button>
          </div>
        </td>
      </tr>`).join('');
  }

  // ---- OUT ----
  function renderOut() {
    const q = (document.getElementById('searchOutInput')?.value||'').toLowerCase();
    const month = document.getElementById('filterOutMonth')?.value||'';
    let data = getList().filter(r => {
      if (r.status !== '출고') return false;
      const mq = !q || r.carNum.toLowerCase().includes(q) || (r.name||'').toLowerCase().includes(q);
      const mm = !month || (r.outDate||'').startsWith(month);
      return mq && mm;
    }).sort((a,b) => new Date(b.outDate) - new Date(a.outDate));

    const tbody = document.getElementById('out-tbody');
    const empty = document.getElementById('out-empty');
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML=''; empty.style.display='block'; return; }
    empty.style.display='none';
    tbody.innerHTML = data.map(r => `
      <tr>
        <td><span class="car-num" onclick="openDetailModal('${esc(r.id)}')" style="cursor:pointer;" title="클릭하여 상세보기"> ${esc(r.carNum)}</span></td>
        <td>${esc(r.carModel)||'-'}</td>
        <td>${phoneCell(r.phone)}</td>
        <td>${insBadge(r.insDaemul,'대물')}</td>
        <td>${insBadge(r.insJacha,'자차')}</td>
        <td>${repairCell(r.repair)}</td>
        <td style="color:var(--green);font-weight:700;">${fmtCost(r.cost)}</td>
        <td>${fmtFull(r.inDate)}</td>
        <td style="color:var(--accent);font-weight:600;">${fmtFull(r.outDate)}</td>
        <td>${esc(r.km)||'-'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="window._openModal('${esc(r.id)}')">수정</button>
        </td>
      </tr>`).join('');
  }
  function fmtFull(d) { if(!d) return '-'; return d; }
  window.renderOut = renderOut;

  // ---- COMPLETE ----
  function renderComplete() {
    const allList = getList();
    const data = allList.filter(r=>r.status==='수리완료').sort((a,b)=>new Date(b.inDate)-new Date(a.inDate));
    const tbody = document.getElementById('complete-tbody');
    const empty = document.getElementById('complete-empty');
    if (!data.length) { tbody.innerHTML=''; empty.style.display='block'; return; }
    empty.style.display='none';
    tbody.innerHTML = data.map(r => `
      <tr>
        <td><span class="car-num" onclick="openDetailModal('${esc(r.id)}')" style="cursor:pointer;" title="클릭하여 상세보기"> ${esc(r.carNum)}</span></td>
        <td>${esc(r.carModel)||'-'}</td>
        <td>${phoneCell(r.phone)}</td>
        <td>${locationQuickCell(r.id, r.location, r.status)}</td>
        <td>${insBadge(r.insDaemul,'대물')}</td>
        <td>${insBadge(r.insJacha,'자차')}</td>
        <td>${repairCell(r.repair)}</td>
        <td style="color:var(--green);font-weight:700;">${fmtCost(r.cost)}</td>
        <td>${fmt(r.inDate)}</td>
        <td>${esc(r.km)||'-'}</td>
        <td>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn btn-success btn-sm" onclick="window._markOut('${esc(r.id)}','${esc(r.carNum)}','${esc(r.name)}')">출고 처리</button>
            ${window._isAdmin && window._isAdmin() ? `<button class="btn btn-sm" style="background:rgba(232,68,42,0.18);color:#e8442a;border:1px solid rgba(232,68,42,0.4);font-weight:700;" onclick="window._openBlacklistRegModal('${esc(r.id)}','${esc(r.carNum)}','${esc(r.name||'')}','${esc(r.phone||'')}')"> 블랙+출고</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="window._openModal('${esc(r.id)}')">수정</button>
          </div>
        </td>
      </tr>`).join('');
  }

  window.renderComplete = renderComplete;
  // ---- MODAL ----
  window.openModal = function() { _openModal(null); };
  window._openModal = function(id) {
    editingId = id || null;
    document.getElementById('modalTitle').textContent = id ? '차량 정보 수정' : '차량 등록';
    if (id && records[id]) {
      const r = records[id];
      document.getElementById('f-carnum').value = r.carNum||'';
      document.getElementById('f-status').value = r.status||'입고';
      document.getElementById('f-phone').value = r.phone||'';
      document.getElementById('f-indate').value = r.inDate||'';
      document.getElementById('f-outdate').value = r.outDate||'';
      document.getElementById('f-repair').value = r.repair||'';
      document.getElementById('f-cost').value = r.cost||'';
      document.getElementById('f-km').value = r.km||'';
      document.getElementById('f-rent').value = r.rent||'';
      document.getElementById('f-ins-daemul').value = r.insDaemul||'';
      document.getElementById('f-ins-jacha').value = r.insJacha||'';
      document.getElementById('f-carmodel').value = r.carModel||'';
      document.getElementById('f-daemul-receipt').value = r.daemulReceipt||'';
      document.getElementById('f-daemul-manager').value = r.daemulManager||'';
      document.getElementById('f-jacha-receipt').value = r.jachaReceipt||'';
      document.getElementById('f-jacha-manager').value = r.jachaManager||'';
      document.querySelectorAll('input[name="location"]').forEach(el => { el.checked = el.value === (r.location||''); });
      document.querySelectorAll('input[name="carType"]').forEach(el => { el.checked = el.value === (r.carType||''); });
      document.getElementById('f-memo').value = r.memo||'';
    } else {
      ['f-carnum','f-phone','f-outdate','f-repair','f-cost','f-km','f-rent','f-ins-daemul','f-ins-jacha','f-memo','f-carmodel','f-daemul-receipt','f-daemul-manager','f-jacha-receipt','f-jacha-manager'].forEach(id=>document.getElementById(id).value='');
      document.querySelectorAll('input[name="location"]').forEach(el => el.checked = false);
      document.querySelectorAll('input[name="carType"]').forEach(el => el.checked = false);
      document.getElementById('f-status').value = '입고';
      document.getElementById('f-indate').value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('formModal').classList.add('open');
    // 블랙 경고 평가 (수정 모드면 기존 차량번호로 즉시, 신규면 비워둠)
    setTimeout(function() { if (window._checkBlacklistWarning) window._checkBlacklistWarning(); }, 0);
  };

  window.closeModal = function() {
    document.getElementById('formModal').classList.remove('open');
    editingId = null;
    var w = document.getElementById('blacklistWarning');
    if (w) { w.style.display = 'none'; w.innerHTML = ''; }
  };

  // 블랙리스트 경고 박스 평가
  window._checkBlacklistWarning = function() {
    var inp = document.getElementById('f-carnum');
    var box = document.getElementById('blacklistWarning');
    if (!inp || !box) return;
    var val = inp.value.trim();
    if (!val) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var entry = window._getBlacklistEntry(val);
    if (!entry) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var sev = entry.severity || 'medium';
    var sevColor = sev === 'high' ? '#e8442a' : sev === 'low' ? '#fbbf24' : '#ef4444';
    var sevLabel = sev === 'high' ? ' 높음' : sev === 'low' ? ' 낮음' : ' 중간';
    var pastCount = 0;
    var nv = normalizeCarNum(val);
    Object.values(records).forEach(function(r){ if (r && normalizeCarNum(r.carNum||'') === nv) pastCount++; });
    var addedDate = entry.addedAt ? String(entry.addedAt).slice(0,10) : '-';
    box.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
      +   ''
      +   '<span style="font-weight:800;color:#e8442a;font-size:14px;">블랙 등록 차량입니다</span>'
      +   '<span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(232,68,42,.2);color:'+sevColor+';font-weight:700;">'+sevLabel+'</span>'
      + '</div>'
      + '<div style="font-size:12px;color:rgba(250,250,250,.85);margin-bottom:4px;"><b>사유:</b> ' + esc(entry.reason||'(미입력)') + '</div>'
      + '<div style="font-size:11px;color:rgba(250,250,250,.55);">등록일 ' + esc(addedDate) + ' · 등록자 ' + esc(entry.addedBy||'-') + ' · 과거 입고 ' + pastCount + '건</div>';
    box.style.display = 'block';
  };

  // 폼 데이터 수집 (공통)
  function collectFormData() {
    const carNum = document.getElementById('f-carnum').value.trim();
    const inDate = document.getElementById('f-indate').value;
    if (!carNum) { showNotif('차량번호를 입력해주세요', true); return null; }
    if (!inDate) { showNotif('입고일을 입력해주세요', true); return null; }
    const status = document.getElementById('f-status').value;
    return {
      carNum,
      phone: document.getElementById('f-phone').value.trim(),
      status,
      inDate,
      outDate: (status === '출고' || status === '미수리 출고')
        ? (document.getElementById('f-outdate').value || new Date().toISOString().split('T')[0])
        : document.getElementById('f-outdate').value||'',
      repair: document.getElementById('f-repair').value.trim(),
      cost: parseInt(document.getElementById('f-cost').value)||0,
      km: document.getElementById('f-km').value.trim(),
      rent: document.getElementById('f-rent').value.trim(),
      insDaemul: document.getElementById('f-ins-daemul').value.trim(),
      insJacha: document.getElementById('f-ins-jacha').value.trim(),
      carModel: document.getElementById('f-carmodel').value.trim(),
      daemulReceipt: document.getElementById('f-daemul-receipt').value.trim(),
      daemulManager: document.getElementById('f-daemul-manager').value.trim(),
      jachaReceipt: document.getElementById('f-jacha-receipt').value.trim(),
      jachaManager: document.getElementById('f-jacha-manager').value.trim(),
      location: (document.querySelector('input[name="location"]:checked')||{}).value||'',
      carType: (document.querySelector('input[name="carType"]:checked')||{}).value||'',
      memo: document.getElementById('f-memo').value.trim(),
      updatedAt: new Date().toISOString(),
    };
  }

  window.saveRecord = async function() {
    const data = collectFormData();
    if (!data) return;

    const btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.textContent = '저장 중...';

    try {
      if (editingId) {
        await update(ref(db, `records/${editingId}`), data);
        showNotif(`${data.carNum} 정보가 수정되었습니다 `);
      } else {
        data.createdAt = new Date().toISOString();
        await push(recordsRef, data);
        showNotif(`${data.carNum} 차량이 등록되었습니다 `);
      }
      closeModal();
    } catch(e) {
      showNotif('저장 실패: ' + e.message, true);
    }
    btn.disabled = false; btn.textContent = '저장';
  };

  window._delete = async function(id, carNum, name) {
    var rec = records[id];
    var subtitle = name || (rec && rec.carModel) || '';
    if (!confirm(`${carNum}${subtitle ? ' (' + subtitle + ')' : ''} 차량을 삭제하시겠습니까?`)) return;
    // Storage 사진도 best-effort로 정리 (실패해도 DB 삭제는 진행)
    try {
      var rec = records[id];
      var stages = (rec && rec.photos) ? Object.keys(rec.photos) : [];
      for (var i = 0; i < stages.length; i++) {
        var arr = rec.photos[stages[i]] || [];
        for (var j = 0; j < arr.length; j++) {
          if (arr[j] && arr[j].path) {
            try { await window._deleteObject(window._sRef(window._storage, arr[j].path)); }
            catch(e) { console.warn('storage cleanup failed:', arr[j].path, e); }
          }
        }
      }
    } catch(e) { console.warn('photo cleanup error (proceeding):', e); }
    try {
      await remove(ref(db, `records/${id}`));
      showNotif('삭제되었습니다');
    } catch(e) { showNotif('삭제 실패', true); }
  };

  window._markOut = async function(id, carNum, name) {
    var rec = records[id];
    var subtitle = name || (rec && rec.carModel) || '';
    if (!confirm(`${carNum}${subtitle ? ' (' + subtitle + ')' : ''} 차량을 출고 처리하시겠습니까?`)) return;
    try {
      await update(ref(db, `records/${id}`), {
        status: '출고',
        outDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      });
      showNotif(`${carNum} 출고 처리 완료! `);
    } catch(e) { showNotif('처리 실패', true); }
  };

  // ── 블랙리스트 등록 후 출고 ──
  let _blacklistRegTarget = null;
  window._openBlacklistRegModal = function(id, carNum, name, phone) {
    if (!window._isAdmin()) { showNotif('관리자 권한이 필요합니다', true); return; }
    _blacklistRegTarget = { id: id, carNum: carNum, name: name||'', phone: phone||'' };
    document.getElementById('bl-carnum').value = carNum;
    document.getElementById('bl-name').value = name || '(미입력)';
    document.getElementById('bl-severity').value = 'medium';
    document.getElementById('bl-reason').value = '';
    document.getElementById('blacklistRegModal').classList.add('open');
    setTimeout(function(){ document.getElementById('bl-reason').focus(); }, 50);
  };

  window._confirmBlacklistAndOut = async function() {
    if (!_blacklistRegTarget) return;
    if (!window._isAdmin()) { showNotif('관리자 권한이 필요합니다', true); return; }
    var reason = document.getElementById('bl-reason').value.trim();
    if (!reason) { showNotif('사유를 입력해주세요', true); return; }
    if (reason.length > 500) { showNotif('사유가 너무 깁니다 (500자 이내)', true); return; }
    var severity = document.getElementById('bl-severity').value;
    if (['high','medium','low'].indexOf(severity) < 0) severity = 'medium';
    var t = _blacklistRegTarget;
    var key = normalizeCarNum(t.carNum);
    if (!key) { showNotif('차량번호가 없습니다', true); return; }
    try {
      await update(ref(db, 'blacklist/' + key), {
        carNum: t.carNum,
        name: t.name,
        phone: t.phone,
        reason: reason,
        severity: severity,
        addedAt: new Date().toISOString(),
        addedBy: (window.currentUser && window.currentUser.email) || (window._userEmail || '-')
      });
      // 동시 출고 처리
      await update(ref(db, 'records/' + t.id), {
        status: '출고',
        outDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      });
      document.getElementById('blacklistRegModal').classList.remove('open');
      _blacklistRegTarget = null;
      showNotif(' 블랙 등록 + 출고 완료');
    } catch(e) {
      console.error('blacklist+out failed', e);
      showNotif('처리 실패: ' + (e.message||e), true);
    }
  };

  // ── 블랙리스트 페이지 렌더 ──
  window._renderBlacklist = function() {
    var body = document.getElementById('blacklistBody');
    var empty = document.getElementById('blacklist-empty');
    if (!body) return;
    var q = (document.getElementById('searchBlacklist')?.value || '').trim().toLowerCase();
    var entries = Object.entries(blacklistMap || {})
      .map(function(kv){ return Object.assign({_key: kv[0]}, kv[1] || {}); })
      .filter(function(e){
        if (!q) return true;
        return (e.carNum||'').toLowerCase().includes(q)
          || (e.name||'').toLowerCase().includes(q)
          || (e.reason||'').toLowerCase().includes(q);
      })
      .sort(function(a,b){ return (b.addedAt||'').localeCompare(a.addedAt||''); });

    if (!entries.length) {
      body.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    body.innerHTML = entries.map(function(e){
      var sev = e.severity || 'medium';
      var sevColor = sev === 'high' ? '#e8442a' : sev === 'low' ? '#fbbf24' : '#ef4444';
      var sevLabel = sev === 'high' ? ' 높음' : sev === 'low' ? ' 낮음' : ' 중간';
      var addedDate = e.addedAt ? String(e.addedAt).slice(0,10) : '-';
      var nv = normalizeCarNum(e.carNum||'');
      var pastCount = 0;
      Object.values(records).forEach(function(r){ if (r && normalizeCarNum(r.carNum||'') === nv) pastCount++; });
      return '<tr>'
        + '<td><span class="car-num" style="color:#e8442a;">' + esc(e.carNum||'-') + '</span></td>'
        + '<td>' + esc(e.name||'-') + '</td>'
        + '<td>' + esc(e.phone||'-') + '</td>'
        + '<td><span style="padding:2px 8px;border-radius:4px;background:rgba(232,68,42,.18);color:' + sevColor + ';font-weight:700;font-size:11px;">' + sevLabel + '</span></td>'
        + '<td style="max-width:280px;white-space:normal;word-break:keep-all;">' + esc(e.reason||'-') + '</td>'
        + '<td>' + esc(addedDate) + '</td>'
        + '<td style="font-size:11px;color:var(--text-dim);">' + esc(e.addedBy||'-') + '</td>'
        + '<td style="text-align:center;">' + pastCount + '건</td>'
        + '<td>'
        +   '<div style="display:flex;gap:5px;">'
        +     '<button class="btn btn-ghost btn-sm" onclick="window._editBlacklistEntry(\'' + esc(e._key) + '\')">수정</button>'
        +     '<button class="btn btn-sm" style="background:rgba(232,68,42,0.18);color:#e8442a;border:1px solid rgba(232,68,42,0.4);" onclick="window._removeBlacklistEntry(\'' + esc(e._key) + '\',\'' + esc(e.carNum||'') + '\')">해제</button>'
        +   '</div>'
        + '</td>'
        + '</tr>';
    }).join('');
  };

  window._removeBlacklistEntry = async function(key, carNum) {
    if (!window._isAdmin()) { showNotif('관리자 권한이 필요합니다', true); return; }
    if (!confirm((carNum||key) + ' 블랙 등록을 해제할까요?')) return;
    try {
      await update(ref(db, 'blacklist'), { [key]: null });
      showNotif('블랙 해제 완료');
    } catch(e) { showNotif('해제 실패: ' + (e.message||e), true); }
  };

  window._editBlacklistEntry = async function(key) {
    if (!window._isAdmin()) { showNotif('관리자 권한이 필요합니다', true); return; }
    var entry = blacklistMap[key];
    if (!entry) return;
    var newReason = prompt('새 사유 (최대 500자):', entry.reason || '');
    if (newReason === null) return;
    newReason = String(newReason).trim().slice(0, 500);
    if (!newReason) { showNotif('사유는 비어둘 수 없습니다', true); return; }
    var newSeverity = prompt('심각도 (high / medium / low):', entry.severity || 'medium');
    if (newSeverity === null) return;
    newSeverity = String(newSeverity).trim().toLowerCase();
    if (['high','medium','low'].indexOf(newSeverity) < 0) newSeverity = 'medium';
    try {
      await update(ref(db, 'blacklist/' + key), {
        reason: newReason,
        severity: newSeverity,
        updatedAt: new Date().toISOString(),
        updatedBy: (window.currentUser && window.currentUser.email) || (window._userEmail || '-')
      });
      showNotif('수정 완료');
    } catch(e) { showNotif('수정 실패: ' + (e.message||e), true); }
  };

  // ---- STATS ----
  function renderStats() {
    if (LOCAL_DASHBOARD_PREVIEW) {
      renderLocalDashboardPreview();
      return;
    }
    const list = getList();
    const yearSel = document.getElementById('statsYear');
    const monthSel = document.getElementById('statsMonth');
    const year = yearSel?.value || new Date().getFullYear().toString();
    const selMonth = monthSel?.value || 'all';

    const yearData = list.filter(r => (r.inDate||'').startsWith(year));

    // 선택된 월 또는 연간 데이터
    const isMonthly = selMonth !== 'all';
    const prefix = isMonthly ? year+'-'+selMonth : year;
    const periodData = isMonthly
      ? list.filter(r => (r.inDate||'').startsWith(prefix))
      : yearData;
    const periodOut = isMonthly
      ? list.filter(r => r.status === '출고' && (r.outDate||'').startsWith(prefix))
      : list.filter(r => r.status === '출고' && (r.outDate||'').startsWith(year));

    const kgm = periodData.filter(r => r.carType === 'KGM');
    const domestic = periodData.filter(r => r.carType === '국산차');
    const foreign = periodData.filter(r => r.carType === '외산차');
    const uncat = periodData.filter(r => !r.carType);
    const outDone = periodOut;

    // 기간 라벨
    const periodLabel = document.getElementById('statsPeriodLabel');
    if(periodLabel) periodLabel.textContent = isMonthly ? year+'년 '+parseInt(selMonth)+'월 분석' : year+'년 연간 분석';

    // 요약 카드
    const periodName = isMonthly ? parseInt(selMonth)+'월' : '연간';
    const summary = document.getElementById('stats-summary');
    if (summary) summary.innerHTML = `
      <div class="stat-card orange"><div class="stat-label">KGM</div><div class="stat-value" style="color:var(--accent);">${kgm.length}</div><div class="stat-sub">${periodData.length ? Math.round(kgm.length/periodData.length*100) : 0}% 비율</div></div>
      <div class="stat-card blue"><div class="stat-label">국산차</div><div class="stat-value" style="color:var(--blue);">${domestic.length}</div><div class="stat-sub">타사 국산</div></div>
      <div class="stat-card red"><div class="stat-label">외산차</div><div class="stat-value" style="color:var(--red);">${foreign.length}</div><div class="stat-sub">수입차</div></div>
      <div class="stat-card green"><div class="stat-label">${periodName} 입고</div><div class="stat-value" style="color:var(--green);">${periodData.length}</div><div class="stat-sub">출고완료 ${outDone.length}대</div></div>
    `;

    // 월별 데이터 수집 (한 번 순회로 O(N) 최적화)
    const monthBuckets = Array.from({length:12},()=>({mKgm:0,mDom:0,mFor:0,mUn:0,mOut:0,total:0}));
    list.forEach(r => {
      const inM = (r.inDate||'').slice(0,7);
      if(inM.startsWith(year)) {
        const mi = parseInt(inM.slice(5,7),10) - 1;
        if(mi >= 0 && mi < 12) {
          monthBuckets[mi].total++;
          if(r.carType==='KGM') monthBuckets[mi].mKgm++;
          else if(r.carType==='국산차') monthBuckets[mi].mDom++;
          else if(r.carType==='외산차') monthBuckets[mi].mFor++;
          else monthBuckets[mi].mUn++;
        }
      }
      if(r.status==='출고') {
        const outM = (r.outDate||'').slice(0,7);
        if(outM.startsWith(year)) {
          const oi = parseInt(outM.slice(5,7),10) - 1;
          if(oi >= 0 && oi < 12) monthBuckets[oi].mOut++;
        }
      }
    });
    const monthlyData = [];
    let tKgm=0,tDom=0,tFor=0,tUn=0,tTotal=0,tOut=0,maxMonth=0;
    for (let m = 1; m <= 12; m++) {
      const b = monthBuckets[m-1];
      const mm = String(m).padStart(2,'0');
      const pfx = `${year}-${mm}`;
      tKgm+=b.mKgm;tDom+=b.mDom;tFor+=b.mFor;tUn+=b.mUn;tTotal+=b.total;tOut+=b.mOut;
      if(b.total>maxMonth)maxMonth=b.total;
      monthlyData.push({m,mKgm:b.mKgm,mDom:b.mDom,mFor:b.mFor,mUn:b.mUn,mOut:b.mOut,total:b.total,prefix:pfx});
    }

    // 월별 리본 차트 — 총량 흐름 + 차종 비중 스트립
    const chart = document.getElementById('stats-chart');
    if(chart){
      const curMonth = new Date().toISOString().slice(0,7);
      const selPrefix = isMonthly ? prefix : '';
      const W = 760, H = 150, padL = 34, padR = 18, padT = 18, padB = 34;
      const innerW = W - padL - padR;
      const innerH = H - padT - padB;
      const maxV = Math.max(1, maxMonth);
      const pts = monthlyData.map((d, i) => {
        const x = padL + (monthlyData.length === 1 ? innerW / 2 : i / (monthlyData.length - 1) * innerW);
        const y = padT + innerH - (d.total / maxV) * innerH;
        return { x, y, d };
      });
      const linePath = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
      const areaPath = linePath + ` L ${pts[pts.length-1].x.toFixed(1)} ${padT+innerH} L ${pts[0].x.toFixed(1)} ${padT+innerH} Z`;
      const dots = pts.map(p => {
        const d = p.d;
        const isCur = d.prefix===curMonth;
        const isSel = selPrefix && d.prefix===selPrefix;
        const highlight = isSel||isCur;
        return `<g opacity="${selPrefix&&!isSel ? '.28' : '1'}">`
          + `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${highlight ? 5 : 3.5}" fill="${highlight ? '#c4b5fd' : '#8b5cf6'}" stroke="#0b1020" stroke-width="2"/>`
          + (d.total ? `<text x="${p.x.toFixed(1)}" y="${Math.max(12, p.y - 9).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="800" fill="${highlight ? '#ffffff' : '#9aa6bd'}">${d.total}</text>` : '')
          + `<text x="${p.x.toFixed(1)}" y="${H-6}" text-anchor="middle" font-size="10" font-weight="${highlight ? '800' : '600'}" fill="${highlight ? '#c4b5fd' : '#7c879d'}">${d.m}월</text>`
          + `</g>`;
      }).join('');
      const strips = monthlyData.map((d, i) => {
        const x = padL + i * (innerW / monthlyData.length) + 2;
        const w = Math.max(14, innerW / monthlyData.length - 5);
        const y = H - 25;
        if (!d.total) return `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="5" rx="3" fill="rgba(148,163,184,.18)"/>`;
        const kgmW = w * d.mKgm / d.total;
        const domW = w * d.mDom / d.total;
        const forW = w * d.mFor / d.total;
        const unW = Math.max(0, w - kgmW - domW - forW);
        let xx = x;
        const seg = (ww, color) => {
          const out = ww > 0 ? `<rect x="${xx.toFixed(1)}" y="${y}" width="${Math.max(1, ww).toFixed(1)}" height="5" rx="2" fill="${color}"/>` : '';
          xx += ww;
          return out;
        };
        return seg(kgmW, '#8b5cf6') + seg(domW, '#3b82f6') + seg(forW, '#f43f5e') + seg(unW, '#475569');
      }).join('');
      chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="monthly-ribbon-svg">`
        + `<defs><linearGradient id="monthlyRibbonArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity=".34"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity=".015"/></linearGradient><filter id="monthlyRibbonGlow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
        + `<line x1="${padL}" y1="${padT+innerH}" x2="${W-padR}" y2="${padT+innerH}" stroke="rgba(255,255,255,.08)"/>`
        + `<line x1="${padL}" y1="${padT+innerH/2}" x2="${W-padR}" y2="${padT+innerH/2}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3,5"/>`
        + `<path d="${areaPath}" fill="url(#monthlyRibbonArea)"/>`
        + `<path d="${linePath}" fill="none" stroke="#8b5cf6" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#monthlyRibbonGlow)"/>`
        + dots + strips + `</svg>`;
    }

    // 월별 테이블
    const tbody = document.getElementById('stats-tbody');
    if (!tbody) return;
    const curMonth2 = new Date().toISOString().slice(0,7);
    let rows = monthlyData.map(d=>{
      const isCur = d.prefix===curMonth2;
      const kgmPct = d.total>0 ? Math.round(d.mKgm/d.total*100)+'%' : '-';
      return `<tr style="${isCur ? 'background:rgba(139,92,246,0.06);' : ''}">
        <td style="font-weight:700;${isCur ? 'color:var(--accent);' : ''}">${d.m}월${isCur ? ' ◆' : ''}</td>
        <td><span style="color:var(--accent);font-weight:700;">${d.mKgm || '-'}</span></td>
        <td><span style="color:var(--blue);">${d.mDom || '-'}</span></td>
        <td><span style="color:var(--red);">${d.mFor || '-'}</span></td>
        <td style="color:var(--text-dim);">${d.mUn || '-'}</td>
        <td><span style="font-weight:800;font-size:14px;">${d.total || '-'}</span></td>
        <td><span style="color:var(--green);font-weight:600;">${d.mOut || '-'}</span></td>
        <td style="font-size:11px;color:var(--text-dim);">${kgmPct}</td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows;

    // 연간 합계 행
    const tfoot = document.getElementById('stats-tfoot');
    if(tfoot){
      const yPct = tTotal>0 ? Math.round(tKgm/tTotal*100)+'%' : '-';
      tfoot.innerHTML = `<tr style="background:rgba(139,92,246,0.08);border-top:2px solid var(--accent);">
        <td style="font-weight:900;color:var(--accent);font-size:13px;">연간 합계</td>
        <td style="font-weight:900;color:var(--accent);font-size:15px;">${tKgm}</td>
        <td style="font-weight:700;color:var(--blue);font-size:14px;">${tDom}</td>
        <td style="font-weight:700;color:var(--red);font-size:14px;">${tFor}</td>
        <td style="color:var(--text-dim);font-weight:600;">${tUn}</td>
        <td style="font-weight:900;font-size:16px;">${tTotal}</td>
        <td style="font-weight:700;color:var(--green);font-size:14px;">${tOut}</td>
        <td style="font-weight:700;color:var(--accent);">${yPct}</td>
      </tr>`;
    }

    // 비율 바 (선택 월/연간 기준)
    const bar = document.getElementById('stats-bar');
    if (bar && periodData.length > 0) {
      const kgmPct = Math.round(kgm.length/periodData.length*100);
      const domPct = Math.round(domestic.length/periodData.length*100);
      const forPct = Math.round(foreign.length/periodData.length*100);
      const unPct = 100 - kgmPct - domPct - forPct;
      bar.innerHTML = `
        <div style="display:flex;border-radius:8px;overflow:hidden;height:36px;margin-bottom:12px;">
          ${kgmPct ? `<div style="width:${kgmPct}%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#000;">KGM ${kgmPct}%</div>` : ''}
          ${domPct ? `<div style="width:${domPct}%;background:var(--blue);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#000;">국산 ${domPct}%</div>` : ''}
          ${forPct ? `<div style="width:${forPct}%;background:var(--red);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">외산 ${forPct}%</div>` : ''}
          ${unPct > 0 ? `<div style="width:${unPct}%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text-dim);">미분류</div>` : ''}
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--accent);">■ KGM ${kgm.length}대</span>
          <span style="font-size:12px;color:var(--blue);">■ 국산차 ${domestic.length}대</span>
          <span style="font-size:12px;color:var(--red);">■ 외산차 ${foreign.length}대</span>
          ${uncat.length ? `<span style="font-size:12px;color:var(--text-dim);">■ 미분류 ${uncat.length}대</span>` : ''}
        </div>`;
    } else if (bar) {
      bar.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:20px;">데이터가 없습니다</div>`;
    }
  }
  window.renderStats = renderStats;
  window.initYearSelect = initYearSelect;

  // 연도 셀렉트 초기화
  var _yearInitDone = false;
  function initYearSelect() {
    const list = getList();
    const years = new Set(list.map(r => (r.inDate||'').slice(0,4)).filter(y => y));
    years.add(new Date().getFullYear().toString());
    const sel = document.getElementById('statsYear');
    if (!sel) return;
    const prevVal = sel.value;
    const cur = new Date().getFullYear().toString();
    sel.innerHTML = [...years].sort().reverse().map(y => `<option value="${y}" ${y===cur?'selected':''}>${y}년</option>`).join('');
    // 사용자가 이미 연도를 선택했으면 보존
    if(prevVal && [...years].includes(prevVal)) sel.value = prevVal;
    // 최초 1회만 현재 월 자동 선택
    if(!_yearInitDone) {
      const mSel = document.getElementById('statsMonth');
      if(mSel) mSel.value = String(new Date().getMonth()+1).padStart(2,'0');
      _yearInitDone = true;
    }
  }

  // ---- 상세보기 ----
  window.openDetailModal = function(id) {
    const r = records[id];
    if (!r) return;
    const typeBadge = r.carType ? {
      'KGM': `<span style="background:rgba(245,166,35,0.15);color:var(--accent);padding:3px 12px;border-radius:20px;font-weight:700;font-size:13px;border:1px solid rgba(245,166,35,0.3);">KGM</span>`,
      '국산차': `<span style="background:rgba(75,156,255,0.15);color:var(--blue);padding:3px 12px;border-radius:20px;font-weight:700;font-size:13px;border:1px solid rgba(75,156,255,0.3);">국산차</span>`,
      '외산차': `<span style="background:rgba(232,68,42,0.15);color:var(--red);padding:3px 12px;border-radius:20px;font-weight:700;font-size:13px;border:1px solid rgba(232,68,42,0.3);">외산차</span>`,
    }[r.carType] || '-' : '-';

    document.getElementById('detailContent').innerHTML = `
      <div style="text-align:center;padding:16px 0 20px;border-bottom:1px solid var(--border);margin-bottom:20px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:900;color:var(--accent);margin-bottom:8px;">${esc(r.carNum)}</div>
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
          ${statusBadge(r.status)}
          ${typeBadge}
          ${r.location ? locationBadge(r.location, '') : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
        ${detailRow(' 차종', esc(r.carModel)||'-')}
        ${detailRow(' 연락처', esc(r.phone)||'-')}
        ${detailRow(' 입고일', esc(r.inDate)||'-')}
        ${detailRow(' 출고(예정)일', esc(r.outDate)||'-')}
        ${detailRow(' 주행거리', (esc(r.km) ? esc(r.km)+' km' : '-'))}
        ${detailRow(' 렌트카', esc(r.rent)||'-')}
        ${detailRow(' 대물보험', esc(r.insDaemul)||'-')}
        ${detailRow(' 자차보험', esc(r.insJacha)||'-')}
      </div>
      <div style="margin-top:16px;padding:14px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text-dim);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;"> 수리내용</div>
        <div style="font-size:13px;line-height:1.7;white-space:pre-wrap;">${esc(r.repair)||'-'}</div>
      </div>
      ${r.memo ? `<div style="margin-top:10px;padding:12px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);"><div style="font-size:11px;color:var(--text-dim);font-weight:600;margin-bottom:6px;"> 메모</div><div style="font-size:13px;">${esc(r.memo)}</div></div>` : ''}
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" onclick="window._openPhotoModal('${esc(id)}','intake')"> 입고사진 ${photoCountBadge(r,'intake')}</button>
        <button class="btn btn-ghost btn-sm" onclick="window._openPhotoModal('${esc(id)}','outbound')"> 출고사진 ${photoCountBadge(r,'outbound')}</button>
        <button class="btn btn-primary btn-sm" onclick="window._openWorkOrder('${esc(id)}')"> 작업지시서 인쇄</button>
      </div>
    `;
    document.getElementById('detailModal').classList.add('open');
  };

  // 사진 개수 배지 (입고/출고 버튼 옆에 작게 표시)
  function photoCountBadge(r, stage) {
    var arr = (r && r.photos && r.photos[stage]) || [];
    if (!arr.length) return '';
    return '<span style="background:rgba(139,92,246,0.18);color:var(--accent);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-left:4px;">' + arr.length + '</span>';
  }

  function detailRow(label, val) {
    return `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:3px;">${label}</div>
        <div style="font-size:13px;font-weight:500;">${val}</div>
      </div>`;
  }

  window.fixMissingOutDates = async function() {
    const list = getList();
    const missing = list.filter(r => r.status === '출고' && !r.outDate);
    if (!missing.length) { showNotif('보정할 차량이 없어요 '); return; }
    if (!confirm(`출고일이 없는 차량 ${missing.length}대를 오늘 날짜로 보정할까요?`)) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      for (const r of missing) {
        await update(ref(db, `records/${r.id}`), { outDate: today });
      }
      showNotif(`${missing.length}대 보정 완료! `);
    } catch(e) { showNotif('보정 실패', true); }
  };

  // ---- NOTIF ----
  function showNotif(msg, isError) {
    const n = document.getElementById('notif');
    n.textContent = msg;
    n.style.background = isError ? 'var(--red)' : 'var(--green)';
    n.style.color = isError ? '#fff' : '#000';
    n.classList.add('show');
    setTimeout(()=>n.classList.remove('show'), 2800);
  }
  window.showNotif = showNotif;

  // expose renderList for search input
  window.renderList = renderList;
  window.renderDashboard = renderDashboard;

  // ---- 견적도우미 연동 ----
  // 현재 견적 연동 중인 차량 레코드 ID
  window._estimateLinkedRecordId = null;

  // 저장 후 견적도우미로 이동
  window.saveAndGoEstimate = async function() {
    const data = collectFormData();
    if (!data) return;

    const btn = document.getElementById('saveAndEstimateBtn');
    btn.disabled = true; btn.textContent = '저장 중...';

    try {
      let recordId;
      if (editingId) {
        await update(ref(db, `records/${editingId}`), data);
        recordId = editingId;
        showNotif(`${data.carNum} 저장 완료 → 견적도우미로 이동합니다 `);
      } else {
        data.createdAt = new Date().toISOString();
        const newRef = await push(recordsRef, data);
        recordId = newRef.key;
        showNotif(`${data.carNum} 등록 완료 → 견적도우미로 이동합니다 `);
      }
      closeModal();
      window._estimateLinkedRecordId = recordId;
      window._estimateLinkedCarNum = data.carNum;
      window._estimateLinkedCarType = data.carType;
      switchPage('estimate');
      showEstimateLinkedBanner(data.carNum, recordId);
    } catch(e) {
      showNotif('저장 실패: ' + e.message, true);
    }
    btn.disabled = false; btn.textContent = ' 저장 후 견적도우미';
  };

  // 대시보드에서 바로 견적도우미로 이동
  window.goEstimateForRecord = function(id) {
    const r = records[id];
    if (!r) return;
    window._estimateLinkedRecordId = id;
    window._estimateLinkedCarNum = r.carNum;
    window._estimateLinkedCarType = r.carType;
    switchPage('estimate');
    showEstimateLinkedBanner(r.carNum, id);
  };

  // 견적도우미 연동 배너 표시
  function showEstimateLinkedBanner(carNum, recordId) {
    let banner = document.getElementById('estimateLinkedBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'estimateLinkedBanner';
      banner.style.cssText = 'padding:10px 18px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:10px;margin:10px 14px 0;display:flex;align-items:center;gap:10px;font-size:13px;';
      const estPage = document.getElementById('page-estimate');
      if (estPage) estPage.insertBefore(banner, estPage.firstChild);
    }
    banner.innerHTML = `<span style="font-weight:700;color:var(--accent);">${carNum}</span><span style="color:var(--text-dim);">차량 견적 작성 중</span><button onclick="clearEstimateLink()" style="margin-left:auto;background:none;border:1px solid rgba(139,92,246,0.3);color:var(--text-dim);border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;">연동 해제</button>`;
    banner.style.display = 'flex';
  }

  window.clearEstimateLink = function() {
    window._estimateLinkedRecordId = null;
    window._estimateLinkedCarNum = null;
    window._estimateLinkedCarType = null;
    const banner = document.getElementById('estimateLinkedBanner');
    if (banner) banner.style.display = 'none';
  };

  // 견적서 팝업 보기 (대시보드에서)
  window.showEstimatePopup = async function(estimateId) {
    if (!window.fsLoadEst) { showNotif('Firestore 연결 대기', true); return; }
    if (typeof EBC === 'undefined') { showNotif('견적 데이터 로딩 중입니다. 잠시 후 다시 시도해주세요.', true); return; }
    try {
      const estimates = await window.fsLoadEst();
      const est = estimates.find(e => e.id === estimateId);
      if (!est) { showNotif('견적서를 찾을 수 없습니다', true); return; }
      // 견적서 팝업 생성 (printModal과 동일한 형식)
      const items = est.items || [];
      const pm = est.priceMode === 'i' ? '보험' : '일반';
      let tp = 0, tc = 0, n = 0;
      let rows = '';
      items.forEach(function(item) {
        const part = item.description || item.label || '';
        (item.codes || []).forEach(function(c) {
          const p = typeof c.price === 'number' ? c.price : (function(){ var r=EBC[c.code]; if(!r) return 0; return est.priceMode==='i'?r.pi:r.p; })();
          if (p > 0) tp += p; tc++; n++;
          const dr = EBC[c.code] || {};
          rows += '<tr>'
            + '<td style="text-align:center;color:#666;">' + n + '</td>'
            + '<td style="font-size:11px;color:#888;">' + part + '</td>'
            + '<td style="font-family:monospace;font-weight:600;">' + (c.code || '') + '</td>'
            + '<td>' + (c.name || dr.n || '') + '</td>'
            + '<td style="text-align:center;color:#666;">' + (c.type || dr.t || '') + '</td>'
            + '<td style="text-align:right;font-family:monospace;font-weight:700;">' + (p > 0 ? p.toLocaleString() + '원' : '-') + '</td>'
            + '</tr>';
        });
      });
      // 차량 정보
      const v = est.vehicle || {};
      const html = '<div style="text-align:center;margin-bottom:24px;">'
        + '<div style="font-size:22px;font-weight:900;letter-spacing:2px;margin-bottom:4px;">KGM SEONGSU</div>'
        + '<div style="font-size:11px;color:#888;letter-spacing:3px;">SERVICE CENTER · 공임 견적서</div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;margin-bottom:16px;padding:10px 14px;background:#f8f8f8;border-radius:8px;font-size:12px;">'
        + '<span>발행일: ' + (est.date || '-') + '</span>'
        + '<span>구분: ' + pm + '</span>'
        + '<span>항목: ' + items.length + '건 / 코드: ' + tc + '개</span>'
        + '</div>'
        + (v.plate || v.model ? '<div style="margin-bottom:16px;padding:10px 14px;background:#f0f0ff;border-radius:8px;font-size:12px;display:flex;gap:20px;">'
          + (v.plate ? '<span>차량: ' + v.plate + '</span>' : '')
          + (v.model ? '<span>차종: ' + v.model + '</span>' : '')
          + (v.year ? '<span>연식: ' + v.year + '</span>' : '')
          + '</div>' : '')
        + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
        + '<thead><tr style="background:#f0f0f0;border-bottom:2px solid #333;">'
        + '<th style="padding:8px 6px;text-align:center;width:30px;">#</th>'
        + '<th style="padding:8px 6px;text-align:left;width:80px;">부위</th>'
        + '<th style="padding:8px 6px;text-align:left;width:90px;">코드</th>'
        + '<th style="padding:8px 6px;text-align:left;">작업명</th>'
        + '<th style="padding:8px 6px;text-align:center;width:55px;">분류</th>'
        + '<th style="padding:8px 6px;text-align:right;width:90px;">공임</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '<tfoot><tr style="border-top:2px solid #333;background:#f8f0ff;">'
        + '<td colspan="5" style="padding:10px;font-weight:900;font-size:14px;text-align:right;">공임 합계</td>'
        + '<td style="padding:10px;font-weight:900;font-size:16px;text-align:right;color:#6d28d9;">₩' + (est.totalPrice || tp).toLocaleString() + '</td>'
        + '</tr></tfoot>'
        + '</table>'
        + '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:10px;color:#aaa;">'
        + '<span>KGM 성수서비스센터 · UN Motors</span>'
        + '<span>본 견적서는 공임만 포함하며 부품대는 별도입니다</span>'
        + '</div>';
      document.getElementById('printContent').innerHTML = html;
      document.getElementById('printModal').style.display = 'block';
    } catch(e) {
      showNotif('견적서 로딩 실패: ' + e.message, true);
    }
  };

  window._renderComplete = renderComplete;
  window._renderList = renderList;
  window._renderOut = renderOut;
  window._renderStats = renderStats;
  window._initYearSelect = initYearSelect;

  // ---- LEAVE MANAGEMENT ----
  const leaveEmpRef = ref(db, 'leaveEmployees');
  const leaveUseRef = ref(db, 'leaveUsage');
  let leaveEmployees = {};
  let leaveUsage = {};
  let editingLeaveEmpId = null;

  onValue(leaveEmpRef, (snap) => { leaveEmployees = snap.val() || {}; try { renderLeave(); } catch(e) { console.error(e); } try { if(window._renderCalendar) window._renderCalendar(); } catch(e) {} try { if(window._renderMyRequests) window._renderMyRequests(); if(window._renderApprovalQueue) window._renderApprovalQueue(); } catch(e) {} try { if(window._renderOrgChart) window._renderOrgChart(); } catch(e) {} try { if(window._renderNotices) window._renderNotices(); } catch(e) {} });
  onValue(leaveUseRef, (snap) => { leaveUsage = snap.val() || {}; try { renderLeave(); } catch(e) { console.error(e); } try { if(window._renderCalendar) window._renderCalendar(); } catch(e) {} });

  // 총 사용 시간 (시간 단위로 통합 계산, 1일=8시간)
  function getLeaveUsedHours(empId) {
    return Object.values(leaveUsage).filter(u => u.empId === empId).reduce((sum, u) => {
      if (u.type === '\uc5f0\ucc28') return sum + 8;
      if (u.type === '\uc624\uc804\ubc18\ucc28' || u.type === '\uc624\ud6c4\ubc18\ucc28') return sum + 4;
      if (u.type === '\uc870\ud1f4' || u.type === '\uc678\ucd9c') return sum + (parseInt(u.hours) || 0);
      return sum;
    }, 0);
  }
  // 시간을 "X일 반차" 또는 "X일 Y시간" 형태로 변환
  function formatDayHour(hours) {
    var d = Math.floor(hours / 8);
    var h = hours % 8;
    if (d > 0 && h === 4) return d + '\uc77c \ubc18\ucc28';
    if (d > 0 && h > 0) return d + '\uc77c ' + h + '\uc2dc\uac04';
    if (d > 0) return d + '\uc77c';
    if (h === 4) return '\ubc18\ucc28';
    if (h > 0) return h + '\uc2dc\uac04';
    return '0\uc77c';
  }
  // 입사일 기반 연차 자동 계산
  function calcTotalLeave(hireDate) {
    if (!hireDate) return 15;
    var hire = new Date(hireDate);
    var now = new Date();
    var diffMs = now - hire;
    var diffMonths = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
    if (now.getDate() < hire.getDate()) diffMonths--;
    if (diffMonths < 0) return 0;
    if (diffMonths < 12) return diffMonths; // 1년 미만: 매월 1개
    // 1년 이상: 15일 기본 + 3년차부터 매 2년마다 +1일 (최대 25일)
    var years = Math.floor(diffMonths / 12);
    var extra = years >= 3 ? Math.floor((years - 1) / 2) : 0;
    return Math.min(15 + extra, 25);
  }
  function formatHireInfo(hireDate) {
    if (!hireDate) return '-';
    var hire = new Date(hireDate);
    var now = new Date();
    var diffMonths = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
    if (now.getDate() < hire.getDate()) diffMonths--;
    var years = Math.floor(diffMonths / 12);
    var months = diffMonths % 12;
    if (years > 0 && months > 0) return years + '\ub144 ' + months + '\uac1c\uc6d4';
    if (years > 0) return years + '\ub144';
    if (months > 0) return months + '\uac1c\uc6d4';
    return '\uc2e0\uaddc';
  }
  function getHalfDayCount(empId) {
    return Object.values(leaveUsage).filter(u => u.empId === empId && (u.type === '\uc624\uc804\ubc18\ucc28' || u.type === '\uc624\ud6c4\ubc18\ucc28')).length;
  }
  function getEtcCount(empId) {
    return Object.values(leaveUsage).filter(u => u.empId === empId && (u.type === '\uc870\ud1f4' || u.type === '\uc678\ucd9c')).length;
  }
  function getYearLeaveCount(empId) {
    return Object.values(leaveUsage).filter(u => u.empId === empId && u.type === '\uc5f0\ucc28').length;
  }

  function renderLeave() {
    var isAdmin = window._userRole === 'admin';
    var myEmail = (window._userEmail || '').toLowerCase();
    var myName = window._userName || '';

    document.querySelectorAll('.leave-admin-only').forEach(function(el){ el.style.display = isAdmin ? '' : 'none'; });

    var allEmpList = Object.entries(leaveEmployees).map(function(e) { return {id:e[0], name:e[1].name, totalLeave:e[1].totalLeave, hireDate:e[1].hireDate, email:e[1].email||''}; });
    var empList = isAdmin ? allEmpList : allEmpList.filter(function(emp) {
      if (emp.email && emp.email.toLowerCase() === myEmail) return true;
      if (!emp.email && emp.name && emp.name === myName) return true;
      return false;
    });

    var empTbody = document.getElementById('leave-emp-tbody');
    var empEmpty = document.getElementById('leave-emp-empty');
    if (!empTbody) return;
    if (!empList.length) {
      empTbody.innerHTML='';
      empEmpty.style.display='block';
      var msgEl = empEmpty.querySelector('div:last-child');
      if (msgEl) msgEl.textContent = isAdmin ? '\ub4f1\ub85d\ub41c \uc9c1\uc6d0\uc774 \uc5c6\uc2b5\ub2c8\ub2e4. \uc9c1\uc6d0\uc744 \ucd94\uac00\ud574\uc8fc\uc138\uc694.' : '\ubcf8\uc778 \uc815\ubcf4\uac00 \ub4f1\ub85d\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4. \uad00\ub9ac\uc790\uc5d0\uac8c \ubb38\uc758\ud574\uc8fc\uc138\uc694.';
    }
    else {
      empEmpty.style.display='none';
      empTbody.innerHTML = empList.map(function(emp) {
        var autoTotal = emp.hireDate ? calcTotalLeave(emp.hireDate) : (emp.totalLeave||15);
        var totalHours = autoTotal * 8;
        var usedHours = getLeaveUsedHours(emp.id);
        var remainHours = totalHours - usedHours;
        var yearCount = getYearLeaveCount(emp.id);
        var halfCount = getHalfDayCount(emp.id);
        var etcCount = getEtcCount(emp.id);
        var remainColor = remainHours <= 24 ? 'var(--red)' : 'var(--green)';
        var hireDateStr = emp.hireDate ? emp.hireDate : '-';
        var tenureStr = emp.hireDate ? formatHireInfo(emp.hireDate) : '-';
        var manageCell = isAdmin ? ('<td><div style="display:flex;gap:5px;"><button class="btn btn-ghost btn-sm" onclick="window._editLeaveEmp(\''+esc(emp.id)+'\')">\uc218\uc815</button><button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);" onclick="window._deleteLeaveEmp(\''+esc(emp.id)+'\',\''+esc(emp.name)+'\')">\uc0ad\uc81c</button></div></td>') : '';
        return '<tr><td><strong>'+esc(emp.name)+'</strong></td><td style="font-size:12px;">'+esc(hireDateStr)+'</td><td style="font-size:12px;">'+tenureStr+'</td><td>'+autoTotal+'\uc77c</td><td style="color:var(--accent);font-weight:600;">'+formatDayHour(usedHours)+'</td><td style="color:'+remainColor+';font-weight:700;">'+formatDayHour(Math.max(0,remainHours))+'</td><td>'+yearCount+'\ud68c</td><td>'+halfCount+'\ud68c</td><td>'+etcCount+'\ud68c</td>'+manageCell+'</tr>';
      }).join('');
    }
    var filterSel = document.getElementById('leaveFilterEmp');
    var useSel = document.getElementById('lu-emp');
    if (filterSel) { var pv=filterSel.value; filterSel.innerHTML='<option value="">\uc804\uccb4 \uc9c1\uc6d0</option>'+empList.map(function(e){return '<option value="'+e.id+'">'+esc(e.name)+'</option>';}).join(''); if(pv) filterSel.value=pv; }
    if (useSel) { var pv2=useSel.value; useSel.innerHTML='<option value="">\uc9c1\uc6d0 \uc120\ud0dd</option>'+allEmpList.map(function(e){return '<option value="'+e.id+'">'+esc(e.name)+'</option>';}).join(''); if(pv2) useSel.value=pv2; }
    var filterEmp = filterSel ? filterSel.value : '';
    var filterMonth = (document.getElementById('leaveFilterMonth')||{}).value || '';
    var useList = Object.entries(leaveUsage).map(function(e){return {id:e[0],empId:e[1].empId,type:e[1].type,date:e[1].date,reason:e[1].reason,createdAt:e[1].createdAt};});
    if (!isAdmin) {
      var myEmpIds = empList.map(function(e){return e.id;});
      useList = useList.filter(function(u){return myEmpIds.indexOf(u.empId)!==-1;});
    } else if (filterEmp) {
      useList = useList.filter(function(u){return u.empId===filterEmp;});
    }
    if (filterMonth) useList = useList.filter(function(u){return (u.date||'').startsWith(filterMonth);});
    useList.sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    var useTbody = document.getElementById('leave-use-tbody');
    var useEmpty = document.getElementById('leave-use-empty');
    if (!useTbody) return;
    if (!useList.length) { useTbody.innerHTML=''; useEmpty.style.display='block'; }
    else {
      useEmpty.style.display='none';
      useTbody.innerHTML = useList.map(function(u) {
        var empName = leaveEmployees[u.empId] ? leaveEmployees[u.empId].name : '(삭제됨)';
        var typeBadge;
        if (u.type==='\uc5f0\ucc28') typeBadge='<span style="background:rgba(75,156,255,0.15);color:var(--blue);padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;">\uc5f0\ucc28</span>';
        else if (u.type==='\uc870\ud1f4') typeBadge='<span style="background:rgba(232,68,42,0.15);color:var(--red);padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;">\uc870\ud1f4 '+(u.hours||'')+'h</span>';
        else if (u.type==='\uc678\ucd9c') typeBadge='<span style="background:rgba(139,92,246,0.15);color:var(--accent);padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;">\uc678\ucd9c '+(u.hours||'')+'h</span>';
        else typeBadge='<span style="background:rgba(251,146,60,0.15);color:#fb923c;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;">'+esc(u.type)+'</span>';
        var deleteCell = isAdmin ? ('<td><button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);" onclick="window._deleteLeaveUse(\''+esc(u.id)+'\')">\uc0ad\uc81c</button></td>') : '';
        return '<tr><td>'+esc(empName)+'</td><td>'+typeBadge+'</td><td>'+esc(u.date||'-')+'</td><td>'+esc(u.reason||'-')+'</td><td style="font-size:11px;color:var(--text-dim);">'+esc((u.createdAt||'').split('T')[0])+'</td>'+deleteCell+'</tr>';
      }).join('');
    }
    try { if(window._renderMyRequests) window._renderMyRequests(); if(window._renderApprovalQueue) window._renderApprovalQueue(); } catch(e) { console.error(e); }
    try { if(window._renderNotices) window._renderNotices(); } catch(e) { console.error(e); }
  }
  window._renderLeave = renderLeave;

  // ---- BOARD (게시판) ----
  const boardRef = ref(db, 'board');
  let boardPosts = {};

  onValue(boardRef, (snap) => { boardPosts = snap.val() || {}; try { renderBoard(); } catch(e) { console.error(e); } });

  function renderBoard() {
    var list = Object.entries(boardPosts).map(function(e) { return {id:e[0], text:e[1].text, author:e[1].author, authorEmail:e[1].authorEmail, createdAt:e[1].createdAt}; });
    list.sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var container = document.getElementById('board-list');
    var empty = document.getElementById('board-empty');
    if (!container) return;
    if (!list.length) { container.innerHTML=''; empty.style.display='block'; return; }
    empty.style.display='none';
    container.innerHTML = list.map(function(p) {
      var date = p.createdAt ? new Date(p.createdAt) : new Date();
      var dateStr = date.getFullYear()+'.'+String(date.getMonth()+1).padStart(2,'0')+'.'+String(date.getDate()).padStart(2,'0')+' '+String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
      var isMe = window._userEmail === p.authorEmail;
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px;">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
        +'<div style="display:flex;align-items:center;gap:8px;">'
        +'<span style="background:rgba(139,92,246,0.15);color:var(--accent);padding:2px 10px;border-radius:6px;font-size:11px;font-weight:700;">'+esc(p.author||'')+'</span>'
        +'<span style="font-size:11px;color:var(--text-dim);">'+dateStr+'</span>'
        +'</div>'
        +(isMe ? '<button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);font-size:10px;" onclick="window._deleteBoard(\''+esc(p.id)+'\')">삭제</button>' : '')
        +'</div>'
        +'<div style="font-size:13px;color:var(--text);white-space:pre-wrap;line-height:1.7;">'+esc(p.text)+'</div>'
        +'</div>';
    }).join('');
  }
  window._renderBoard = renderBoard;

  window._postBoard = async function() {
    var text = document.getElementById('board-input').value.trim();
    if (!text) { showNotif('\uba54\ubaa8\ub97c \uc785\ub825\ud574\uc8fc\uc138\uc694', true); return; }
    try {
      await push(boardRef, {
        text: text,
        author: window._userName || '',
        authorEmail: window._userEmail || '',
        createdAt: new Date().toISOString()
      });
      document.getElementById('board-input').value = '';
      showNotif('\uba54\ubaa8\uac00 \ub4f1\ub85d\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
    } catch(e) { showNotif('\ub4f1\ub85d \uc2e4\ud328: ' + e.message, true); }
  };

  window._deleteBoard = async function(id) {
    if (!confirm('\uc774 \uba54\ubaa8\ub97c \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?')) return;
    try { await remove(ref(db, 'board/' + id)); showNotif('\uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4'); }
    catch(e) { showNotif('\uc0ad\uc81c \uc2e4\ud328: ' + e.message, true); }
  };

  // ---- BOARD NOTICES (\uac8c\uc2dc\ud310 \uacf5\uc9c0\uc0ac\ud56d) ----
  // \u26a0 leave \ubaa8\ub4c8\uc758 noticesRef/renderNotices/editingNoticeId\uc640 \ucda9\ub3cc \ubc29\uc9c0 \uc704\ud574 board \ud504\ub9ac\ud53d\uc2a4 \ud544\uc218
  const boardNoticesRef = ref(db, 'notices');
  let boardNoticesMap = {};
  let editingBoardNoticeId = null;

  onValue(boardNoticesRef, (snap) => {
    boardNoticesMap = snap.val() || {};
    try { renderBoardNotices(); } catch(e) { console.error('renderBoardNotices', e); }
    if (window._userEmail) setTimeout(maybeShowImportantBoardNotice, 300);
  }, (err) => { console.warn('boardNotices subscribe', err); });

  function renderBoardNotices() {
    const list = document.getElementById('notice-list');
    const empty = document.getElementById('notice-empty');
    if (!list) return;
    const isAdmin = window._userRole === 'admin';
    document.querySelectorAll('.notice-admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });
    const entries = Object.entries(boardNoticesMap).map(e => Object.assign({ id: e[0] }, e[1]));
    entries.sort((a, b) => {
      if (!!a.important !== !!b.important) return a.important ? -1 : 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    if (!entries.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    list.innerHTML = entries.map(n => {
      const dateStr = (n.createdAt || '').slice(0, 10);
      const updated = n.updatedAt && n.updatedAt !== n.createdAt
        ? ' \u00b7 \uc218\uc815 ' + n.updatedAt.slice(0, 10)
        : '';
      const pin = n.important
        ? '<span class="notice-pin">\ud83d\udccc \uc911\uc694</span>'
        : '';
      const adminBtns = isAdmin
        ? '<div class="notice-actions">'
          + '<button onclick="window._openBoardNoticeModal(\'' + esc(n.id) + '\')">\uc218\uc815</button>'
          + '<button onclick="window._deleteBoardNotice(\'' + esc(n.id) + '\')">\uc0ad\uc81c</button>'
          + '</div>'
        : '';
      return '<div class="notice-card' + (n.important ? ' notice-important' : '') + '">'
        + '<div class="notice-head">'
        + pin
        + '<div class="notice-title">' + esc(n.title || '') + '</div>'
        + adminBtns
        + '</div>'
        + '<div class="notice-meta">' + esc(n.createdByName || '') + ' \u00b7 ' + esc(dateStr) + esc(updated) + '</div>'
        + '<div class="notice-body">' + esc(n.body || '') + '</div>'
        + '</div>';
    }).join('');
  }
  window._renderBoardNotices = renderBoardNotices;

  window._openBoardNoticeModal = function(id) {
    if (window._userRole !== 'admin') return;
    editingBoardNoticeId = id || null;
    const titleEl = document.getElementById('notice-title');
    const bodyEl  = document.getElementById('notice-body');
    const impEl   = document.getElementById('notice-important');
    const mt      = document.getElementById('noticeModalTitle');
    if (id && boardNoticesMap[id]) {
      const n = boardNoticesMap[id];
      titleEl.value = n.title || '';
      bodyEl.value  = n.body || '';
      impEl.checked = !!n.important;
      if (mt) mt.textContent = '\uacf5\uc9c0 \uc218\uc815';
    } else {
      titleEl.value = '';
      bodyEl.value  = '';
      impEl.checked = false;
      if (mt) mt.textContent = '\uc0c8 \uacf5\uc9c0 \uc791\uc131';
    }
    document.getElementById('noticeModal').classList.add('open');
    setTimeout(() => titleEl.focus(), 50);
  };

  window._closeBoardNoticeModal = function() {
    document.getElementById('noticeModal').classList.remove('open');
    editingBoardNoticeId = null;
  };

  window._saveBoardNotice = async function() {
    if (window._userRole !== 'admin') return;
    const title = String(document.getElementById('notice-title').value || '').trim();
    const body  = String(document.getElementById('notice-body').value || '').trim();
    const important = document.getElementById('notice-important').checked;
    if (!title || !body) { showNotif('\uc81c\ubaa9\uacfc \ub0b4\uc6a9\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694', true); return; }
    if (title.length > 80)   { showNotif('\uc81c\ubaa9\uc740 80\uc790 \uc774\ub0b4', true); return; }
    if (body.length > 2000)  { showNotif('\ub0b4\uc6a9\uc740 2000\uc790 \uc774\ub0b4', true); return; }
    const now = new Date().toISOString();
    try {
      if (editingBoardNoticeId) {
        await update(ref(db, 'notices/' + editingBoardNoticeId), {
          title: title, body: body, important: !!important, updatedAt: now
        });
        showNotif('\uacf5\uc9c0\ub97c \uc218\uc815\ud588\uc2b5\ub2c8\ub2e4');
      } else {
        const newRef = push(boardNoticesRef);
        await update(newRef, {
          title: title, body: body, important: !!important,
          createdAt: now,
          createdBy: window._userEmail || '',
          createdByName: window._userName || ''
        });
        showNotif('\uacf5\uc9c0\ub97c \uc791\uc131\ud588\uc2b5\ub2c8\ub2e4');
      }
      window._closeBoardNoticeModal();
    } catch(e) {
      console.error('boardNotice save', e);
      showNotif('\uc800\uc7a5 \uc2e4\ud328: ' + (e.message || e), true);
    }
  };

  window._deleteBoardNotice = async function(id) {
    if (window._userRole !== 'admin') return;
    if (!confirm('\uc774 \uacf5\uc9c0\ub97c \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?')) return;
    try {
      await remove(ref(db, 'notices/' + id));
      showNotif('\uacf5\uc9c0\ub97c \uc0ad\uc81c\ud588\uc2b5\ub2c8\ub2e4');
    } catch(e) {
      console.error('boardNotice delete', e);
      showNotif('\uc0ad\uc81c \uc2e4\ud328: ' + (e.message || e), true);
    }
  };

  function maybeShowImportantBoardNotice() {
    if (!window._userEmail) return;
    const popup = document.getElementById('noticePopupModal');
    if (!popup) return;
    if (popup.classList.contains('open')) return;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem('seenNoticeIds') || '[]') || []; } catch(_) {}
    const candidates = Object.entries(boardNoticesMap)
      .map(e => Object.assign({ id: e[0] }, e[1]))
      .filter(n => n.important && !seen.includes(n.id))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (!candidates.length) return;
    const n = candidates[0];
    const t = document.getElementById('noticePopupTitle');
    const m = document.getElementById('noticePopupMeta');
    const b = document.getElementById('noticePopupBody');
    if (t) t.textContent = n.title || '\uacf5\uc9c0';
    if (m) m.textContent = (n.createdByName || '') + ' \u00b7 ' + (n.createdAt || '').slice(0, 10);
    if (b) b.textContent = n.body || '';
    popup.setAttribute('data-notice-id', n.id);
    popup.classList.add('open');
  }
  window._maybeShowImportantBoardNotice = maybeShowImportantBoardNotice;

  window._closeBoardNoticePopup = function(markSeen) {
    const popup = document.getElementById('noticePopupModal');
    if (!popup) return;
    if (markSeen) {
      const id = popup.getAttribute('data-notice-id');
      if (id) {
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem('seenNoticeIds') || '[]') || []; } catch(_) {}
        if (!seen.includes(id)) seen.push(id);
        seen = seen.slice(-100);
        try { localStorage.setItem('seenNoticeIds', JSON.stringify(seen)); } catch(_) {}
      }
    }
    popup.classList.remove('open');
  };

  // ---- COMPANY EVENTS / CALENDAR ----
  const companyEventsRef = ref(db, 'companyEvents');
  let companyEvents = {};
  let calCursor = new Date(); calCursor.setDate(1);
  let editingEventId = null;

  onValue(companyEventsRef, (snap) => { companyEvents = snap.val() || {}; try { renderCalendar(); } catch(e) { console.error(e); } });

  function leaveTypeColor(t) {
    if (t==='\uc5f0\ucc28') return 'var(--blue)';
    if (t==='\uc870\ud1f4') return 'var(--red)';
    if (t==='\uc678\ucd9c') return 'var(--accent)';
    return '#fb923c';
  }
  function leaveTypeBg(t) {
    if (t==='\uc5f0\ucc28') return 'rgba(75,156,255,0.15)';
    if (t==='\uc870\ud1f4') return 'rgba(232,68,42,0.15)';
    if (t==='\uc678\ucd9c') return 'rgba(139,92,246,0.15)';
    return 'rgba(251,146,60,0.15)';
  }

  function renderCalendar() {
    var year = calCursor.getFullYear();
    var month = calCursor.getMonth();
    var titleEl = document.getElementById('cal-title');
    if (titleEl) titleEl.textContent = year + '\ub144 ' + (month+1) + '\uc6d4';

    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month+1, 0);
    var startDow = firstDay.getDay();
    var daysInMonth = lastDay.getDate();
    var todayD = new Date();
    var todayStr = todayD.getFullYear()+'-'+String(todayD.getMonth()+1).padStart(2,'0')+'-'+String(todayD.getDate()).padStart(2,'0');

    var grid = document.getElementById('cal-grid');
    if (!grid) return;

    var html = '';
    for (var i=0; i<startDow; i++) html += '<div class="cal-cell empty"></div>';
    for (var d=1; d<=daysInMonth; d++) {
      var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var isToday = dateStr === todayStr;
      var dow = (startDow + d - 1) % 7;
      var dateColor = dow===0 ? 'var(--red)' : (dow===6 ? 'var(--blue)' : 'var(--text)');

      var dayEvents = Object.entries(companyEvents).filter(function(e){ return e[1] && e[1].date === dateStr; });
      var dayLeaves = Object.entries(leaveUsage).filter(function(e){ return e[1] && e[1].date === dateStr; });

      var ind = '';
      var shown = 0;
      for (var k=0; k<dayEvents.length && shown<2; k++,shown++) {
        ind += '<div class="cal-event" title="'+esc(dayEvents[k][1].title||'')+'">'+esc(dayEvents[k][1].title||'')+'</div>';
      }
      for (var k2=0; k2<dayLeaves.length && shown<3; k2++,shown++) {
        var u = dayLeaves[k2][1];
        var emp = leaveEmployees[u.empId];
        var nm = emp ? emp.name : '?';
        ind += '<div class="cal-leave" style="color:'+leaveTypeColor(u.type)+';background:'+leaveTypeBg(u.type)+'" title="'+esc(nm)+' '+esc(u.type)+'">'+esc(nm)+' '+esc(u.type)+'</div>';
      }
      var totalCount = dayEvents.length + dayLeaves.length;
      if (totalCount > shown) ind += '<div class="cal-more">+'+(totalCount-shown)+' \ub354\ubcf4\uae30</div>';

      html += '<div class="cal-cell '+(isToday?'today':'')+'" onclick="window._openDateDetail(\''+dateStr+'\')"><div class="cal-date" style="'+(isToday?'':'color:'+dateColor)+'">'+d+'</div>'+ind+'</div>';
    }
    grid.innerHTML = html;

    var isAdmin = window._userRole === 'admin';
    document.querySelectorAll('.cal-admin-only').forEach(function(el){ el.style.display = isAdmin ? '' : 'none'; });
  }
  window._renderCalendar = renderCalendar;

  window._calPrev = function(){ calCursor.setMonth(calCursor.getMonth()-1); renderCalendar(); };
  window._calNext = function(){ calCursor.setMonth(calCursor.getMonth()+1); renderCalendar(); };
  window._calToday = function(){ calCursor = new Date(); calCursor.setDate(1); renderCalendar(); };

  window._setBoardView = function(view) {
    var calSec = document.getElementById('cal-section');
    var bdSec = document.getElementById('board-section');
    ['cal','board','all'].forEach(function(v){
      var b = document.getElementById('bv-'+v);
      if (b) b.classList.remove('active');
    });
    var key = view==='calendar' ? 'cal' : (view==='board' ? 'board' : 'all');
    var ab = document.getElementById('bv-'+key);
    if (ab) ab.classList.add('active');
    if (calSec) calSec.style.display = (view==='board') ? 'none' : '';
    if (bdSec) bdSec.style.display = (view==='calendar') ? 'none' : '';
  };

  window._openEventModal = function(date) {
    if (window._userRole !== 'admin') return;
    editingEventId = null;
    document.getElementById('eventModalTitle').textContent = '\uc77c\uc815 \ucd94\uac00';
    var defaultDate = (typeof date === 'string' && date) ? date : (new Date().toISOString().split('T')[0]);
    document.getElementById('ev-date').value = defaultDate;
    document.getElementById('ev-title').value = '';
    document.getElementById('ev-desc').value = '';
    document.getElementById('eventModal').classList.add('open');
  };
  window._editEvent = function(id) {
    if (window._userRole !== 'admin') return;
    var e = companyEvents[id]; if (!e) return;
    editingEventId = id;
    document.getElementById('eventModalTitle').textContent = '\uc77c\uc815 \uc218\uc815';
    document.getElementById('ev-date').value = e.date || '';
    document.getElementById('ev-title').value = e.title || '';
    document.getElementById('ev-desc').value = e.description || '';
    document.getElementById('eventModal').classList.add('open');
  };
  window._saveEvent = async function() {
    var title = document.getElementById('ev-title').value.trim();
    var date = document.getElementById('ev-date').value;
    var desc = document.getElementById('ev-desc').value.trim();
    if (!title) { showNotif('\uc81c\ubaa9\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694', true); return; }
    if (!date) { showNotif('\ub0a0\uc9dc\ub97c \uc120\ud0dd\ud574\uc8fc\uc138\uc694', true); return; }
    var btn = document.getElementById('eventSaveBtn');
    btn.disabled = true; btn.textContent = '\uc800\uc7a5 \uc911...';
    try {
      var data = { title: title, date: date, description: desc, updatedAt: new Date().toISOString() };
      if (editingEventId) {
        await update(ref(db, 'companyEvents/' + editingEventId), data);
        showNotif('\uc77c\uc815\uc774 \uc218\uc815\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
      } else {
        data.createdAt = new Date().toISOString();
        data.createdBy = window._userEmail || '';
        await push(companyEventsRef, data);
        showNotif('\uc77c\uc815\uc774 \ub4f1\ub85d\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
      }
      document.getElementById('eventModal').classList.remove('open');
    } catch(e) { showNotif('\uc800\uc7a5 \uc2e4\ud328: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '\uc800\uc7a5';
  };
  window._deleteEvent = async function(id) {
    if (window._userRole !== 'admin') return;
    if (!confirm('\uc774 \uc77c\uc815\uc744 \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?')) return;
    try {
      await remove(ref(db, 'companyEvents/' + id));
      showNotif('\uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
      document.getElementById('dateDetailModal').classList.remove('open');
    } catch(e) { showNotif('\uc0ad\uc81c \uc2e4\ud328: ' + e.message, true); }
  };

  // ---- INSURANCE CONTACTS ----
  const insuranceRef = ref(db, 'insuranceContacts');
  let insuranceContacts = {};
  let editingInsuranceId = null;

  onValue(insuranceRef, function(snap){
    insuranceContacts = snap.val() || {};
    try { window._renderInsurance && window._renderInsurance(); } catch(e) { console.error(e); }
  });

  function _telLink(num) {
    if (!num) return '';
    var digits = String(num).replace(/[^0-9+]/g, '');
    return digits;
  }

  // 단일 객체(legacy) 또는 배열 → 배열로 정규화 (빈 행 제외)
  function _insNormalize(v) {
    if (!v) return [];
    var arr = Array.isArray(v) ? v : [v];
    return arr.filter(function(x){ return x && (x.name || x.phone || x.fax); });
  }

  window._renderInsurance = function() {
    var listEl = document.getElementById('insurance-list');
    var emptyEl = document.getElementById('insurance-empty');
    var noresEl = document.getElementById('insurance-noresult');
    if (!listEl) return;
    var isAdmin = window._userRole === 'admin';
    document.querySelectorAll('.ins-admin-only').forEach(function(el){ el.style.display = isAdmin ? '' : 'none'; });

    var entries = Object.entries(insuranceContacts).filter(function(e){ return e[1]; });
    entries.sort(function(a, b){
      var oa = (a[1].order != null) ? a[1].order : 9999;
      var ob = (b[1].order != null) ? b[1].order : 9999;
      if (oa !== ob) return oa - ob;
      return (a[1].company || '').localeCompare(b[1].company || '', 'ko');
    });
    if (!entries.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      if (noresEl) noresEl.style.display = 'none';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var html = '';
    entries.forEach(function(en){
      var id = en[0], c = en[1];
      var dom = _insNormalize(c.domestic);
      var fgn = _insNormalize(c.foreign);
      var searchText = (c.company || '');
      dom.concat(fgn).forEach(function(p){ searchText += ' ' + (p.name||'') + ' ' + (p.phone||'') + ' ' + (p.fax||''); });
      html += '<div class="ins-card" data-id="'+esc(id)+'" data-search="'+esc(searchText.toLowerCase())+'" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">';
      html += '<div style="font-size:16px;font-weight:800;letter-spacing:0.3px;">'+esc(c.company || '(이름 없음)')+'</div>';
      if (isAdmin) {
        html += '<div class="ins-admin-only" style="display:flex;gap:4px;">';
        html += '<button class="btn btn-ghost btn-sm" onclick="window._editInsurance(\''+esc(id)+'\')">수정</button>';
        html += '<button class="btn btn-ghost btn-sm" onclick="window._deleteInsurance(\''+esc(id)+'\')">삭제</button>';
        html += '</div>';
      }
      html += '</div>';

      html += '<div class="ins-domestic" style="background:var(--surface2);border-radius:8px;padding:12px;border-left:3px solid var(--accent);">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--text-dim);letter-spacing:1px;margin-bottom:8px;"> 국산차 담당'+(dom.length>1?' · '+dom.length+'명':'')+'</div>';
      html += _renderInsPersonList(dom);
      html += '</div>';

      html += '<div class="ins-foreign" style="background:var(--surface2);border-radius:8px;padding:12px;border-left:3px solid var(--blue);">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--text-dim);letter-spacing:1px;margin-bottom:8px;"> 외제차 담당'+(fgn.length>1?' · '+fgn.length+'명':'')+'</div>';
      html += _renderInsPersonList(fgn);
      html += '</div>';
      html += '</div>';
    });
    listEl.innerHTML = html;
    var page = document.getElementById('page-insurance');
    var view = (page && page.getAttribute('data-filter')) || 'all';
    if (view !== 'all') window._setInsuranceFilter(view);
    var searchEl = document.getElementById('insurance-search');
    if (searchEl && searchEl.value) window._setInsuranceSearch(searchEl.value);
  };

  function _renderInsPersonList(arr) {
    if (!arr.length) {
      return '<div style="font-size:12px;color:var(--text-dim);">— 미등록 —</div>';
    }
    return arr.map(function(c, idx){
      var html = '';
      if (idx > 0) html += '<div style="border-top:1px dashed var(--border);margin:8px 0;"></div>';
      if (c.name) html += '<div style="font-size:14px;font-weight:600;margin-bottom:6px;">'+esc(c.name)+'</div>';
      if (c.phone) {
        html += '<div style="font-size:13px;margin-bottom:4px;">'
          + '<a href="tel:'+esc(_telLink(c.phone))+'" style="color:var(--text);text-decoration:none;display:inline-flex;align-items:center;gap:6px;">'
          + ''
          + '<span style="font-family:\'JetBrains Mono\',monospace;">'+esc(c.phone)+'</span>'
          + '</a></div>';
      }
      if (c.fax) {
        html += '<div style="font-size:12px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px;">'
          + '<span></span>'
          + '<span style="font-family:\'JetBrains Mono\',monospace;">'+esc(c.fax)+'</span>'
          + '</div>';
      }
      return html;
    }).join('');
  }

  window._setInsuranceSearch = function(q) {
    var query = String(q||'').trim().toLowerCase();
    var cards = document.querySelectorAll('#insurance-list .ins-card');
    var visibleCount = 0;
    cards.forEach(function(card){
      var hay = card.getAttribute('data-search') || '';
      var match = !query || hay.indexOf(query) !== -1;
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    var noresEl = document.getElementById('insurance-noresult');
    var emptyEl = document.getElementById('insurance-empty');
    if (noresEl) noresEl.style.display = (query && visibleCount === 0 && cards.length > 0) ? '' : 'none';
    if (emptyEl && cards.length > 0) emptyEl.style.display = 'none';
  };


  window._setInsuranceFilter = function(view) {
    var page = document.getElementById('page-insurance');
    if (page) page.setAttribute('data-filter', view);
    ['all','domestic','foreign'].forEach(function(v){
      var btn = document.getElementById('if-'+v);
      if (btn) btn.classList.toggle('active', v === view);
    });
    // \uce74\ub4dc \ub0b4\ubd80 \uc139\uc158 \ud1a0\uae00
    document.querySelectorAll('#page-insurance .ins-card').forEach(function(card){
      var d = card.querySelector('.ins-domestic');
      var f = card.querySelector('.ins-foreign');
      if (d) d.style.display = (view === 'foreign') ? 'none' : '';
      if (f) f.style.display = (view === 'domestic') ? 'none' : '';
    });
  };

  function _renderInsRowHTML(p) {
    p = p || {};
    return '<div class="ins-row" style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px;">'
      + '<input class="form-input ins-row-name" placeholder="이름" value="'+esc(p.name||'')+'" style="font-size:13px;">'
      + '<input class="form-input ins-row-phone" placeholder="010-0000-0000" value="'+esc(p.phone||'')+'" style="font-size:13px;">'
      + '<button type="button" class="btn btn-ghost btn-sm" onclick="this.closest(\'.ins-row\').remove()" style="padding:6px 10px;">\uC0AD\uC81C</button>'
      + '<input class="form-input ins-row-fax" placeholder="팩스 (선택)" value="'+esc(p.fax||'')+'" style="grid-column:1/-1;font-size:13px;">'
      + '</div>';
  }

  function _populateInsRows(containerId, list) {
    var c = document.getElementById(containerId);
    if (!c) return;
    if (!list || !list.length) {
      c.innerHTML = _renderInsRowHTML({});
      return;
    }
    c.innerHTML = list.map(function(p){ return _renderInsRowHTML(p); }).join('');
  }

  function _collectInsRows(containerId) {
    var rows = document.querySelectorAll('#' + containerId + ' .ins-row');
    var out = [];
    rows.forEach(function(r){
      var name = (r.querySelector('.ins-row-name')||{}).value || '';
      var phone = (r.querySelector('.ins-row-phone')||{}).value || '';
      var fax = (r.querySelector('.ins-row-fax')||{}).value || '';
      name = name.trim(); phone = phone.trim(); fax = fax.trim();
      if (name || phone || fax) out.push({ name: name, phone: phone, fax: fax });
    });
    return out;
  }

  window._addInsRow = function(type) {
    var containerId = (type === 'foreign') ? 'ins-for-rows' : 'ins-dom-rows';
    var c = document.getElementById(containerId);
    if (!c) return;
    c.insertAdjacentHTML('beforeend', _renderInsRowHTML({}));
    var lastRow = c.lastElementChild;
    var firstInput = lastRow && lastRow.querySelector('.ins-row-name');
    if (firstInput) firstInput.focus();
  };

  window._openInsuranceModal = function() {
    if (window._userRole !== 'admin') return;
    editingInsuranceId = null;
    document.getElementById('insuranceModalTitle').textContent = '보험사 추가';
    document.getElementById('ins-company').value = '';
    _populateInsRows('ins-dom-rows', []);
    _populateInsRows('ins-for-rows', []);
    document.getElementById('insuranceModal').classList.add('open');
  };

  window._editInsurance = function(id) {
    if (window._userRole !== 'admin') return;
    var c = insuranceContacts[id]; if (!c) return;
    editingInsuranceId = id;
    document.getElementById('insuranceModalTitle').textContent = '보험사 수정';
    document.getElementById('ins-company').value = c.company || '';
    _populateInsRows('ins-dom-rows', _insNormalize(c.domestic));
    _populateInsRows('ins-for-rows', _insNormalize(c.foreign));
    document.getElementById('insuranceModal').classList.add('open');
  };

  window._saveInsurance = async function() {
    var company = document.getElementById('ins-company').value.trim();
    if (!company) { showNotif('보험사명을 입력해주세요', true); return; }
    var domList = _collectInsRows('ins-dom-rows');
    var fgnList = _collectInsRows('ins-for-rows');
    var data = {
      company: company,
      domestic: domList,
      foreign: fgnList,
      updatedAt: new Date().toISOString()
    };
    var btn = document.getElementById('insuranceSaveBtn');
    btn.disabled = true; btn.textContent = '저장 중...';
    try {
      if (editingInsuranceId) {
        // 기존 단일 객체 형태를 배열로 덮어쓰기 위해 set-style update
        await update(ref(db, 'insuranceContacts/' + editingInsuranceId), data);
        showNotif('보험사가 수정되었습니다');
      } else {
        data.createdAt = new Date().toISOString();
        data.createdBy = window._userEmail || '';
        await push(insuranceRef, data);
        showNotif('보험사가 등록되었습니다');
      }
      document.getElementById('insuranceModal').classList.remove('open');
    } catch(e) { showNotif('저장 실패: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '저장';
  };

  window._deleteInsurance = async function(id) {
    if (window._userRole !== 'admin') return;
    var c = insuranceContacts[id];
    var name = (c && c.company) ? c.company : '';
    if (!confirm((name ? '[' + name + '] ' : '') + '이 보험사를 삭제하시겠습니까?')) return;
    try {
      await remove(ref(db, 'insuranceContacts/' + id));
      showNotif('삭제되었습니다');
    } catch(e) { showNotif('삭제 실패: ' + e.message, true); }
  };


  window._openDateDetail = function(dateStr) {
    var titleEl = document.getElementById('dateDetailTitle');
    var contentEl = document.getElementById('dateDetailContent');
    var modal = document.getElementById('dateDetailModal');
    if (!titleEl || !contentEl || !modal) return;

    var dt = new Date(dateStr);
    var dowK = ['\uc77c','\uc6d4','\ud654','\uc218','\ubaa9','\uae08','\ud1a0'][dt.getDay()];
    titleEl.textContent = dateStr + ' (' + dowK + ')';

    var events = Object.entries(companyEvents).filter(function(e){ return e[1] && e[1].date === dateStr; });
    var leaves = Object.entries(leaveUsage).filter(function(e){ return e[1] && e[1].date === dateStr; });
    var isAdmin = window._userRole === 'admin';

    var html = '';
    if (events.length) {
      html += '<div style="margin-bottom:16px;"><div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;font-weight:700;letter-spacing:1px;">\ud68c\uc0ac \uc77c\uc815</div>';
      events.forEach(function(e){
        html += '<div style="background:var(--surface2);padding:12px;border-radius:8px;margin-bottom:8px;border-left:3px solid var(--accent);">';
        html += '<div style="font-weight:700;font-size:14px;margin-bottom:4px;">'+esc(e[1].title||'')+'</div>';
        if (e[1].description) html += '<div style="font-size:12px;color:var(--text-dim);white-space:pre-wrap;line-height:1.6;">'+esc(e[1].description)+'</div>';
        if (isAdmin) {
          html += '<div style="display:flex;gap:6px;margin-top:10px;">';
          html += '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'dateDetailModal\').classList.remove(\'open\');window._editEvent(\''+e[0]+'\')">\uc218\uc815</button>';
          html += '<button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);" onclick="window._deleteEvent(\''+e[0]+'\')">\uc0ad\uc81c</button>';
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    if (leaves.length) {
      html += '<div><div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;font-weight:700;letter-spacing:1px;">\uc9c1\uc6d0 \ud734\uac00</div>';
      leaves.forEach(function(e){
        var u = e[1];
        var emp = leaveEmployees[u.empId];
        var nm = emp ? emp.name : '(\uc0ad\uc81c\ub428)';
        var typeText = esc(u.type) + (u.hours ? ' '+u.hours+'h' : '');
        html += '<div style="background:var(--surface2);padding:10px 12px;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;">';
        html += '<div><strong style="font-size:13px;">'+esc(nm)+'</strong>';
        if (u.reason) html += '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">'+esc(u.reason)+'</div>';
        html += '</div>';
        html += '<span style="background:'+leaveTypeBg(u.type)+';color:'+leaveTypeColor(u.type)+';padding:4px 10px;border-radius:5px;font-size:11px;font-weight:700;white-space:nowrap;">'+typeText+'</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    if (!events.length && !leaves.length) {
      html = '<div style="text-align:center;padding:30px 0;color:var(--text-dim);">\ub4f1\ub85d\ub41c \uc77c\uc815\uc774 \uc5c6\uc2b5\ub2c8\ub2e4</div>';
    }
    if (isAdmin) {
      html += '<div style="margin-top:16px;text-align:right;">';
      html += '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'dateDetailModal\').classList.remove(\'open\');window._openEventModal(\''+dateStr+'\')">\uc774\ub0a0 \uc77c\uc815 \ucd94\uac00</button>';
      html += '</div>';
    }
    contentEl.innerHTML = html;
    modal.classList.add('open');
  };

  window._openLeaveEmpModal = function() {
    editingLeaveEmpId = null;
    document.getElementById('leaveEmpModalTitle').textContent = '\uc9c1\uc6d0 \ucd94\uac00';
    document.getElementById('le-name').value = '';
    document.getElementById('le-email').value = '';
    document.getElementById('le-team').value = '';
    document.getElementById('le-position').value = '\uc77c\ubc18';
    document.getElementById('le-display-team').value = '';
    document.getElementById('le-hiredate').value = '';
    document.getElementById('le-total').value = '15';
    document.getElementById('leaveEmpModal').classList.add('open');
  };
  window._editLeaveEmp = function(id) {
    var emp = leaveEmployees[id]; if (!emp) return;
    editingLeaveEmpId = id;
    document.getElementById('leaveEmpModalTitle').textContent = '\uc9c1\uc6d0 \uc218\uc815';
    document.getElementById('le-name').value = emp.name || '';
    document.getElementById('le-email').value = emp.email || '';
    var teamSel = document.getElementById('le-team');
    var savedTeam = emp.team || '';
    var preset = ['', '\uc0ac\ubb34\uc2e4', '\ud310\uae08\ubd80', '\ub3c4\uc7a5\ubd80', '\uae30\ub2a5\ubd80', '\uc0ac\uace0\uc804\ub2f4\ubd80'];
    // 기존 옵션에 없는 커스텀 값이면 임시로 옵션 추가
    Array.from(teamSel.querySelectorAll('option[data-custom]')).forEach(function(o){ o.remove(); });
    if (savedTeam && preset.indexOf(savedTeam) === -1) {
      var opt = document.createElement('option');
      opt.value = savedTeam; opt.textContent = savedTeam + ' (\uc774\uc804 \uac12)'; opt.setAttribute('data-custom','1');
      teamSel.appendChild(opt);
    }
    teamSel.value = savedTeam;
    document.getElementById('le-position').value = emp.position || '\uc77c\ubc18';
    document.getElementById('le-display-team').value = emp.displayTeam || '';
    document.getElementById('le-hiredate').value = emp.hireDate || '';
    document.getElementById('le-total').value = emp.hireDate ? calcTotalLeave(emp.hireDate) : (emp.totalLeave || 15);
    document.getElementById('leaveEmpModal').classList.add('open');
  };
  window._saveLeaveEmp = async function() {
    var name = document.getElementById('le-name').value.trim();
    var email = document.getElementById('le-email').value.trim();
    var team = document.getElementById('le-team').value.trim();
    var position = document.getElementById('le-position').value;
    var displayTeam = document.getElementById('le-display-team').value.trim();
    var hireDate = document.getElementById('le-hiredate').value;
    var total = hireDate ? calcTotalLeave(hireDate) : parseFloat(document.getElementById('le-total').value);
    if (!name) { showNotif('\uc9c1\uc6d0\uba85\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694', true); return; }
    var btn = document.getElementById('leaveEmpSaveBtn');
    btn.disabled = true; btn.textContent = '\uc800\uc7a5 \uc911...';
    try {
      var data = { name: name, email: email, team: team, position: position, displayTeam: displayTeam, totalLeave: total, hireDate: hireDate, updatedAt: new Date().toISOString() };
      if (editingLeaveEmpId) { await update(ref(db, 'leaveEmployees/' + editingLeaveEmpId), data); showNotif(name + ' \uc815\ubcf4\uac00 \uc218\uc815\ub418\uc5c8\uc2b5\ub2c8\ub2e4'); }
      else { data.createdAt = new Date().toISOString(); await push(leaveEmpRef, data); showNotif(name + ' \uc9c1\uc6d0\uc774 \ucd94\uac00\ub418\uc5c8\uc2b5\ub2c8\ub2e4'); }
      document.getElementById('leaveEmpModal').classList.remove('open');
    } catch(e) { showNotif('\uc800\uc7a5 \uc2e4\ud328: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '\uc800\uc7a5';
  };
  // ---- LEAVE REQUESTS (신청서 워크플로) ----
  const leaveRequestsRef = ref(db, 'leaveRequests');
  let leaveRequests = {};
  let editingRejectId = null;
  let editingRejectStage = null;

  onValue(leaveRequestsRef, (snap) => { leaveRequests = snap.val() || {}; try { renderMyRequests(); renderApprovalQueue(); } catch(e) { console.error(e); } });

  function getMyEmpRecord() {
    if (!window._userEmail) return null;
    var myEmail = window._userEmail.toLowerCase();
    var myName = window._userName || '';
    var entries = Object.entries(leaveEmployees);
    for (var i=0; i<entries.length; i++) {
      var e = entries[i];
      if (e[1] && e[1].email && e[1].email.toLowerCase() === myEmail) return Object.assign({id:e[0]}, e[1]);
    }
    for (var i=0; i<entries.length; i++) {
      var e = entries[i];
      if (e[1] && !e[1].email && e[1].name && e[1].name === myName) return Object.assign({id:e[0]}, e[1]);
    }
    return null;
  }
  function teamHasManager(team) {
    if (!team) return false;
    var entries = Object.entries(leaveEmployees);
    for (var i=0; i<entries.length; i++) {
      if (entries[i][1] && entries[i][1].team === team && entries[i][1].position === '\ubd80\uc11c\uc7a5') return true;
    }
    return false;
  }
  function statusLabel(status) {
    switch(status) {
      case 'pending_manager': return '\ubd80\uc11c\uc7a5 \ub300\uae30';
      case 'pending_admin': return '\uad00\ub9ac\uc790 \ub300\uae30';
      case 'pending_director': return '\ub300\ud45c \ub300\uae30';
      case 'approved': return '\uc2b9\uc778';
      case 'rejected': return '\ubc18\ub824';
      case 'canceled': return '\ucde8\uc18c';
      default: return status;
    }
  }
  function reqStatusBadge(status) {
    var bg, color;
    if (status === 'approved') { bg='rgba(75,156,255,0.15)'; color='var(--blue)'; }
    else if (status === 'rejected') { bg='rgba(232,68,42,0.15)'; color='var(--red)'; }
    else if (status === 'canceled') { bg='rgba(163,163,163,0.15)'; color='var(--text-dim)'; }
    else { bg='rgba(251,146,60,0.15)'; color='#fb923c'; }
    return '<span style="background:'+bg+';color:'+color+';padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;white-space:nowrap;">'+statusLabel(status)+'</span>';
  }
  function determineInitialStatus(emp) {
    var pos = emp.position || '\uc77c\ubc18';
    var requesterIsAdmin = window._userRole === 'admin';
    if (pos === '\ub300\ud45c') return 'approved';
    if (pos === '\uc784\uc6d0') return 'pending_director';
    var startsWithManager = (pos !== '\ubd80\uc11c\uc7a5' && teamHasManager(emp.team));
    if (startsWithManager) return 'pending_manager';
    if (requesterIsAdmin) return 'pending_director';
    return 'pending_admin';
  }
  function canApproveStage(stage, currentEmp) {
    var isAdmin = window._userRole === 'admin';
    if (stage === 'pending_admin') return isAdmin;
    if (stage === 'pending_manager') {
      if (!currentEmp) return false;
      return currentEmp.position === '\ubd80\uc11c\uc7a5';
    }
    if (stage === 'pending_director') {
      if (!currentEmp) return false;
      return currentEmp.position === '\ub300\ud45c';
    }
    return false;
  }

  window._openMyRequestModal = function() {
    var myEmp = getMyEmpRecord();
    if (!myEmp) { showNotif('\ubcf8\uc778 \uc9c1\uc6d0 \uc815\ubcf4\uac00 \ub4f1\ub85d\ub418\uc9c0 \uc54a\uc544 \uc2e0\uccad\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \uad00\ub9ac\uc790\uc5d0\uac8c \ubb38\uc758\ud574\uc8fc\uc138\uc694.', true); return; }
    document.getElementById('mr-type').value = '\uc5f0\ucc28';
    document.getElementById('mr-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('mr-reason').value = '';
    document.getElementById('mr-hours').value = '1';
    document.getElementById('mr-hours-group').style.display = 'none';
    var pos = myEmp.position || '\uc77c\ubc18';
    var flowText = '';
    if (pos === '\ub300\ud45c') flowText = '\ub300\ud45c\ub2d8 \uc2e0\uccad\uc740 \uc81c\ucd9c \uc989\uc2dc \uc2b9\uc778\ub429\ub2c8\ub2e4.';
    else if (pos === '\uc784\uc6d0') flowText = '\uacb0\uc7ac \uc21c\uc11c: \ub300\ud45c (\uc784\uc6d0\uc740 \ubd80\uc11c\uc7a5\u00b7\uad00\ub9ac\uc790 \ub2e8\uacc4 \uc790\ub3d9 \ud328\uc2a4)';
    else if (pos === '\ubd80\uc11c\uc7a5') flowText = '\uacb0\uc7ac \uc21c\uc11c: \uad00\ub9ac\uc790 \u2192 \ub300\ud45c (\ubd80\uc11c\uc7a5 \ub2e8\uacc4 \uc790\ub3d9 \ud328\uc2a4)';
    else if (window._userRole === 'admin') flowText = '\uacb0\uc7ac \uc21c\uc11c: \ub300\ud45c (\uad00\ub9ac\uc790 \ub2e8\uacc4 \uc790\ub3d9 \ud328\uc2a4)' + (teamHasManager(myEmp.team)?', \ubd80\uc11c\uc7a5 \uba3c\uc800':'');
    else if (!teamHasManager(myEmp.team)) flowText = '\uacb0\uc7ac \uc21c\uc11c: \uad00\ub9ac\uc790 \u2192 \ub300\ud45c (\uc18c\uc18d \ud300 \ubd80\uc11c\uc7a5 \ubbf8\ub4f1\ub85d, \ubd80\uc11c\uc7a5 \ub2e8\uacc4 \uc790\ub3d9 \ud328\uc2a4)';
    else flowText = '\uacb0\uc7ac \uc21c\uc11c: ' + esc(myEmp.team || '\ud300') + ' \ubd80\uc11c\uc7a5 \u2192 \uad00\ub9ac\uc790 \u2192 \ub300\ud45c';
    document.getElementById('myreq-flow-info').innerHTML = flowText;
    document.getElementById('myRequestModal').classList.add('open');
  };
  window._submitLeaveRequest = async function() {
    var myEmp = getMyEmpRecord();
    if (!myEmp) { showNotif('\uc9c1\uc6d0 \uc815\ubcf4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4', true); return; }
    var type = document.getElementById('mr-type').value;
    var date = document.getElementById('mr-date').value;
    var reason = document.getElementById('mr-reason').value.trim();
    var hours = (type === '\uc870\ud1f4' || type === '\uc678\ucd9c') ? parseInt(document.getElementById('mr-hours').value) : null;
    if (!date) { showNotif('\uc0ac\uc6a9\uc77c\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694', true); return; }
    var btn = document.getElementById('myReqSaveBtn');
    btn.disabled = true; btn.textContent = '\uc81c\ucd9c \uc911...';
    try {
      var initStatus = determineInitialStatus(myEmp);
      var nowStr = new Date().toISOString();
      var data = { empId: myEmp.id, type: type, date: date, reason: reason, team: myEmp.team || '', status: initStatus, createdAt: nowStr, requestedBy: window._userEmail || '' };
      if (hours) data.hours = hours;
      if (initStatus === 'approved') {
        data.approvedAt = nowStr; data.approvedBy = window._userEmail || '';
        data.directorApprovedAt = nowStr; data.directorApprovedBy = window._userEmail || '';
        var newRef = await push(leaveRequestsRef, data);
        var usageData = { empId: myEmp.id, type: type, date: date, reason: reason, createdAt: nowStr, fromRequestId: newRef.key };
        if (hours) usageData.hours = hours;
        var usageRef = await push(leaveUseRef, usageData);
        await update(ref(db, 'leaveRequests/' + newRef.key), { finalUsageId: usageRef.key });
        showNotif('\uc2e0\uccad\uc774 \uc989\uc2dc \uc2b9\uc778\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
      } else {
        await push(leaveRequestsRef, data);
        showNotif('\uc2e0\uccad\uc774 \uc81c\ucd9c\ub418\uc5c8\uc2b5\ub2c8\ub2e4 (' + statusLabel(initStatus) + ')');
      }
      document.getElementById('myRequestModal').classList.remove('open');
    } catch(e) { showNotif('\uc81c\ucd9c \uc2e4\ud328: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '\uc81c\ucd9c';
  };
  window._openProxyRequestModal = function() {
    if (window._userRole !== 'admin') return;
    var sel = document.getElementById('pr-emp');
    sel.innerHTML = '<option value="">-- \uc9c1\uc6d0 \uc120\ud0dd --</option>';
    Object.entries(leaveEmployees || {})
      .map(function(e){ return Object.assign({id:e[0]}, e[1]); })
      .sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); })
      .forEach(function(emp){
        var label = (emp.name||'') + (emp.team ? ' ('+emp.team+')' : '') + (emp.position && emp.position !== '\uc77c\ubc18' ? ' \u00b7 '+emp.position : '');
        var opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = label;
        sel.appendChild(opt);
      });
    document.getElementById('pr-type').value = '\uc5f0\ucc28';
    document.getElementById('pr-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('pr-reason').value = '';
    document.getElementById('pr-hours').value = '1';
    document.getElementById('pr-hours-group').style.display = 'none';
    document.getElementById('proxyRequestModal').classList.add('open');
  };
  window._submitProxyRequest = async function() {
    if (window._userRole !== 'admin') { showNotif('\uad00\ub9ac\uc790\ub9cc \uc0ac\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4', true); return; }
    var empId = document.getElementById('pr-emp').value;
    var type = document.getElementById('pr-type').value;
    var date = document.getElementById('pr-date').value;
    var reason = document.getElementById('pr-reason').value.trim();
    var hours = (type === '\uc870\ud1f4' || type === '\uc678\ucd9c') ? parseInt(document.getElementById('pr-hours').value) : null;
    if (!empId) { showNotif('\uc9c1\uc6d0\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694', true); return; }
    if (!date) { showNotif('\uc0ac\uc6a9\uc77c\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694', true); return; }
    var emp = leaveEmployees[empId];
    if (!emp) { showNotif('\uc9c1\uc6d0 \uc815\ubcf4\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4', true); return; }
    var addHours = (type === '\uc5f0\ucc28') ? 8 : (type === '\uc624\uc804\ubc18\ucc28' || type === '\uc624\ud6c4\ubc18\ucc28') ? 4 : (hours || 0);
    var usedHours = getLeaveUsedHours(empId);
    var autoTotal = (emp.hireDate) ? calcTotalLeave(emp.hireDate) : (emp.totalLeave || 15);
    var totalHours = autoTotal * 8;
    if (addHours > 0 && (usedHours + addHours) > totalHours) {
      var remain = Math.max(0, totalHours - usedHours);
      if (!confirm(emp.name + ' \ub2d8\uc758 \uc794\uc5ec \uc5f0\ucc28\uac00 \ubd80\uc871\ud569\ub2c8\ub2e4 (\uc794\uc5ec: ' + formatDayHour(remain) + '). \uadf8\ub798\ub3c4 \ub300\uc2e0 \ub4f1\ub85d\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?')) return;
    }
    var btn = document.getElementById('proxyReqSaveBtn');
    btn.disabled = true; btn.textContent = '\ub4f1\ub85d \uc911...';
    try {
      var nowStr = new Date().toISOString();
      var adminEmail = window._userEmail || '';
      var data = {
        empId: empId, type: type, date: date, reason: reason,
        team: emp.team || '',
        status: 'approved',
        createdAt: nowStr,
        requestedBy: adminEmail,
        submittedOnBehalf: true,
        onBehalfBy: adminEmail,
        managerApprovedAt: nowStr, managerApprovedBy: adminEmail,
        adminApprovedAt: nowStr, adminApprovedBy: adminEmail,
        directorApprovedAt: nowStr, directorApprovedBy: adminEmail,
        approvedAt: nowStr, approvedBy: adminEmail
      };
      if (hours) data.hours = hours;
      var newRef = await push(leaveRequestsRef, data);
      var usageData = { empId: empId, type: type, date: date, reason: reason, createdAt: nowStr, fromRequestId: newRef.key, registeredOnBehalfBy: adminEmail };
      if (hours) usageData.hours = hours;
      var usageRef = await push(leaveUseRef, usageData);
      await update(ref(db, 'leaveRequests/' + newRef.key), { finalUsageId: usageRef.key });
      showNotif(emp.name + ' \ub2d8\uc758 ' + type + ' \uc2e0\uccad\uc744 \ub300\uc2e0 \ub4f1\ub85d\u00b7\uc2b9\uc778\ud588\uc2b5\ub2c8\ub2e4');
      document.getElementById('proxyRequestModal').classList.remove('open');
    } catch(e) { showNotif('\ub4f1\ub85d \uc2e4\ud328: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '\ub4f1\ub85d';
  };
  window._cancelMyRequest = async function(id) {
    var req = leaveRequests[id]; if (!req) return;
    if (req.status !== 'pending_manager' && req.status !== 'pending_admin' && req.status !== 'pending_director') {
      showNotif('\uacb0\uc7ac\uac00 \uc644\ub8cc\ub41c \uc2e0\uccad\uc740 \ucde8\uc18c\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4', true);
      return;
    }
    if (!confirm('\uc774 \uc2e0\uccad\uc744 \ucde8\uc18c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?')) return;
    try {
      await update(ref(db, 'leaveRequests/' + id), { status: 'canceled', canceledAt: new Date().toISOString(), canceledBy: window._userEmail || '' });
      showNotif('\uc2e0\uccad\uc774 \ucde8\uc18c\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
    } catch(e) { showNotif('\ucde8\uc18c \uc2e4\ud328: ' + e.message, true); }
  };
  window._approveRequest = async function(id) {
    var req = leaveRequests[id]; if (!req) return;
    var stage = req.status;
    var nextStatus = '';
    var nowStr = new Date().toISOString();
    var updates = {};
    if (stage === 'pending_manager') { nextStatus = 'pending_admin'; updates.managerApprovedAt = nowStr; updates.managerApprovedBy = window._userEmail || ''; }
    else if (stage === 'pending_admin') { nextStatus = 'pending_director'; updates.adminApprovedAt = nowStr; updates.adminApprovedBy = window._userEmail || ''; }
    else if (stage === 'pending_director') { nextStatus = 'approved'; updates.directorApprovedAt = nowStr; updates.directorApprovedBy = window._userEmail || ''; updates.approvedAt = nowStr; updates.approvedBy = window._userEmail || ''; }
    else { showNotif('\uacb0\uc7ac\ud560 \uc218 \uc5c6\ub294 \uc0c1\ud0dc\uc785\ub2c8\ub2e4', true); return; }
    updates.status = nextStatus;
    try {
      await update(ref(db, 'leaveRequests/' + id), updates);
      if (nextStatus === 'approved') {
        var usageData = { empId: req.empId, type: req.type, date: req.date, reason: req.reason || '', createdAt: nowStr, fromRequestId: id };
        if (req.hours) usageData.hours = req.hours;
        var usageRef = await push(leaveUseRef, usageData);
        await update(ref(db, 'leaveRequests/' + id), { finalUsageId: usageRef.key });
        showNotif('\ucd5c\uc885 \uc2b9\uc778 \uc644\ub8cc, \uc0ac\uc6a9 \ub0b4\uc5ed\uc5d0 \uc790\ub3d9 \ub4f1\ub85d\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
      } else {
        showNotif('\uc2b9\uc778 \uc644\ub8cc \u2192 ' + statusLabel(nextStatus));
      }
    } catch(e) { showNotif('\uc2b9\uc778 \uc2e4\ud328: ' + e.message, true); }
  };
  window._acknowledgeRequest = async function(id) {
    if (window._userRole !== 'admin') return;
    var req = leaveRequests[id]; if (!req) return;
    if (req.status !== 'approved') return;
    if (!confirm('이 신청서의 양식을 인쇄·확인하셨나요?\n확인하면 결재 대기 목록에서 제거됩니다.')) return;
    try {
      await update(ref(db, 'leaveRequests/' + id), {
        adminAcknowledged: true,
        adminAcknowledgedAt: new Date().toISOString(),
        adminAcknowledgedBy: window._userEmail || ''
      });
      showNotif('확인 완료, 목록에서 제거됩니다');
    } catch(e) { showNotif('처리 실패: ' + e.message, true); }
  };
  window._openRejectModal = function(id) {
    editingRejectId = id;
    var req = leaveRequests[id];
    editingRejectStage = req ? req.status : null;
    document.getElementById('reject-reason').value = '';
    document.getElementById('rejectModal').classList.add('open');
  };
  function findEmpNameByEmail(email) {
    if (!email) return '';
    var e = email.toLowerCase();
    var entries = Object.entries(leaveEmployees);
    for (var i=0; i<entries.length; i++) {
      var emp = entries[i][1];
      if (emp && emp.email && emp.email.toLowerCase() === e) return emp.name || '';
    }
    return email.split('@')[0];
  }
  function buildRequestFormHTML(req) {
    if (!req) return '<div style="padding:30px;text-align:center;color:#999;">신청서를 찾을 수 없습니다</div>';
    var emp = leaveEmployees[req.empId] || {};
    var name = emp.name || '';
    var team = emp.team || '';
    var position = emp.position || '';
    var type = req.type || '';
    var hours = req.hours || 0;
    var reason = req.reason || '';
    var date = req.date || '';
    var d = date ? new Date(date) : null;
    var y = d ? d.getFullYear() : '';
    var mo = d ? (d.getMonth()+1) : '';
    var da = d ? d.getDate() : '';
    var isOut = (type === '\uc678\ucd9c');
    var isEarly = (type === '\uc870\ud1f4');
    var isYC = (type === '\uc5f0\ucc28');
    var isHalf = (type === '\uc624\uc804\ubc18\ucc28' || type === '\uc624\ud6c4\ubc18\ucc28');
    var halfNote = type === '\uc624\uc804\ubc18\ucc28' ? '\uc624\uc804\ubc18\ucc28' : (type === '\uc624\ud6c4\ubc18\ucc28' ? '\uc624\ud6c4\ubc18\ucc28' : '');
    var managerName = req.managerApprovedBy ? findEmpNameByEmail(req.managerApprovedBy) : '';
    var adminName = req.adminApprovedBy ? findEmpNameByEmail(req.adminApprovedBy) : '';
    var directorName = req.directorApprovedBy ? findEmpNameByEmail(req.directorApprovedBy) : '';
    var ck = function(b){ return b ? '\u2611' : '\u2610'; };
    var cellBorder = 'border:1px solid #000;';
    var hdrCell = 'border:1px solid #000;background:#f0f0f0;text-align:center;font-weight:600;padding:6px 8px;';
    var sealHdr = 'border:1px solid #000;background:#f0f0f0;text-align:center;font-weight:600;padding:4px;font-size:12px;';
    var sealBody = 'border:1px solid #000;text-align:center;height:48px;vertical-align:middle;font-size:13px;';
    var html = ''
      + '<div class="leave-form" style="font-family:\'\ub9d1\uc740 \uace0\ub515\',\'Malgun Gothic\',sans-serif;color:#000;background:#fff;padding:24px 28px;max-width:680px;margin:0 auto;font-size:13px;">'
      + '<div style="border:2px solid #000;padding:10px;text-align:center;font-size:17px;font-weight:700;margin-bottom:0;">'
      + '(\uc678\ucd9c'+ck(isOut)+', \uc870\ud1f4'+ck(isEarly)+', \ud734\uac00\u2610, \uc5f0\ucc28'+ck(isYC)+', \ubc18\ucc28'+ck(isHalf)+') \uc2e0\uccad\uc11c'
      + '</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-top:6px;">'
      + '<tr>'
      + '<td rowspan="2" style="'+hdrCell+'width:24%;">\uc218&nbsp;\uc2e0&nbsp;\ubd80&nbsp;\uc11c</td>'
      + '<td style="'+sealHdr+'width:25%;">\ubd80\uc11c\ud300\uc7a5</td>'
      + '<td style="'+sealHdr+'width:25%;">\uad00\ub9ac\ud300\uc7a5</td>'
      + '<td style="'+sealHdr+'width:26%;">\ub300\ud45c</td>'
      + '</tr>'
      + '<tr>'
      + '<td style="'+sealBody+'">'+esc(managerName)+'</td>'
      + '<td style="'+sealBody+'">'+esc(adminName)+'</td>'
      + '<td style="'+sealBody+'">'+esc(directorName)+'</td>'
      + '</tr>'
      + '</table>'
      + '<table style="width:100%;border-collapse:collapse;border-top:none;margin-top:6px;">'
      + '<tr>'
      + '<td style="'+hdrCell+'width:14%;">\uc18c&nbsp;\uc18d</td>'
      + '<td style="'+cellBorder+'width:36%;padding:8px 10px;">'+esc(team)+'</td>'
      + '<td style="'+hdrCell+'width:14%;">\uc0ac&nbsp;\ubc88</td>'
      + '<td style="'+cellBorder+'width:36%;padding:8px 10px;">&nbsp;</td>'
      + '</tr>'
      + '<tr>'
      + '<td style="'+hdrCell+'">\uc9c1&nbsp;\uc704</td>'
      + '<td style="'+cellBorder+'padding:8px 10px;">'+esc(position)+'</td>'
      + '<td style="'+hdrCell+'">\uc131&nbsp;\uba85</td>'
      + '<td style="'+cellBorder+'padding:8px 10px;">'+esc(name)+' <span style="color:#888;font-size:11px;">(\uc11c\uba85)</span></td>'
      + '</tr>'
      + '</table>'
      + '<div style="border:1px solid #000;border-top:none;padding:16px 18px;line-height:1.8;">'
      + '<div style="margin-bottom:8px;">\uc704 \uc0ac\ub78c\uc758 ( '+esc(type)+' ) \uc2e0\uccad\uc6d0\uc744 \uc81c\ucd9c\ud558\uc624\ub2c8 \ud5c8\uac00\ud558\uc5ec \uc8fc\uc2dc\uae30 \ubc14\ub78d\ub2c8\ub2e4.</div>'
      + '<div style="margin:14px 0 6px;font-weight:700;">1. \uae30 \uac04 :</div>'
      + '<div style="margin-left:18px;">'+y+'\ub144 '+mo+'\uc6d4 '+da+'\uc77c \ubd80\ud130</div>'
      + '<div style="margin-left:18px;">'+y+'\ub144 '+mo+'\uc6d4 '+da+'\uc77c \uae4c\uc9c0</div>'
      + (hours ? '<div style="margin-left:18px;color:#444;">( \u3000 \uc2dc \u3000 \ubd84\ubd80\ud130 \u3000 \uc2dc \u3000 \ubd84\uae4c\uc9c0 \u00a0\u00a0 '+hours+'\uc2dc\uac04 )</div>' : '')
      + (halfNote ? '<div style="margin-left:18px;color:#444;">( '+halfNote+' )</div>' : '')
      + '<div style="margin:18px 0 6px;font-weight:700;">2. \uc0ac \uc720 :</div>'
      + '<div style="margin-left:18px;min-height:60px;white-space:pre-wrap;">'+esc(reason)+'</div>'
      + '</div>'
      + '<div style="text-align:center;padding:24px 0 6px;font-size:15px;font-weight:700;">\ucf00\uc774\uc9c0\ubaa8\ube4c\ub9ac\ud2f0\uc131\uc218\uc11c\ube44\uc2a4\uc13c\ud130</div>'
      + '</div>';
    return html;
  }
  var _currentPrintReqId = null;
  window._openRequestPrintView = function(id) {
    var req = leaveRequests[id];
    if (!req) { showNotif('\uc2e0\uccad\uc11c\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4', true); return; }
    _currentPrintReqId = id;
    document.getElementById('requestPrintContent').innerHTML = buildRequestFormHTML(req);
    document.getElementById('requestPrintModal').classList.add('open');
  };
  window._printRequest = function() {
    if (!_currentPrintReqId) return;
    var req = leaveRequests[_currentPrintReqId];
    if (!req) return;
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>\uc5f0\uc6d4\ucc28 \uc2e0\uccad\uc11c</title>'
      + '<style>@page{size:A4;margin:18mm 16mm;}body{margin:0;padding:0;background:#fff;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>'
      + '</head><body>' + buildRequestFormHTML(req) + '</body></html>';
    var w = window.open('', '_blank', 'width=820,height=1100');
    if (!w) { showNotif('\ud31d\uc5c5 \ucc28\ub2e8 \uc2dc \uc778\uc1c4\uac00 \uc548 \ub429\ub2c8\ub2e4', true); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function(){ try { w.print(); } catch(e){} }, 300);
  };

  function renderOrgChart() {
    var container = document.getElementById('orgChartContainer');
    if (!container) return;
    var allEmps = Object.entries(leaveEmployees || {}).map(function(e){ var x = Object.assign({id:e[0]}, e[1]); x._displayTeam = (x.displayTeam && x.displayTeam.trim()) || x.team || ''; return x; });
    var ceo = allEmps.find(function(e){ return e.position === '\ub300\ud45c'; });
    var executives = allEmps.filter(function(e){ return e.position === '\uc784\uc6d0'; });
    var teams = ['\uae30\ub2a5\ubd80','\ud310\uae08\ubd80','\ub3c4\uc7a5\ubd80','\uc0ac\ubb34\uc2e4'];
    var specialTeams = ['\uc0ac\uace0\uc804\ub2f4\ubd80'];
    function card(emp, role) {
      if (!emp) return '<div class="org-card empty">\ubbf8\uc9c0\uc815</div>';
      return '<div class="org-card role-'+role+'"><div class="org-card-name">'+esc(emp.name||'')+'</div>'+(emp.position?'<div class="org-card-sub">'+esc(emp.position)+'</div>':'')+'</div>';
    }
    var html = '<div class="org-section">';
    html += '<div class="org-tier-label">\ub300\ud45c</div>';
    html += card(ceo, '\ub300\ud45c');
    if (executives.length) {
      html += '<div class="org-vline"></div>';
      html += '<div class="org-tier-label">\uc784\uc6d0</div>';
      html += '<div class="org-row">';
      executives.forEach(function(e){ html += card(e, '\uc784\uc6d0'); });
      html += '</div>';
    }
    html += '<div class="org-vline"></div>';
    html += '<div class="org-tier-label">\ubd80\uc11c</div>';
    html += '<div class="org-dept-grid">';
    teams.forEach(function(team) {
      var head = allEmps.find(function(e){ return e._displayTeam === team && e.position === '\ubd80\uc11c\uc7a5'; });
      var members = allEmps.filter(function(e){ return e._displayTeam === team && e.position !== '\ubd80\uc11c\uc7a5' && e.position !== '\ub300\ud45c' && e.position !== '\uc784\uc6d0'; });
      html += '<div class="org-dept">';
      html += '<div class="org-dept-name">'+esc(team)+'</div>';
      html += '<div class="org-mini-label">\ubd80\uc11c\uc7a5</div>';
      html += card(head, '\ubd80\uc11c\uc7a5');
      if (members.length) {
        html += '<div class="org-vline" style="height:12px;"></div>';
        html += '<div class="org-mini-label">\ud300\uc6d0</div>';
        members.forEach(function(m){ html += card(m, '\uc77c\ubc18'); });
      } else {
        html += '<div style="font-size:10px;color:var(--text-dim);margin-top:6px;font-style:italic;opacity:0.6;">\ud300\uc6d0 \uc5c6\uc74c</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    // 별도 부서 (사고전담부 등) — 옆으로 분리 표시
    var allDisplayTeams = {};
    allEmps.forEach(function(e){ if (e._displayTeam) allDisplayTeams[e._displayTeam] = true; });
    var specialDeptsToShow = Object.keys(allDisplayTeams).filter(function(t){ return teams.indexOf(t) === -1; });
    if (specialDeptsToShow.length) {
      html += '<div class="org-tier-label" style="margin-top:18px;">\ud2b9\uc218 \ubd80\uc11c</div>';
      html += '<div class="org-row" style="align-items:flex-start;">';
      specialDeptsToShow.forEach(function(team) {
        var head = allEmps.find(function(e){ return e._displayTeam === team && e.position === '\ubd80\uc11c\uc7a5'; });
        var members = allEmps.filter(function(e){ return e._displayTeam === team && e.position !== '\ubd80\uc11c\uc7a5' && e.position !== '\ub300\ud45c' && e.position !== '\uc784\uc6d0'; });
        html += '<div class="org-dept" style="min-width:140px;">';
        html += '<div class="org-dept-name">'+esc(team)+'</div>';
        if (head) { html += '<div class="org-mini-label">\ubd80\uc11c\uc7a5</div>' + card(head, '\ubd80\uc11c\uc7a5'); }
        if (members.length) {
          if (head) html += '<div class="org-vline" style="height:12px;"></div>';
          html += '<div class="org-mini-label">\ud300\uc6d0</div>';
          members.forEach(function(m){ html += card(m, '\uc77c\ubc18'); });
        }
        if (!head && !members.length) {
          html += '<div style="font-size:10px;color:var(--text-dim);font-style:italic;opacity:0.6;">\uc778\uc6d0 \uc5c6\uc74c</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    var unassigned = allEmps.filter(function(e){
      if (e.position === '\ub300\ud45c' || e.position === '\uc784\uc6d0') return false;
      if (e._displayTeam) return false;
      return true;
    });
    if (unassigned.length) {
      html += '<div class="org-tier-label" style="margin-top:18px;">\ubd80\uc11c \ubbf8\uc9c0\uc815</div>';
      html += '<div class="org-row">';
      unassigned.forEach(function(e){ html += card(e, e.position === '\ubd80\uc11c\uc7a5' ? '\ubd80\uc11c\uc7a5' : '\uc77c\ubc18'); });
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }
  window._renderOrgChart = renderOrgChart;

  // ---- ANNUAL LEAVE NOTICES (사용촉진 통지서) ----
  const noticesRef = ref(db, 'annualLeaveNotices');
  let leaveNotices = {};
  let editingNoticeId = null;
  let viewingNoticeId = null;

  onValue(noticesRef, (snap) => { leaveNotices = snap.val() || {}; try { renderNotices(); } catch(e) { console.error(e); } });

  function noticeStatusLabel(s) {
    if (s === 'issued') return '발행됨';
    if (s === 'draft') return '작성중';
    if (s === 'submitted') return '제출됨';
    if (s === 'approved') return '승인완료';
    return s || '-';
  }
  function noticeStatusBadge(s) {
    var bg, color;
    if (s === 'approved') { bg='rgba(75,156,255,0.15)'; color='var(--blue)'; }
    else if (s === 'submitted') { bg='rgba(139,92,246,0.15)'; color='var(--accent)'; }
    else if (s === 'draft') { bg='rgba(251,146,60,0.15)'; color='#fb923c'; }
    else { bg='rgba(163,163,163,0.15)'; color='var(--text-dim)'; }
    return '<span style="background:'+bg+';color:'+color+';padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;white-space:nowrap;">'+noticeStatusLabel(s)+'</span>';
  }

  function calcRemaining(empId) {
    var emp = leaveEmployees[empId];
    if (!emp) return 0;
    var total = emp.hireDate ? (calcTotalLeave ? calcTotalLeave(emp.hireDate) : (emp.totalLeave||15)) : (emp.totalLeave||15);
    var usedHours = (typeof getLeaveUsedHours==='function') ? getLeaveUsedHours(empId) : 0;
    return Math.max(0, total - (usedHours/8));
  }

  window._openIssueNoticeModal = function() {
    editingNoticeId = null;
    var sel = document.getElementById('ni-emp');
    sel.innerHTML = '<option value="">직원 선택</option>' + Object.entries(leaveEmployees).map(function(e){
      return '<option value="'+e[0]+'">'+esc(e[1].name||'')+(e[1].team?' ('+esc(e[1].team)+')':'')+'</option>';
    }).join('');
    ['ni-birth','ni-dept','ni-position','ni-hire','ni-total','ni-used','ni-remain','ni-accruedate'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('ni-under1y').checked = false;
    var yr = new Date().getFullYear();
    document.getElementById('ni-accrue-start').value = yr + '-01-01';
    document.getElementById('ni-accrue-end').value = yr + '-12-31';
    document.getElementById('ni-usage-start').value = yr + '-01-01';
    document.getElementById('ni-usage-end').value = yr + '-12-31';
    document.getElementById('issueNoticeModal').classList.add('open');
  };
  window._onIssueEmpSelect = function() {
    var empId = document.getElementById('ni-emp').value;
    var emp = leaveEmployees[empId];
    if (!emp) return;
    document.getElementById('ni-dept').value = emp.team || '';
    document.getElementById('ni-position').value = emp.position && emp.position !== '\uc77c\ubc18' ? emp.position : '';
    document.getElementById('ni-hire').value = emp.hireDate || '';
    document.getElementById('ni-accruedate').value = emp.hireDate || '';
    var total = emp.hireDate && typeof calcTotalLeave==='function' ? calcTotalLeave(emp.hireDate) : (emp.totalLeave||15);
    var usedHours = (typeof getLeaveUsedHours==='function') ? getLeaveUsedHours(empId) : 0;
    var usedDays = +(usedHours/8).toFixed(1);
    var remainDays = +((total - usedDays)).toFixed(1);
    document.getElementById('ni-total').value = total;
    document.getElementById('ni-used').value = usedDays;
    document.getElementById('ni-remain').value = remainDays;
    if (emp.hireDate) {
      var hd = new Date(emp.hireDate);
      var now = new Date();
      var months = (now.getFullYear()-hd.getFullYear())*12 + (now.getMonth()-hd.getMonth());
      document.getElementById('ni-under1y').checked = months < 12;
    }
  };
  window._submitIssueNotice = async function() {
    var empId = document.getElementById('ni-emp').value;
    if (!empId) { showNotif('직원을 선택해주세요', true); return; }
    var emp = leaveEmployees[empId] || {};
    var data = {
      employee: {
        empId: empId,
        name: emp.name || '',
        birthDate: document.getElementById('ni-birth').value,
        department: document.getElementById('ni-dept').value.trim(),
        position: document.getElementById('ni-position').value.trim()
      },
      leaveInfo: {
        hireDate: document.getElementById('ni-hire').value,
        isUnder1Year: document.getElementById('ni-under1y').checked,
        accrueDate: document.getElementById('ni-accruedate').value,
        totalDays: parseFloat(document.getElementById('ni-total').value) || 0,
        usedDays: parseFloat(document.getElementById('ni-used').value) || 0,
        remainingDays: parseFloat(document.getElementById('ni-remain').value) || 0,
        accrualPeriod: { start: document.getElementById('ni-accrue-start').value, end: document.getElementById('ni-accrue-end').value },
        usagePeriod: { start: document.getElementById('ni-usage-start').value, end: document.getElementById('ni-usage-end').value }
      },
      noticeDate: new Date().toISOString(),
      plan: [],
      status: 'issued',
      createdAt: new Date().toISOString(),
      createdBy: window._userEmail || ''
    };
    if (!data.employee.department) { showNotif('부서를 입력해주세요', true); return; }
    if (!data.leaveInfo.usagePeriod.start || !data.leaveInfo.usagePeriod.end) { showNotif('사용대상기간을 입력해주세요', true); return; }
    var btn = document.getElementById('issueNoticeBtn');
    btn.disabled = true; btn.textContent = '발행 중...';
    try {
      await push(noticesRef, data);
      showNotif(data.employee.name + ' 통지서가 발행되었습니다');
      document.getElementById('issueNoticeModal').classList.remove('open');
    } catch(e) { showNotif('발행 실패: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '발행';
  };

  function buildPlanRowsHTML(plan, readonly) {
    var html = '';
    for (var i=0; i<7; i++) {
      var row = (plan && plan[i]) || { startDate:'', endDate:'', days:'', note:'' };
      var ro = readonly ? 'readonly' : '';
      html += '<tr>'
        + '<td style="text-align:center;font-weight:700;">'+(i+1)+'</td>'
        + '<td><input type="date" data-pi="'+i+'" data-pf="startDate" '+ro+' value="'+esc(row.startDate||'')+'" oninput="window._onPlanChange('+i+')" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:12px;"></td>'
        + '<td><input type="date" data-pi="'+i+'" data-pf="endDate" '+ro+' value="'+esc(row.endDate||'')+'" oninput="window._onPlanChange('+i+')" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:12px;"></td>'
        + '<td><input type="number" step="0.5" min="0" data-pi="'+i+'" data-pf="days" '+ro+' value="'+esc(row.days||'')+'" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:12px;text-align:center;"></td>'
        + '<td><input type="text" data-pi="'+i+'" data-pf="note" '+ro+' value="'+esc(row.note||'')+'" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:12px;" placeholder="비고"></td>'
        + '</tr>';
    }
    return html;
  }
  window._onPlanChange = function(i) {
    var s = document.querySelector('[data-pi="'+i+'"][data-pf="startDate"]').value;
    var e = document.querySelector('[data-pi="'+i+'"][data-pf="endDate"]').value;
    if (s && e) {
      var d1 = new Date(s), d2 = new Date(e);
      var diff = Math.floor((d2-d1)/86400000) + 1;
      if (diff > 0) document.querySelector('[data-pi="'+i+'"][data-pf="days"]').value = diff;
    }
  };
  function collectPlan(readonly) {
    var plan = [];
    for (var i=0; i<7; i++) {
      var s = document.querySelector('[data-pi="'+i+'"][data-pf="startDate"]');
      if (!s) continue;
      var sv = s.value;
      var ev = document.querySelector('[data-pi="'+i+'"][data-pf="endDate"]').value;
      var dv = document.querySelector('[data-pi="'+i+'"][data-pf="days"]').value;
      var nv = document.querySelector('[data-pi="'+i+'"][data-pf="note"]').value;
      if (sv || ev || dv || nv) {
        plan.push({ startDate:sv, endDate:ev, days:parseFloat(dv)||0, note:nv });
      }
    }
    return plan;
  }

  window._openFillNoticeModal = function(id) {
    var n = leaveNotices[id]; if (!n) return;
    editingNoticeId = id;
    var info = n.employee || {}; var li = n.leaveInfo || {};
    var html = '<strong>대상자:</strong> '+esc(info.name||'')+' / '+esc(info.department||'')+' / '+esc(info.position||'')
      + '<br><strong>입사일:</strong> '+esc(li.hireDate||'-')+(li.isUnder1Year?' (1년 미만)':'')
      + '<br><strong>연차발생:</strong> '+li.totalDays+'일 / <strong>사용:</strong> '+li.usedDays+'일 / <strong>잔여:</strong> <span style="color:var(--accent);font-weight:700;">'+li.remainingDays+'일</span>'
      + '<br><strong>발생대상기간:</strong> '+esc((li.accrualPeriod||{}).start||'-')+' ~ '+esc((li.accrualPeriod||{}).end||'-')
      + '<br><strong>사용대상기간:</strong> '+esc((li.usagePeriod||{}).start||'-')+' ~ '+esc((li.usagePeriod||{}).end||'-');
    document.getElementById('fillNoticeInfo').innerHTML = html;
    var readonly = (n.status === 'submitted' || n.status === 'approved');
    document.getElementById('fill-plan-tbody').innerHTML = buildPlanRowsHTML(n.plan, readonly);
    document.getElementById('fillNoticeSaveBtn').style.display = readonly ? 'none' : '';
    document.getElementById('fillNoticeSubmitBtn').style.display = readonly ? 'none' : '';
    document.getElementById('fillNoticeModal').classList.add('open');
  };
  window._saveNoticeDraft = async function() {
    if (!editingNoticeId) return;
    var plan = collectPlan();
    try {
      await update(ref(db, 'annualLeaveNotices/' + editingNoticeId), { plan: plan, status: 'draft', updatedAt: new Date().toISOString() });
      showNotif('임시저장되었습니다');
    } catch(e) { showNotif('저장 실패: ' + e.message, true); }
  };
  window._submitNoticePlan = async function() {
    if (!editingNoticeId) return;
    var plan = collectPlan();
    if (!plan.length) { showNotif('사용계획을 1행 이상 입력해주세요', true); return; }
    if (!confirm('제출 후에는 수정할 수 없습니다. 제출하시겠습니까?')) return;
    try {
      await update(ref(db, 'annualLeaveNotices/' + editingNoticeId), { plan: plan, status: 'submitted', submittedAt: new Date().toISOString(), submittedBy: window._userEmail||'', updatedAt: new Date().toISOString() });
      showNotif('통지서가 제출되었습니다');
      document.getElementById('fillNoticeModal').classList.remove('open');
    } catch(e) { showNotif('제출 실패: ' + e.message, true); }
  };

  window._approveNotice = async function() {
    if (!viewingNoticeId) return;
    var n = leaveNotices[viewingNoticeId]; if (!n) return;
    if (n.status !== 'submitted') { showNotif('제출된 통지서만 승인 가능합니다', true); return; }
    if (!confirm('이 통지서를 승인하시겠습니까?')) return;
    var nowStr = new Date().toISOString();
    try {
      await update(ref(db, 'annualLeaveNotices/' + viewingNoticeId), { status: 'approved', approval: { approved: true, timestamp: nowStr, approverEmail: window._userEmail||'', approverName: window._userName||'' }, updatedAt: nowStr });
      showNotif('승인 완료');
      document.getElementById('noticePrintModal').classList.remove('open');
    } catch(e) { showNotif('승인 실패: ' + e.message, true); }
  };

  function buildNoticeFormHTML(n) {
    if (!n) return '<div style="padding:30px;text-align:center;color:#999;">통지서를 찾을 수 없습니다</div>';
    var emp = n.employee || {};
    var li = n.leaveInfo || {};
    var ap = li.accrualPeriod || {}; var up = li.usagePeriod || {};
    var plan = n.plan || [];
    var noticeDateStr = n.noticeDate ? n.noticeDate.split('T')[0] : '';
    var approval = n.approval || {};
    var border = 'border:1px solid #000;';
    var hdr = 'border:1px solid #000;background:#f0f0f0;text-align:center;font-weight:600;padding:6px 8px;font-size:12px;';
    var cell = 'border:1px solid #000;padding:7px 10px;font-size:12px;';
    function fmtRange(p) {
      if (!p.start && !p.end) return '20  년  월  일 ~ 20  년  월  일';
      return (p.start||'____-__-__') + ' ~ ' + (p.end||'____-__-__');
    }
    var planRows = '';
    for (var i=0; i<7; i++) {
      var r = plan[i] || {};
      planRows += '<tr>'
        + '<td style="'+cell+'text-align:center;width:40px;">'+(i+1)+'</td>'
        + '<td style="'+cell+'">'+esc(r.startDate||'')+(r.startDate&&r.endDate?'  ~  ':'')+esc(r.endDate||'')+'</td>'
        + '<td style="'+cell+'text-align:center;width:90px;">'+(r.days?(r.days+'일'):'')+'</td>'
        + '<td style="'+cell+'width:140px;">'+esc(r.note||'')+'</td>'
        + '</tr>';
    }
    var html = '<div style="font-family:\'Malgun Gothic\',\'맑은 고딕\',sans-serif;color:#000;background:#fff;padding:24px 28px;max-width:740px;margin:0 auto;font-size:13px;">'
      + '<div style="font-size:11px;text-align:left;margin-bottom:6px;">[별지-확인서식 제22호]</div>'
      + '<div style="text-align:center;font-size:20px;font-weight:700;padding:14px 0 18px;">연차휴가 사용일 지정 통지서</div>'
      + '<div style="font-weight:700;margin-bottom:6px;">1. 대상근로자</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">'
      + '<tr><td style="'+hdr+'width:20%;">성명</td><td style="'+cell+'width:30%;">'+esc(emp.name||'')+'</td>'
      + '<td style="'+hdr+'width:20%;">생년월일</td><td style="'+cell+'width:30%;">'+esc(emp.birthDate||'')+'</td></tr>'
      + '<tr><td style="'+hdr+'">부서</td><td style="'+cell+'">'+esc(emp.department||'')+'</td>'
      + '<td style="'+hdr+'">직책/직무</td><td style="'+cell+'">'+esc(emp.position||'')+'</td></tr>'
      + '</table>'
      + '<div style="font-weight:700;margin-bottom:6px;">2. 세부 내용</div>'
      + '<div style="margin-bottom:8px;line-height:1.7;">「근로기준법」 제61조 연차휴가의 사용촉진 조항에 근거하여 「잔여 연차유급휴가 사용일」을 지정하여 통지합니다.</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">'
      + '<tr><td style="'+hdr+'width:24%;">입사일</td><td style="'+cell+'width:26%;">'+esc(li.hireDate||'')+'</td>'
      + '<td style="'+hdr+'width:24%;">1년 미만</td><td style="'+cell+'width:26%;text-align:center;">'+(li.isUnder1Year?' 해당':' 해당')+'</td></tr>'
      + '<tr><td style="'+hdr+'">발생일</td><td style="'+cell+'">'+esc(li.accrueDate||'')+'</td>'
      + '<td style="'+hdr+'">연차발생일수</td><td style="'+cell+'text-align:center;font-weight:700;">'+(li.totalDays||0)+'일</td></tr>'
      + '<tr><td style="'+hdr+'">사용일</td><td style="'+cell+'">'+(li.usedDays||0)+'일</td>'
      + '<td style="'+hdr+'">잔여연차일수</td><td style="'+cell+'text-align:center;font-weight:700;color:#c00;">'+(li.remainingDays||0)+'일</td></tr>'
      + '<tr><td style="'+hdr+'">발생대상기간</td><td colspan="3" style="'+cell+'">'+fmtRange(ap)+'</td></tr>'
      + '<tr><td style="'+hdr+'">사용대상기간</td><td colspan="3" style="'+cell+'">'+fmtRange(up)+'</td></tr>'
      + '</table>'
      + '<div style="font-weight:700;margin-bottom:6px;">3. 휴가 사용계획서 제출</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">'
      + '<thead><tr>'
      + '<td style="'+hdr+'width:40px;">구분</td>'
      + '<td style="'+hdr+'">사용일자 (시작일 / 종료일)</td>'
      + '<td style="'+hdr+'width:90px;">휴가사용일수</td>'
      + '<td style="'+hdr+'width:140px;">비고</td>'
      + '</tr></thead><tbody>' + planRows + '</tbody></table>'
      + '<div style="margin:18px 0 6px;">* 휴가사용일 지정 통지일: ' + esc(noticeDateStr) + '</div>'
      + '<div style="text-align:center;margin-top:24px;font-size:14px;font-weight:700;">회사명: 케이지모빌리티성수서비스센터(주)</div>';
    if (approval.approved) {
      var apDate = approval.timestamp ? approval.timestamp.replace('T',' ').slice(0,16) : '';
      html += '<div style="margin-top:20px;border:2px solid #c00;padding:14px 16px;text-align:right;font-size:12px;">'
        + '<div style="font-weight:700;color:#c00;margin-bottom:4px;">[ 결재 완료 ]</div>'
        + '<div>승인자: <strong>' + esc(approval.approverName||approval.approverEmail||'') + '</strong></div>'
        + '<div>승인일시: ' + esc(apDate) + '</div>'
        + '</div>';
    }
    html += '</div>';
    return html;
  }

  window._openNoticePrintView = function(id) {
    var n = leaveNotices[id]; if (!n) { showNotif('통지서를 찾을 수 없습니다', true); return; }
    viewingNoticeId = id;
    document.getElementById('noticePrintContent').innerHTML = buildNoticeFormHTML(n);
    var apBtn = document.getElementById('noticeApproveBtn');
    if (apBtn) apBtn.style.display = (window._userRole==='admin' && n.status==='submitted') ? '' : 'none';
    document.getElementById('noticePrintModal').classList.add('open');
  };
  window._printNotice = function() {
    if (!viewingNoticeId) return;
    var n = leaveNotices[viewingNoticeId]; if (!n) return;
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연차휴가 사용일 지정 통지서</title>'
      + '<style>@page{size:A4;margin:18mm 16mm;}body{margin:0;padding:0;background:#fff;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>'
      + '</head><body>' + buildNoticeFormHTML(n) + '</body></html>';
    var w = window.open('', '_blank', 'width=820,height=1100');
    if (!w) { showNotif('팝업 차단 시 인쇄 안 됩니다', true); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(function(){ try { w.print(); } catch(e){} }, 300);
  };
  window._deleteNotice = async function(id) {
    if (window._userRole !== 'admin') return;
    if (!confirm('이 통지서를 삭제하시겠습니까?')) return;
    try { await remove(ref(db, 'annualLeaveNotices/' + id)); showNotif('삭제되었습니다'); }
    catch(e) { showNotif('삭제 실패: ' + e.message, true); }
  };

  function renderNotices() {
    var tbody = document.getElementById('notice-tbody');
    var empty = document.getElementById('notice-empty');
    if (!tbody) return;
    var isAdmin = window._userRole === 'admin';
    var myEmp = (typeof getMyEmpRecord==='function') ? getMyEmpRecord() : null;
    var all = Object.entries(leaveNotices).map(function(e){ return Object.assign({id:e[0]}, e[1]); });
    var visible = isAdmin ? all : all.filter(function(n){ return myEmp && n.employee && n.employee.empId === myEmp.id; });
    if (isAdmin) {
      var filterStatus = (document.getElementById('noticeFilterStatus')||{}).value || '';
      if (filterStatus) visible = visible.filter(function(n){ return n.status === filterStatus; });
    }
    visible.sort(function(a,b){ return new Date(b.createdAt||b.noticeDate) - new Date(a.createdAt||a.noticeDate); });
    if (!visible.length) { tbody.innerHTML=''; if (empty) empty.style.display='block'; return; }
    if (empty) empty.style.display='none';
    tbody.innerHTML = visible.map(function(n) {
      var emp = n.employee || {}; var li = n.leaveInfo || {}; var up = li.usagePeriod || {};
      var actions = '<div style="display:flex;gap:5px;flex-wrap:wrap;">';
      var isMyNotice = myEmp && emp.empId === myEmp.id;
      var canFill = isMyNotice && (n.status === 'issued' || n.status === 'draft');
      if (canFill) actions += '<button class="btn btn-primary btn-sm" onclick="window._openFillNoticeModal(\''+esc(n.id)+'\')"> 작성</button>';
      actions += '<button class="btn btn-ghost btn-sm" onclick="window._openNoticePrintView(\''+esc(n.id)+'\')"> 보기</button>';
      if (isAdmin && n.status !== 'approved') actions += '<button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);" onclick="window._deleteNotice(\''+esc(n.id)+'\')">삭제</button>';
      actions += '</div>';
      return '<tr><td><strong>'+esc(emp.name||'-')+'</strong></td><td style="font-size:12px;">'+esc(emp.department||'-')+'</td><td style="text-align:center;font-weight:700;color:var(--accent);">'+(li.remainingDays||0)+'일</td><td style="font-size:11px;">'+esc(up.start||'-')+' ~ '+esc(up.end||'-')+'</td><td>'+noticeStatusBadge(n.status)+'</td><td style="font-size:11px;color:var(--text-dim);">'+esc((n.noticeDate||'').split('T')[0])+'</td><td>'+actions+'</td></tr>';
    }).join('');
  }
  window._renderNotices = renderNotices;

  window._confirmReject = async function() {
    if (!editingRejectId) return;
    var reason = document.getElementById('reject-reason').value.trim();
    if (!reason) { showNotif('\ubc18\ub824 \uc0ac\uc720\ub97c \uc785\ub825\ud574\uc8fc\uc138\uc694', true); return; }
    var btn = document.getElementById('rejectConfirmBtn');
    btn.disabled = true; btn.textContent = '\ucc98\ub9ac \uc911...';
    try {
      await update(ref(db, 'leaveRequests/' + editingRejectId), { status: 'rejected', rejectedAt: new Date().toISOString(), rejectedBy: window._userEmail || '', rejectedReason: reason, rejectedAtStage: editingRejectStage });
      document.getElementById('rejectModal').classList.remove('open');
      showNotif('\ubc18\ub824 \ucc98\ub9ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
    } catch(e) { showNotif('\ubc18\ub824 \uc2e4\ud328: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '\ubc18\ub824';
    editingRejectId = null; editingRejectStage = null;
  };

  function renderMyRequests() {
    var tbody = document.getElementById('myreq-tbody');
    var empty = document.getElementById('myreq-empty');
    if (!tbody) return;
    var myEmp = getMyEmpRecord();
    if (!myEmp) { tbody.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
    var list = Object.entries(leaveRequests).filter(function(e){ return e[1] && e[1].empId === myEmp.id; }).map(function(e){ return Object.assign({id:e[0]}, e[1]); });
    list.sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
    if (!list.length) { tbody.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = list.map(function(r) {
      var typeText = r.type + (r.hours ? ' '+r.hours+'h' : '');
      var canCancel = (r.status === 'pending_manager' || r.status === 'pending_admin' || r.status === 'pending_director');
      var viewBtn = '<button class="btn btn-ghost btn-sm" onclick="window._openRequestPrintView(\''+esc(r.id)+'\')">\uc591\uc2dd</button>';
      var afterBtn = canCancel
        ? '<button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);" onclick="window._cancelMyRequest(\''+esc(r.id)+'\')">\ucde8\uc18c</button>'
        : (r.status === 'rejected' && r.rejectedReason ? '<span style="font-size:11px;color:var(--text-dim);" title="'+esc(r.rejectedReason)+'">\uc0ac\uc720: '+esc(r.rejectedReason).slice(0,20)+'</span>' : '');
      var actionCell = '<div style="display:flex;gap:5px;align-items:center;">'+viewBtn+afterBtn+'</div>';
      return '<tr><td>'+esc(typeText)+'</td><td>'+esc(r.date||'-')+'</td><td>'+esc(r.reason||'-')+'</td><td>'+reqStatusBadge(r.status)+'</td><td style="font-size:11px;color:var(--text-dim);">'+esc((r.createdAt||'').split('T')[0])+'</td><td>'+actionCell+'</td></tr>';
    }).join('');
  }
  function renderApprovalQueue() {
    var section = document.getElementById('approval-section');
    var tbody = document.getElementById('approval-tbody');
    var empty = document.getElementById('approval-empty');
    if (!tbody || !section) return;
    var myEmp = getMyEmpRecord();
    var isAdmin = window._userRole === 'admin';
    var canBeApprover = isAdmin || (myEmp && (myEmp.position === '\ubd80\uc11c\uc7a5' || myEmp.position === '\ub300\ud45c'));
    if (!canBeApprover) { section.style.display = 'none'; return; }
    section.style.display = '';
    var allReq = Object.entries(leaveRequests).map(function(e){ return Object.assign({id:e[0]}, e[1]); });
    function userCanActOn(r) {
      if (!canApproveStage(r.status, myEmp)) return false;
      if (r.status === 'pending_manager') {
        var reqEmp = leaveEmployees[r.empId];
        if (!reqEmp) return false;
        if (myEmp && reqEmp.team !== myEmp.team) return false;
      }
      return true;
    }
    var visible = allReq.filter(function(r) {
      var isPending = (r.status === 'pending_manager' || r.status === 'pending_admin' || r.status === 'pending_director');
      // 관리자: 진행중 + 승인 후 미확인 모두 표시
      if (isAdmin) return isPending || (r.status === 'approved' && !r.adminAcknowledged);
      // 비관리자: 본인이 처리 가능한 진행중만
      return isPending && userCanActOn(r);
    });
    visible.sort(function(a,b){ return new Date(a.createdAt) - new Date(b.createdAt); });
    if (!visible.length) { tbody.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = visible.map(function(r) {
      var emp = leaveEmployees[r.empId];
      var name = emp ? emp.name : '(\uc0ad\uc81c\ub428)';
      var team = emp ? (emp.team || '-') : '-';
      var typeText = r.type + (r.hours ? ' '+r.hours+'h' : '');
      var viewBtn = '<button class="btn btn-ghost btn-sm" onclick="window._openRequestPrintView(\''+esc(r.id)+'\')">\uc591\uc2dd</button>';
      var actBtns;
      var rowStyle = '';
      if (r.status === 'approved') {
        // 승인 완료, 관리자 확인 대기
        actBtns = '<button class="btn btn-primary btn-sm" style="background:#22c55e;border-color:#22c55e;" onclick="window._acknowledgeRequest(\''+esc(r.id)+'\')">\u2705 \uc778\uc1c4 \uc644\ub8cc \ud655\uc778</button>';
        rowStyle = ' style="background:rgba(75,156,255,0.05);"';
      } else if (userCanActOn(r)) {
        actBtns = '<button class="btn btn-primary btn-sm" onclick="window._approveRequest(\''+esc(r.id)+'\')">\uc2b9\uc778</button><button class="btn btn-sm" style="background:rgba(232,68,42,0.15);color:var(--red);border:1px solid rgba(232,68,42,0.3);" onclick="window._openRejectModal(\''+esc(r.id)+'\')">\ubc18\ub824</button>';
      } else {
        actBtns = '<span style="font-size:11px;color:var(--text-dim);">' + (r.status==='pending_manager'?(team+' \ubd80\uc11c\uc7a5'):(r.status==='pending_admin'?'\uad00\ub9ac\uc790':'\ub300\ud45c')) + ' \ub300\uae30 \uc911</span>';
      }
      var actions = '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">'+viewBtn+actBtns+'</div>';
      return '<tr'+rowStyle+'><td><strong>'+esc(name)+'</strong></td><td style="font-size:12px;">'+esc(team)+'</td><td>'+esc(typeText)+'</td><td>'+esc(r.date||'-')+'</td><td>'+esc(r.reason||'-')+'</td><td>'+reqStatusBadge(r.status)+'</td><td>'+actions+'</td></tr>';
    }).join('');
  }
  window._renderMyRequests = renderMyRequests;
  window._renderApprovalQueue = renderApprovalQueue;

  window._deleteLeaveEmp = async function(id, name) {
    if (!confirm(name + ' \uc9c1\uc6d0\uc744 \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?\n\ud574\ub2f9 \uc9c1\uc6d0\uc758 \uc5f0\ucc28 \uc0ac\uc6a9 \ub0b4\uc5ed\ub3c4 \ubaa8\ub450 \uc0ad\uc81c\ub429\ub2c8\ub2e4.')) return;
    try {
      await remove(ref(db, 'leaveEmployees/' + id));
      var toDelete = Object.entries(leaveUsage).filter(function(e){return e[1].empId===id;});
      for (var d of toDelete) { await remove(ref(db, 'leaveUsage/' + d[0])); }
      showNotif(name + ' \uc9c1\uc6d0\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
    } catch(e) { showNotif('\uc0ad\uc81c \uc2e4\ud328: ' + e.message, true); }
  };
  window._openLeaveUseModal = function() {
    document.getElementById('lu-emp').value = '';
    document.getElementById('lu-type').value = '\uc5f0\ucc28';
    document.getElementById('lu-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('lu-reason').value = '';
    document.getElementById('lu-hours').value = '1';
    document.getElementById('lu-hours-group').style.display = 'none';
    document.getElementById('leaveUseModal').classList.add('open');
  };
  window._saveLeaveUse = async function() {
    var empId = document.getElementById('lu-emp').value;
    var type = document.getElementById('lu-type').value;
    var date = document.getElementById('lu-date').value;
    var reason = document.getElementById('lu-reason').value.trim();
    var hours = (type === '\uc870\ud1f4' || type === '\uc678\ucd9c') ? parseInt(document.getElementById('lu-hours').value) || 1 : 0;
    if (!empId) { showNotif('\uc9c1\uc6d0\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694', true); return; }
    if (!date) { showNotif('\uc0ac\uc6a9\uc77c\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694', true); return; }
    var emp = leaveEmployees[empId];
    var usedHours = getLeaveUsedHours(empId);
    var autoTotal = (emp && emp.hireDate) ? calcTotalLeave(emp.hireDate) : (emp ? emp.totalLeave || 15 : 15);
    var totalHours = autoTotal * 8;
    var addHours = (type === '\uc5f0\ucc28') ? 8 : (type === '\uc624\uc804\ubc18\ucc28' || type === '\uc624\ud6c4\ubc18\ucc28') ? 4 : hours;
    if ((usedHours + addHours) > totalHours) {
      showNotif(emp.name + '\uc758 \uc794\uc5ec \uc5f0\ucc28\uac00 \ubd80\uc871\ud569\ub2c8\ub2e4! (\uc794\uc5ec: ' + formatDayHour(Math.max(0, totalHours - usedHours)) + ')', true); return;
    }
    var btn = document.getElementById('leaveUseSaveBtn');
    btn.disabled = true; btn.textContent = '\ub4f1\ub85d \uc911...';
    try {
      var saveData = { empId: empId, type: type, date: date, reason: reason, createdAt: new Date().toISOString() };
      if (hours > 0) saveData.hours = hours;
      await push(leaveUseRef, saveData);
      showNotif(type + '\uc774 \ub4f1\ub85d\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
      document.getElementById('leaveUseModal').classList.remove('open');
    } catch(e) { showNotif('\ub4f1\ub85d \uc2e4\ud328: ' + e.message, true); }
    btn.disabled = false; btn.textContent = '\ub4f1\ub85d';
  };
  window._deleteLeaveUse = async function(id) {
    if (!confirm('\uc774 \uc0ac\uc6a9 \ub0b4\uc5ed\uc744 \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?')) return;
    try { await remove(ref(db, 'leaveUsage/' + id)); showNotif('\uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4'); }
    catch(e) { showNotif('\uc0ad\uc81c \uc2e4\ud328: ' + e.message, true); }
  };
