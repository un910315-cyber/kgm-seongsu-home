// 보험 미결 파싱 — AOS/KGM 볼트 (un-v2 리팩토링 3단계)


// ── 서브 탭 전환 ──────────────────────────────────────
function switchMigyeolTab(tab) {
  document.getElementById('migyeol-aos').style.display = tab==='aos' ? 'block' : 'none';
  document.getElementById('migyeol-bolt').style.display = tab==='bolt' ? 'block' : 'none';
  const aosSub = document.getElementById('sub-tab-aos');
  const boltSub = document.getElementById('sub-tab-bolt');
  if (tab==='aos') {
    aosSub.style.color='var(--accent)'; aosSub.style.borderBottomColor='var(--accent)';
    boltSub.style.color='var(--text-dim)'; boltSub.style.borderBottomColor='transparent';
  } else {
    boltSub.style.color='var(--accent)'; boltSub.style.borderBottomColor='var(--accent)';
    aosSub.style.color='var(--text-dim)'; aosSub.style.borderBottomColor='transparent';
  }
}

// ── 공통: 보험사별 섹션 렌더링 ──────────────────────────
let currentSections = { aos: [], bolt: [] };

function renderSections(type, groups) {
  const sorted = Object.entries(groups).sort((a,b) => {
    const sa = a[1].reduce((s,r)=>s+(Number(r.청구금액)||0),0);
    const sb = b[1].reduce((s,r)=>s+(Number(r.청구금액)||0),0);
    return sb - sa;
  });
  currentSections[type] = sorted;

  const totalCnt = sorted.reduce((s,[,l])=>s+l.length,0);
  const totalAmt = sorted.reduce((s,[,l])=>s+l.reduce((ss,r)=>ss+(Number(r.청구금액)||0),0),0);
  const today = new Date().toLocaleDateString('ko-KR');

  // 요약 카드
  document.getElementById(`${type}-summary-cards`).innerHTML = `
    <div class="stat-card orange"><div class="stat-label">총 미결 건수</div><div class="stat-value" style="color:var(--accent);">${totalCnt}</div><div class="stat-sub">건</div></div>
    <div class="stat-card red"><div class="stat-label">총 미결 금액</div><div class="stat-value" style="color:var(--red);font-size:18px;">${totalAmt.toLocaleString()}</div><div class="stat-sub">원</div></div>
    <div class="stat-card blue"><div class="stat-label">보험사 수</div><div class="stat-value" style="color:var(--blue);">${sorted.length}</div><div class="stat-sub">개사</div></div>
    <div class="stat-card green"><div class="stat-label">기준일</div><div class="stat-value" style="color:var(--green);font-size:14px;">${today}</div><div class="stat-sub">분석일</div></div>
  `;

  // 보험사 카드 목록
  const sectionsEl = document.getElementById(`${type}-sections`);
  sectionsEl.innerHTML = sorted.map(([ins, list], idx) => {
    const amt = list.reduce((s,r)=>s+(Number(r.청구금액)||0),0);
    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="background:#1b3a6b;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="openInsDetail('${type}',${idx})">
        <div>
          <span style="color:#fff;font-size:16px;font-weight:700;">${ins}</span>
          <span style="color:#a8c4e8;font-size:12px;margin-left:12px;">${list.length}건 · ${amt.toLocaleString()}원</span>
          <span style="color:#a8c4e8;font-size:11px;margin-left:8px;"> 클릭하여 상세보기</span>
        </div>
        <span style="color:#fff;font-size:18px;">▶</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById(`${type}-result`).style.display = 'block';
  document.getElementById(`${type}-upload-area`).style.display = 'none';
}

// ── 보험사 상세보기 모달 ───────────────────────────────
function openInsDetail(type, idx) {
  const [ins, list] = currentSections[type][idx];
  const amt = list.reduce((s,r)=>s+(Number(r.청구금액)||0),0);
  const today = new Date().toLocaleDateString('ko-KR');
  const cols = type==='aos'
    ? ['작성일자','접수번호','담보','담당자','차량번호','차량명','청구금액','청구일자','상태','미결메모']
    : ['RO번호','접수번호','차량번호','보험종류','청구금액','청구일자'];

  const thStyle = 'padding:8px 10px;font-size:11px;color:#333;background:#eef3fb;border:1px solid #c8d8f0;white-space:nowrap;';
  const tdStyle = 'padding:7px 10px;font-size:12px;color:#111;border:1px solid #dde3f0;';
  const tdRightStyle = 'padding:7px 10px;font-size:12px;color:#1a4a2e;font-weight:700;border:1px solid #dde3f0;text-align:right;';
  const tdMonoStyle = 'padding:7px 10px;font-size:13px;color:#111;font-weight:800;border:1px solid #dde3f0;text-align:center;letter-spacing:1px;white-space:nowrap;font-family:monospace;';

  const rows = list.map((r,i) => {
    const bg = i%2===0 ? '#f8faff' : '#ffffff';
    if (type==='aos') {
      return `<tr style="background:${bg};">
        <td style="${tdStyle}">${r.작성일자||'-'}</td>
        <td style="${tdStyle}">${r.접수번호||'-'}</td>
        <td style="${tdStyle};text-align:center;">${r.담보||'-'}</td>
        <td style="${tdStyle};text-align:center;">${r.담당자||'-'}</td>
        <td style="${tdMonoStyle}">${r.차량번호||'-'}</td>
        <td style="${tdStyle}">${r.차량명||'-'}</td>
        <td style="${tdRightStyle}">${(Number(r.청구금액)||0).toLocaleString()}</td>
        <td style="${tdStyle}">${r.청구일자||'-'}</td>
        <td style="${tdStyle};text-align:center;">${r.상태||'-'}</td>
        <td style="${tdStyle};color:#555;">${r.미결메모||''}</td>
      </tr>`;
    } else {
      return `<tr style="background:${bg};">
        <td style="${tdStyle}">${r.RO번호||'-'}</td>
        <td style="${tdStyle}">${r.접수번호||'-'}</td>
        <td style="${tdMonoStyle}">${r.차량번호||'-'}</td>
        <td style="${tdStyle};text-align:center;">${r.보험종류||'-'}</td>
        <td style="${tdRightStyle}">${(Number(r.청구금액)||0).toLocaleString()}</td>
        <td style="${tdStyle}">${r.청구일자||'-'}</td>
      </tr>`;
    }
  }).join('');

  document.getElementById('insDetailContent').innerHTML = `
    <div style="background:#1b3a6b;padding:20px 24px;">
      <div style="color:#fff;font-size:20px;font-weight:700;">${ins} 미결 리스트</div>
      <div style="color:#a8c4e8;font-size:12px;margin-top:4px;">${list.length}건 · ${amt.toLocaleString()}원 · 기준일: ${today} · UN Motors (KGM 성수서비스센터)</div>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:800px;">
        <thead><tr>${cols.map(c=>`<th style="${thStyle}">${c}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="${type==='aos'?6:4}" style="padding:9px 10px;font-weight:700;font-size:13px;border:1px solid #c8d8f0;background:#fff8e6;">합 계</td>
          <td style="padding:9px 10px;font-weight:700;font-size:13px;border:1px solid #c8d8f0;background:#fff8e6;text-align:right;color:#1a4a2e;">${amt.toLocaleString()}</td>
          <td colspan="${type==='aos'?3:1}" style="border:1px solid #c8d8f0;background:#fff8e6;"></td>
        </tr></tfoot>
      </table>
    </div>
  `;
  document.getElementById('insDetailModal').style.display = 'block';
  window._printInsHtml = document.getElementById('insDetailContent').innerHTML;
  window._printInsTitle = `${ins} 미결 리스트`;
}

function closeInsDetail() {
  document.getElementById('insDetailModal').style.display = 'none';
}

function printInsDetail() {
  const w = window.open('','_blank','width=1100,height=800');
  if (!w) { alert('팝업이 차단되어 인쇄 창을 열 수 없습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  w.document.write(`<html><head><meta charset="UTF-8"><title>${window._printInsTitle}</title>
  <style>body{font-family:'맑은 고딕',sans-serif;margin:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #c8d8f0;padding:6px 8px;font-size:11px;}th{background:#eef3fb;}tfoot td{background:#fff8e6;font-weight:bold;}@page{margin:15mm;}</style>
  </head><body>${window._printInsHtml}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

function printAllSections(type) {
  const sections = currentSections[type];
  const today = new Date().toLocaleDateString('ko-KR');
  const w = window.open('','_blank','width=1100,height=800');
  if (!w) { alert('팝업이 차단되어 인쇄 창을 열 수 없습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  const body = sections.map(([ins, list]) => {
    const amt = list.reduce((s,r)=>s+(Number(r.청구금액)||0),0);
    const isAos = type==='aos';
    const cols = isAos ? ['작성일자','접수번호','담보','담당자','차량번호','차량명','청구금액','청구일자','상태','메모']
                       : ['RO번호','접수번호','차량번호','보험종류','청구금액','청구일자'];
    const rows = list.map((r,i) => {
      const bg = i%2===0?'#f8faff':'#fff';
      if (isAos) return `<tr style="background:${bg};"><td>${r.작성일자||'-'}</td><td>${r.접수번호||'-'}</td><td style="text-align:center">${r.담보||'-'}</td><td style="text-align:center">${r.담당자||'-'}</td><td style="font-weight:800;text-align:center;font-family:monospace;">${r.차량번호||'-'}</td><td>${r.차량명||'-'}</td><td style="text-align:right;font-weight:700;">${(Number(r.청구금액)||0).toLocaleString()}</td><td>${r.청구일자||'-'}</td><td style="text-align:center">${r.상태||'-'}</td><td>${r.미결메모||''}</td></tr>`;
      else return `<tr style="background:${bg};"><td>${r.RO번호||'-'}</td><td>${r.접수번호||'-'}</td><td style="font-weight:800;text-align:center;font-family:monospace;">${r.차량번호||'-'}</td><td style="text-align:center">${r.보험종류||'-'}</td><td style="text-align:right;font-weight:700;">${(Number(r.청구금액)||0).toLocaleString()}</td><td>${r.청구일자||'-'}</td></tr>`;
    }).join('');
    return `<div style="margin-bottom:30px;page-break-inside:avoid;">
      <h2 style="color:#1b3a6b;font-size:14px;margin-bottom:4px;">${ins} <span style="font-size:12px;font-weight:400;color:#555;">${list.length}건 · ${amt.toLocaleString()}원</span></h2>
      <table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="${isAos?6:4}" style="font-weight:bold;">합 계</td><td style="font-weight:bold;text-align:right;">${amt.toLocaleString()}</td><td colspan="${isAos?3:1}"></td></tr></tfoot></table>
    </div>`;
  }).join('');
  w.document.write(`<html><head><meta charset="UTF-8"><title>보험 미결 전체</title>
  <style>body{font-family:'맑은 고딕',sans-serif;margin:20px;}h1{color:#1b3a6b;font-size:16px;border-bottom:2px solid #1b3a6b;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:10px;}th,td{border:1px solid #c8d8f0;padding:5px 7px;}th{background:#eef3fb;}tfoot td{background:#fff8e6;font-weight:bold;}@page{margin:12mm;}</style>
  </head><body><h1>보험사별 미결 리스트 · 기준일: ${today} · UN Motors</h1>${body}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

// ── AOS 파일 처리 ──────────────────────────────────────
function handleAosDrop(e) { e.preventDefault(); handleAosFile(e.dataTransfer.files[0]); }
function handleAosFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type:'array', cellDates:true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
      const 미결 = rows.filter(r => {
        const 지급일자없음 = !r['지급일자'] || r['지급일자'].toString().trim() === '';
        const 지급금액없음 = !r['지급금액'] || r['지급금액'].toString().trim() === '' || Number(r['지급금액']) === 0;
        const 소유자제외 = (r['소유자']||'').toString().trim() !== '***';
        const 청구일자있음 = r['청구일자'] && r['청구일자'].toString().trim() !== '';
        return 지급일자없음 && 지급금액없음 && 소유자제외 && 청구일자있음;
      });
      if (!미결.length) { alert('미결 건이 없습니다!'); return; }
      const groups = {};
      미결.forEach(r => {
        const ins = r['보험사']||'미분류';
        if (!groups[ins]) groups[ins] = [];
        const 청구일 = r['청구일자'];
        groups[ins].push({
          작성일자: fmtDateVal(r['작성일자']),
          접수번호: r['접수번호']||'-',
          담보: r['담보']||'-',
          담당자: r['담당자']||'-',
          차량번호: r['차량번호']||'-',
          차량명: r['차량명']||'-',
          청구금액: Number(r['청구금액'])||0,
          청구일자: fmtDateVal(청구일),
          상태: r['상태']||'-',
          미결메모: r['미결메모']||''
        });
      });
      renderSections('aos', groups);
    } catch(err) { alert('파일을 읽을 수 없어요. xlsx 파일인지 확인해주세요.\n'+err); }
  };
  reader.readAsArrayBuffer(file);
}

// ── 볼트 파일 처리 ──────────────────────────────────────
function handleBoltDrop(e) { e.preventDefault(); handleBoltFile(e.dataTransfer.files[0]); }
function handleBoltFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const records = [];
      // 번호가 숫자인 행만 데이터 행으로 처리 (헤더 반복 무시)
      for (let i = 0; i < raw.length - 2; i++) {
        const r1 = raw[i]||[];
        const 번호val = r1[0];
        if (!번호val || isNaN(parseFloat(String(번호val)))) continue;
        // 계, 합계 행 제외
        if (String(번호val).includes('계')) continue;

        const r2 = raw[i+1]||[];
        const r3 = raw[i+2]||[];

        const 청구금액 = parseFloat(String(r2[2]||'').replace(/,/g,''))||0;

        // KGM 볼트 미결리스트는 파일 자체가 "미결만 정리된 것"이라 모든 데이터 행이 미결.
        // 자기부담금/부가세는 출고 시 별도로 미리 받지만 보험사 청구금액은 여전히 미수.
        // → 필터링 없이 전체 포함 (기존 승인금액 0 + 수납일 체크 조건이 노란 행 누락시켜 제거).

        // 보험사: 3행의 열6(대물보험사) 또는 열2(자차보험사)
        const ins6 = String(r3[6]||'').trim();
        const ins2 = String(r3[2]||'').trim();
        let 보험사 = '';
        if (ins6.includes(':')) 보험사 = ins6.split(':').slice(1).join(':').trim();
        else if (ins2.includes(':')) 보험사 = ins2.split(':').slice(1).join(':').trim();
        else 보험사 = ins6 || ins2 || '미분류';

        // 접수번호: r1[7], 숫자면 .0 제거
        const 접수번호raw = String(r1[7]||'').replace(/\.0$/, '').trim();

        // 청구일자: r1[23]
        const 청구일자raw = String(r1[23]||'').replace(/\.0$/, '').trim();
        let 청구일자 = '-';
        if (청구일자raw.length >= 8) 청구일자 = `${청구일자raw.slice(0,4)}-${청구일자raw.slice(4,6)}-${청구일자raw.slice(6,8)}`;

        records.push({
          보험사,
          RO번호: String(r1[2]||'').trim(),
          접수번호: 접수번호raw || '-',
          차량번호: String(r1[4]||'').trim(),
          보험종류: String(r1[18]||'').trim(),
          청구금액,
          청구일자,
        });
      }
      if (!records.length) { alert('미결 건이 없습니다!'); return; }
      const groups = {};
      records.forEach(r => {
        if (!groups[r.보험사]) groups[r.보험사] = [];
        groups[r.보험사].push(r);
      });
      renderSections('bolt', groups);
    } catch(err) { alert('파일을 읽을 수 없어요.\n'+err); }
  };
  reader.readAsArrayBuffer(file);
}

function fmtDateVal(val) {
  if (!val) return '-';
  if (val instanceof Date) return val.toLocaleDateString('ko-KR');
  const s = String(val);
  if (s.includes('T')) return s.split('T')[0];
  return s;
}