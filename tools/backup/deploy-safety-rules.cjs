'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {clients}=require('./firebase-session.cjs');
const candidate=require('./build-rules.cjs');
async function main(){
 const api=await clients();
 const validation=await api.database.request({method:'PUT',path:'/.settings/rules.json',queryParams:{dryRun:'true'},body:JSON.stringify(candidate),resolveOnHTTPError:true});
 if(validation.status!==200)throw Error(JSON.stringify(validation.body));
 const old=(await api.database.get('/.settings/rules.json')).body;
 const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'rules-before-seven-20260912.json'),'utf8'));
 assert.deepEqual(old,baseline,'운영 규칙이 백업 이후 달라졌습니다. 덮어쓰지 않고 중단합니다.');
 let roles={},token;
 do {
  const result=await api.firestore.get('projects/unmotors/databases/(default)/documents/users',{queryParams:{pageSize:1000,...(token?{pageToken:token}:{})}});
  for(const doc of result.body.documents||[]){
   const email=decodeURIComponent(doc.name.split('/').pop()).toLowerCase();
   const role=doc.fields?.role?.stringValue||'viewer';
   if(role==='removed'||doc.fields?._deleted?.booleanValue)continue;
   if(!['admin','staff','viewer'].includes(role))throw Error('알 수 없는 역할이 있습니다.');
   roles[email.replace(/\./g,',')]=role;
  }
  token=result.body.nextPageToken;
 }while(token);
 if(!Object.values(roles).includes('admin'))throw Error('관리자가 없습니다.');
 const employees=(await api.database.get('/leaveEmployees.json')).body||{},access={};
 for(const [id,emp]of Object.entries(employees)){
  if(!emp.email)continue;
  const key=emp.email.toLowerCase().replace(/\./g,',');
  if(access[key])throw Error('직원 이메일 중복이 있습니다.');
  access[key]=id;
 }
 const existing=(await api.database.get('/allowedEmails.json')).body||{};
 const changes={leaveAccess:access};
 for(const [key,role]of Object.entries(roles))if(existing[key]!==role)changes['allowedEmails/'+key]=role;
 for(const key of Object.keys(existing))if(!roles[key])changes['allowedEmails/'+key]=null;
 console.log('Preflight passed: '+Object.keys(roles).length+' approved users, '+Object.keys(access).length+' employee mappings; '+(Object.keys(changes).length-1)+' role corrections.');
 if(!process.argv.includes('--publish'))return;
 await api.database.patch('/.json',changes);
 await api.database.request({method:'PUT',path:'/.settings/rules.json',body:JSON.stringify(candidate)});
 const live=(await api.database.get('/.settings/rules.json')).body;
 assert.deepEqual(live,candidate);
 console.log('Published and verified database rules.');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
