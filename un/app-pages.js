// 페이지 전환·UI 핸들러 (un-v2 리팩토링 3단계)

  // ── 미니 확인 모달 (브라우저 confirm() 대체) ──
  window._confirm = function(msg, yesLabel, noLabel) {
    return new Promise(function(resolve) {
      var modal = document.getElementById('miniConfirmModal');
      var msgEl  = document.getElementById('miniConfirmMsg');
      var yesBtn = document.getElementById('miniConfirmYes');
      var noBtn  = document.getElementById('miniConfirmNo');
      if (!modal || !msgEl || !yesBtn || !noBtn) { resolve(window.confirm(msg)); return; }
      msgEl.textContent = msg;
      yesBtn.textContent = yesLabel || '확인';
      noBtn.textContent  = noLabel  || '취소';
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      function done(val) {
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        modal.classList.remove('open');
        document.body.style.overflow = '';
        resolve(val);
      }
      function onYes() { done(true); }
      function onNo()  { done(false); }
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  };

  // PAGE SWITCH
  function switchPage(name) {
    if (name === 'reservation' && window._userRole !== 'admin') { console.warn('예약 현황판 접근 차단'); return; }
    document.body.setAttribute('data-page', name);
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    var el = document.getElementById('page-'+name);
    if(el) el.classList.add('active');
    var opsGroup = document.getElementById('opsNavGroup');
    if (opsGroup && ['list','status','complete','out','reservation'].indexOf(name) >= 0) {
      opsGroup.classList.add('nav-group-open', 'active');
    } else if (opsGroup) {
      opsGroup.classList.remove('active');
    }
    var tabEls = document.querySelectorAll('.nav-tab');
    tabEls.forEach(function(t){
      var pg = t.getAttribute('onclick');
      if(pg) { var m = pg.match(/switchPage\('(.+?)'\)/); if(m && m[1]===name) t.classList.add('active'); }
    });
    try {
      if (name==='list' && window._renderList) window._renderList();
      if (name==='status' && window.renderDashboard) window.renderDashboard();
      if (name==='dashboard' && window._renderAosDashboardStrip) window._renderAosDashboardStrip();
      if (name==='complete' && window._renderComplete) window._renderComplete();
      if (name==='out' && window._renderOut) window._renderOut();
      if (name==='usermgmt') { if(window.loadUserMgmt) window.loadUserMgmt(); if(window._renderOrgChart) window._renderOrgChart(); }
      if (name==='leave' && window._renderLeave) window._renderLeave();
      if (name==='board') { if(window._renderBoardNotices) window._renderBoardNotices(); if(window._renderBoard) window._renderBoard(); if(window._renderCalendar) window._renderCalendar(); }
      if (name==='insurance' && window._renderInsurance) window._renderInsurance();
      if (name==='vendors' && window._renderVendors) window._renderVendors();
      if (name==='reservation' && window._renderReservationBoard) window._renderReservationBoard();
      if (name==='blacklist' && window._renderBlacklist) window._renderBlacklist();
      if (name==='sales') { if(window._renderSalesReport) window._renderSalesReport(); if(window._renderAosReport) window._renderAosReport(); }
    } catch(e) {
      console.error('switchPage 에러 [' + name + ']:', e);
    }
  }

  function toggleOpsNav() {
    var group = document.getElementById('opsNavGroup');
    if (group) group.classList.toggle('nav-group-open');
  }
  window.toggleOpsNav = toggleOpsNav;

  // DATE
  function updateDate() {
    const now = new Date();
    const days = ['일','월','화','수','목','금','토'];
    const label = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${days[now.getDay()]})`;
    const dateDisplay = document.getElementById('dateDisplay');
    const dashboardDateDisplay = document.getElementById('dashboardDateDisplay');
    if (dateDisplay) dateDisplay.textContent = label;
    if (dashboardDateDisplay) dashboardDateDisplay.textContent = label;
  }
  updateDate();
  setInterval(updateDate, 60000);
  (function initActivePageFlag(){
    var active = document.querySelector('.page.active');
    if (active) document.body.setAttribute('data-page', active.id.replace('page-', ''));
  })();

  // CLOSE MODAL ON OVERLAY CLICK
  // formModal은 백드롭 클릭으로 닫지 않음 — 입력 중 실수로 작업 날아가는 사고 방지.
  // 닫으려면 ✕ 버튼 또는 취소 버튼 사용.
  document.getElementById('locPickerModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
  document.getElementById('statusPickerModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
  document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
  document.getElementById('insDetailModal').addEventListener('click', function(e) {
    if (e.target === this) closeInsDetail();
  });
  var _insMo = document.getElementById('insuranceModal');
  if (_insMo) _insMo.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
  var _photoMo = document.getElementById('photoModal');
  if (_photoMo) _photoMo.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
  // 공지 작성 모달은 백드롭 클릭으로 닫지 않음 (실수 방지). 팝업은 백드롭 클릭 시 닫음.
  var _ntcPop = document.getElementById('noticePopupModal');
  if (_ntcPop) _ntcPop.addEventListener('click', function(e) {
    if (e.target === this) window._closeBoardNoticePopup && window._closeBoardNoticePopup(false);
  });

  // ── 매출 보고 POS 키패드 모달 ──
  (function() {
    var SK = { cat: null, value: '' };
    var WON_QUICK = [{l:'+1만',d:10000},{l:'+10만',d:100000},{l:'+100만',d:1000000}];
    var CFG = {
      // 일일 매출 보고 항목 (report:true → 즉시 저장 안 함, 카드만 갱신 후 저장 버튼으로 일괄 저장)
      w_labor:  { label: '보증 공임',     color: '#fbbf24', unit: '원', max: 9999999999, report: true, quick: WON_QUICK },
      w_parts:  { label: '보증 부품',     color: '#fbbf24', unit: '원', max: 9999999999, report: true, quick: WON_QUICK },
      f_labor:  { label: '기능 공임',     color: '#34d399', unit: '원', max: 9999999999, report: true, quick: WON_QUICK },
      f_parts:  { label: '기능 부품',     color: '#34d399', unit: '원', max: 9999999999, report: true, quick: WON_QUICK },
      d_labor:  { label: '파손+보험 공임', color: '#ef4444', unit: '원', max: 9999999999, report: true, quick: WON_QUICK },
      d_parts:  { label: '파손+보험 부품', color: '#ef4444', unit: '원', max: 9999999999, report: true, quick: WON_QUICK },
      received: { label: '총 수납금계',   color: '#38bdf8', unit: '원', max: 9999999999, report: true, quick: [{l:'+10만',d:100000},{l:'+100만',d:1000000},{l:'+1000만',d:10000000}] },
      kgm:      { label: 'KGM 정비 대수', color: '#ff8787', unit: '대', max: 999,        report: true, quick: [{l:'+1',d:1},{l:'+5',d:5},{l:'+10',d:10}] },
      // 매달 보고 (즉시 저장)
      deposit:  { label: '이달 보증',     color: '#fbbf24', unit: '원', max: 999999999,  quick: [{l:'+10만',d:100000},{l:'+100만',d:1000000},{l:'+1000만',d:10000000}] }
    };
    var INPUT_ID = { deposit:'deposit-input' };

    function fmtDisp() {
      var n = parseInt(SK.value || '0', 10) || 0;
      var c = CFG[SK.cat]; if (!c) return '0';
      return c.unit === '대' ? (n.toLocaleString('ko-KR') + '대') : ('₩' + n.toLocaleString('ko-KR'));
    }
    function clamp() {
      var n = parseInt(SK.value || '0', 10) || 0;
      var c = CFG[SK.cat]; if (!c) return;
      if (n > c.max) n = c.max;
      if (n < 0) n = 0;
      SK.value = n > 0 ? String(n) : '';
    }
    function refresh() {
      var disp = document.getElementById('skDisplay');
      if (disp) disp.textContent = fmtDisp();
    }

    window.openSalesKeypad = function(cat) {
      var c = CFG[cat]; if (!c) return;
      SK.cat = cat; SK.value = '';
      var overlay = document.getElementById('salesKeypadOverlay');
      var title   = document.getElementById('skModalTitle');
      var dot     = document.getElementById('skModalDot');
      var quick   = document.getElementById('skQuick');
      if (title) title.textContent = c.label;
      if (dot)   dot.style.background = c.color;
      if (quick) {
        quick.innerHTML = c.quick.map(function(q){
          return '<button type="button" data-add="'+q.d+'">'+q.l+'</button>';
        }).join('') + '<button type="button" class="sk-quick-clear" data-act="clear">지움</button>';
      }
      refresh();
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closeSalesKeypad = function() {
      var overlay = document.getElementById('salesKeypadOverlay');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
      SK.cat = null; SK.value = '';
    };

    window.salesKeypadClear = function() { SK.value = ''; refresh(); };

    window.salesKeypadSave = function() {
      if (!SK.cat) return;
      var c = CFG[SK.cat];
      clamp();
      // 일일 매출 보고 항목 — 카드·hidden만 갱신, 저장은 별도 버튼
      if (c && c.report) {
        var n = parseInt(SK.value || '0', 10) || 0;
        var hid = document.getElementById('si-' + SK.cat);
        if (hid) hid.value = String(n);
        var card = document.getElementById('sv-' + SK.cat);
        if (card) card.textContent = c.unit === '대'
          ? (n.toLocaleString('ko-KR') + '대')
          : ('₩' + n.toLocaleString('ko-KR'));
        if (window._refreshSalesReportTotals) window._refreshSalesReportTotals();
        window.closeSalesKeypad();
        return;
      }
      // 매달 보고(deposit 등) — 즉시 저장
      var inp = document.getElementById(INPUT_ID[SK.cat]);
      if (!inp) { window.closeSalesKeypad(); return; }
      inp.value = SK.value || '0';
      var saveBtn = document.querySelector('.sk-save');
      if (saveBtn) saveBtn.disabled = true;
      try {
        if (SK.cat === 'deposit' && window._depositSave) window._depositSave();
      } catch(_) {}
      setTimeout(function(){
        if (saveBtn) saveBtn.disabled = false;
        window.closeSalesKeypad();
      }, 400);
    };

    document.addEventListener('click', function(e) {
      if (!SK.cat) return;
      var key = e.target.closest('.sk-key');
      if (key) {
        var d = key.getAttribute('data-d');
        var act = key.getAttribute('data-act');
        if (act === 'back') {
          SK.value = SK.value.slice(0, -1);
        } else if (d != null) {
          var raw = (SK.value || '') + d;
          raw = raw.replace(/^0+(?=\d)/, '');
          if (raw.length > 12) raw = raw.slice(0, 12);
          SK.value = raw;
        }
        clamp(); refresh(); return;
      }
      var q = e.target.closest('#skQuick button');
      if (q) {
        var qact = q.getAttribute('data-act');
        if (qact === 'clear') {
          SK.value = '';
        } else {
          var add = parseInt(q.getAttribute('data-add'), 10) || 0;
          var cur = parseInt(SK.value || '0', 10) || 0;
          SK.value = String(cur + add);
        }
        clamp(); refresh();
      }
    });

    document.addEventListener('keydown', function(e) {
      var overlay = document.getElementById('salesKeypadOverlay');
      if (!overlay || !overlay.classList.contains('open')) return;
      if (e.key === 'Escape') { window.closeSalesKeypad(); return; }
      if (e.key === 'Enter')  { window.salesKeypadSave(); return; }
      if (e.key === 'Backspace') {
        SK.value = SK.value.slice(0, -1); clamp(); refresh(); e.preventDefault(); return;
      }
      if (/^[0-9]$/.test(e.key)) {
        var raw = (SK.value || '') + e.key;
        raw = raw.replace(/^0+(?=\d)/, '');
        if (raw.length > 12) raw = raw.slice(0, 12);
        SK.value = raw; clamp(); refresh();
      }
    });
  })();
