'use strict';
// Encrypted account credentials remain in Firebase CLI; this script never prints them.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {clients}=require('./firebase-session.cjs');
async function backup(){
 const api=await clients(),stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const folder=path.join(__dirname,'backups',stamp);
 fs.mkdirSync(folder,{recursive:true});
 const manifest={startedAt:new Date().toISOString(),project:'unmotors',complete:false,files:[]};
 function save(name,data){const file=path.join(folder,name);fs.writeFileSync(file,JSON.stringify(data,null,2));manifest.files.push({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}
 try{
  save('rtdb.json',(await api.database.get('/.json')).body);
  save('realtime-rules.json',(await api.database.get('/.settings/rules.json')).body);
  const documents={},root='projects/unmotors/databases/(default)/documents';
  async function walk(parent){
   let token;
   do{
    const res=await api.firestore.post(parent+':listCollectionIds',{pageSize:1000,...(token?{pageToken:token}:{})});
    for(const col of res.body.collectionIds||[]){
     let page;
     do{
      const r=await api.firestore.get(parent+'/'+col,{queryParams:{pageSize:1000,...(page?{pageToken:page}:{})}});
      for(const doc of r.body.documents||[]){documents[doc.name]=doc;await walk(doc.name);}
      page=r.body.nextPageToken;
     }while(page);
    }
    token=res.body.nextPageToken;
   }while(token);
  }
  await walk(root);save('firestore-documents.json',documents);
  for(const name of ['cloud.firestore','firebase.storage/unmotors.firebasestorage.app']){
   const release=(await api.rules.get('projects/unmotors/releases/'+name)).body;
   save(name.startsWith('cloud')?'firestore-release.json':'storage-release.json',release);
   if(release.rulesetName)save(name.startsWith('cloud')?'firestore-rules.json':'storage-rules.json',(await api.rules.get(release.rulesetName)).body);
  }
  manifest.complete=true;manifest.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(__dirname,'backups','latest-success.json'),JSON.stringify({folder,...manifest},null,2));
  console.log('Backup complete: '+folder+' ('+Object.keys(documents).length+' Firestore documents)');
  return folder;
 }catch(e){manifest.error=e.message;fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));throw e;}
}
if(require.main===module)backup().then(()=>process.exit(0)).catch(e=>{console.error('Backup failed: '+e.message);process.exit(1);});
module.exports={backup};
