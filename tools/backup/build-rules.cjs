'use strict';
const fs=require('fs'),path=require('path');
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'rules-before-seven-20260912.json'),'utf8')).rules;
const role="root.child('allowedEmails').child(auth.token.email.replace('.', ',')).val()";
const approved="auth != null && auth.token.email != null && ("+role+" == 'admin' || "+role+" == 'staff' || "+role+" == 'viewer')";
const admin="("+role+" == 'admin')";
const meId="root.child('leaveAccess').child(auth.token.email.replace('.', ',')).val()";
const me="root.child('leaveEmployees').child("+meId+")";
const director="("+me+".child('position').val() == '대표')";
const manager="("+me+".child('position').val() == '부서장' && "+me+".child('team').val() == root.child('leaveEmployees').child(data.child('empId').val()).child('team').val())";
const actor="((data.child('status').val() == 'pending_manager' && "+manager+") || (data.child('status').val() == 'pending_admin' && "+admin+") || (data.child('status').val() == 'pending_director' && "+director+"))";
const rules=JSON.parse(JSON.stringify(old));
for(const key of Object.keys(rules))if(key!=='$other')rules[key]={'.read':approved,'.write':approved};
rules.allowedEmails={'.read':approved,'.write':approved+' && '+admin};
rules.leaveAccess={'.read':approved,'.write':approved+' && '+admin};
for(const key of ['leaveEmployees','blacklist','companyEvents','notices'])rules[key]['.write']=approved+' && '+admin;
rules.reservationChecks['.write']=approved+' && '+admin;
rules.reservationChecks['.read']=approved+' && '+admin;
rules.workCodes['.write']=approved+" && ("+role+" == 'admin' || "+role+" == 'staff')";
rules.records={'.read':approved,'$id':{
 '.write':approved+' && (newData.exists() || '+admin+')',
 '.validate':admin+" || (!data.child('_deletedAt').exists() && !newData.child('_deletedAt').exists())"
}};
const same="newData.child('status').val() == data.child('status').val()";
const locked="(!data.child('_approvalLock').exists() || data.child('_approvalLock/until').val() < now || data.child('_approvalLock/by').val() == auth.token.email)";
const own="data.child('empId').val() == "+meId;
const initial="(!data.exists() && newData.child('requestedBy').val() == auth.token.email && (("+admin+" && newData.child('submittedOnBehalf').val() == true && newData.child('status').val() == 'approved') || (newData.child('empId').val() == "+meId+" && (newData.child('status').val() == 'pending_manager' || newData.child('status').val() == 'pending_admin' || newData.child('status').val() == 'pending_director' || ("+director+" && newData.child('status').val() == 'approved')))))";
const transition="("+same+" || newData.child('status').val() == 'rejected' || (data.child('status').val() == 'pending_manager' && newData.child('status').val() == 'pending_admin') || (data.child('status').val() == 'pending_admin' && newData.child('status').val() == 'pending_director') || (data.child('status').val() == 'pending_director' && newData.child('status').val() == 'approved'))";
const approvedUsage="newData.parent().parent().child('leaveUsage').child(newData.child('finalUsageId').val()).child('fromRequestId').val() == $id";
const immutable=['empId','type','date','endDate','hours','reason','requestedBy'].map(k=>"newData.child('"+k+"').val() == data.child('"+k+"').val()").join(' && ');
rules.leaveRequests={'.read':approved,'$id':{
 '.write':approved+' && ('+initial+' || (data.exists() && newData.exists() && (('+actor+' && '+locked+' && '+transition+") || ("+own+" && data.child('status').val().beginsWith('pending_') && !data.child('_approvalLock').exists() && newData.child('status').val() == 'canceled') || ("+admin+" && data.child('status').val() == 'approved' && "+same+'))))',
 '.validate':"(!data.exists() || ("+immutable+")) && (!newData.child('_approvalLock').exists() || newData.child('_approvalLock/by').val() == auth.token.email) && (newData.child('status').val() != 'approved' || data.child('status').val() == 'approved' || ("+approvedUsage+"))"
}};
const req="newData.parent().parent().child('leaveRequests').child(newData.child('fromRequestId').val())";
rules.leaveUsage={'.read':approved,'$id':{
 '.write':approved+' && ('+admin+" || (!data.exists() && "+director+" && "+req+".child('status').val() == 'approved' && "+req+".child('approvedBy').val() == auth.token.email && "+req+".child('empId').val() == newData.child('empId').val() && $id == newData.child('fromRequestId').val() + '_' + newData.child('date').val()))"
}};
// 2026-10-24 연락처: 거래처 공개 범위를 저장 위치로 나눠 규칙이 직접 막고, 연락처 등록·수정·삭제는 관리자만.
const staffUp="("+role+" == 'admin' || "+role+" == 'staff')";
const adminWrite={'.write':approved+' && '+admin};
rules.vendorContacts={'.read':approved,'$id':{...adminWrite,'.validate':"!newData.child('visibility').exists() || newData.child('visibility').val() == 'all'"}};
rules.vendorContactsStaff={'.read':approved+' && '+staffUp,'$id':{...adminWrite,'.validate':"newData.child('visibility').val() == 'staff'"}};
rules.vendorContactsAdmin={'.read':approved+' && '+admin,'$id':{...adminWrite,'.validate':"newData.child('visibility').val() == 'admin'"}};
rules.insuranceContacts={'.read':approved,'$id':{...adminWrite}};
// 2026-10-28 견적검색 공임표(BOLT 공임 금액 포함): 견적도우미를 쓰는 관리자·Staff 1단계만 읽고, 공임표 올리기는 관리자만.
rules.laborCodes={'.read':approved+' && '+staffUp,'.write':approved+' && '+admin};
// 2026-10-24 보안 점검: 화면에서 관리자만 다루는 매출·보증금·KGM 대수·월 목표·보험 미결은 읽기·쓰기 모두 관리자만.
for(const key of ['salesDaily','monthlyDeposit','kgmDailyCount','monthlyTarget','aosClaims'])rules[key]={'.read':approved+' && '+admin,'.write':approved+' && '+admin};
// 화면이 읽지 않는 권한 표(이메일별 역할·직원 연결)는 관리자만 읽기. 규칙 안의 root.child(...) 조회는 영향 없음.
rules.allowedEmails['.read']=approved+' && '+admin;
rules.leaveAccess['.read']=approved+' && '+admin;
// 게시판: 누구나 글을 쓰되 작성자 이메일은 본인 것만, 수정·삭제는 본인 글만 (관리자는 전부).
const mine="auth.token.email.toLowerCase()";
rules.board={'.read':approved,'$id':{'.write':approved+" && ("+admin+" || ((!data.exists() || data.child('authorEmail').val().toLowerCase() == "+mine+") && (!newData.exists() || newData.child('authorEmail').val().toLowerCase() == "+mine+")))"}};
module.exports={rules};
