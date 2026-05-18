// 페이지 전환·UI 핸들러 (un-v2 리팩토링 3단계)

  // PAGE SWITCH
  function switchPage(name) {
    document.body.setAttribute('data-page', name);
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    var el = document.getElementById('page-'+name);
    if(el) el.classList.add('active');
    var opsGroup = document.getElementById('opsNavGroup');
    if (opsGroup && ['list','status','complete','out'].indexOf(name) >= 0) {
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
      if (name==='complete' && window._renderComplete) window._renderComplete();
      if (name==='out' && window._renderOut) window._renderOut();
      if (name==='usermgmt') { if(window.loadUserMgmt) window.loadUserMgmt(); if(window._renderOrgChart) window._renderOrgChart(); }
      if (name==='leave' && window._renderLeave) window._renderLeave();
      if (name==='board') { if(window._renderBoard) window._renderBoard(); if(window._renderCalendar) window._renderCalendar(); }
      if (name==='insurance' && window._renderInsurance) window._renderInsurance();
      if (name==='blacklist' && window._renderBlacklist) window._renderBlacklist();
      if (name==='sales' && window._renderSalesWidget) window._renderSalesWidget();
    } catch(e) {
      alert('switchPage 에러: ' + e.message);
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
