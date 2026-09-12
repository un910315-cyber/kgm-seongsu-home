'use strict';
const path=require('path');
const base=path.join(process.env.APPDATA,'npm/node_modules/firebase-tools/lib');
async function clients(){
 const auth=require(path.join(base,'auth.js'));
 const account=auth.getGlobalDefaultAccount();
 if(!account)throw Error('Firebase CLI에 로그인해주세요.');
 const options={project:'unmotors',nonInteractive:true};
 auth.setActiveAccount(options,account);
 await require(path.join(base,'requireAuth.js')).requireAuth(options);
 const {Client}=require(path.join(base,'apiv2.js'));
 return {
  database:new Client({urlPrefix:'https://unmotors-default-rtdb.firebaseio.com',apiVersion:''}),
  firestore:new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1'}),
  rules:new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'})
 };
}
module.exports={clients};
