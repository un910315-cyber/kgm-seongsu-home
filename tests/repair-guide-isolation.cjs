'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
// Baseline = the last commit where the legacy files below were changed on purpose (approved design/feature work).
// When legacy files are intentionally changed again, move this baseline to that commit in the same piece of work.
// The guide's own integration points are stripped from both sides, so only changes outside them fail the test.
const baseline='3fe0375664c9d94084d2974dcb225b248dc7e2dd';
const git=args=>cp.execFileSync('git',['-c','safe.directory='+process.cwd().replace(/\\/g,'/'),...args],{encoding:'utf8'});
const original=file=>git(['show',baseline+':'+file]).replace(/\r/g,'');
const current=file=>fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').replace(/\r/g,'');
const stripModule=s=>s.replace(/,'repairguide'/g,'').replace(/\n  \/\/ Isolated guide bridge:[\s\S]*?\n  };\n/,'').replace(/\$\{window\._repairGuideButton\?window\._repairGuideButton\(r\.id\):''\}/g,'').replace(/^ +\n/gm,'');
const stripPages=s=>s.replace(/^.*name==='repairguide'.*\n/gm,'');
assert.equal(stripModule(current('un/app-module.js')),stripModule(original('un/app-module.js')),'Legacy module changed outside isolated integration points');
assert.equal(stripPages(current('un/app-pages.js')),stripPages(original('un/app-pages.js')));
for(const file of ['un/styles.css','un/design-refresh.css','un/app-features.js','un/app-insurance.js','un/app-maintenance.js','un/app-safety.js','tools/backup/build-rules.cjs'])assert.equal(current(file),original(file),file+' must remain unchanged');
const window={KGM_REPAIR_CONFIG:{enabled:false}},context={window};vm.createContext(context);vm.runInContext(current('un/app-repair-guide.js'),context);assert.deepEqual(Object.keys(window),['KGM_REPAIR_CONFIG']);
const listeners=[],activeWindow={KGM_REPAIR_CONFIG:{enabled:true},_userRole:'viewer',_canAccessPage:()=>false,esc:s=>s,addEventListener:(...x)=>listeners.push(x)};
const activeContext={window:activeWindow,document:{body:{classList:{add(){}}},addEventListener:(...x)=>listeners.push(x)},location:{origin:'https://test.invalid'}};vm.createContext(activeContext);vm.runInContext(current('un/app-repair-guide.js'),activeContext);assert.equal(activeWindow._repairGuideButton('a'),'');assert.doesNotThrow(()=>activeWindow._openRepairGuide('a'));activeWindow._userRole='admin';assert(activeWindow._repairGuideButton('a').includes('data-repair-admission'));
const uiContext={window:{}};vm.createContext(uiContext);vm.runInContext(current('repair-guide/message.js'),uiContext);const nodeMessage=require('../repair-guide/message.js'),snapshot={center:'KGM 성수서비스센터',vehicle:{carNum:'123가1234'},centerPhone:'02-0000-0000'};assert.equal(uiContext.window.KgmRepairMessage.text(snapshot),nodeMessage.text(snapshot));assert(current('repair-guide/common.js').includes('KgmRepairMessage.text'));
const cfgContext={window:{}};vm.createContext(cfgContext);vm.runInContext(current('un/repair-guide-config.js'),cfgContext);assert.equal(cfgContext.window.KGM_REPAIR_CONFIG.enabled,true);assert.equal(cfgContext.window.KGM_REPAIR_CONFIG.previewOnly,false);assert.equal(cfgContext.window.KGM_REPAIR_CONFIG.apiBase,'https://asia-northeast3-unmotors.cloudfunctions.net/kgmRepairApi');
console.log('PASS isolation: unchanged legacy logic/CSS/rules; disabled feature has no hooks; viewer blocked; browser/server use one message template; isolated test API configured');
