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
module.exports={rules};
