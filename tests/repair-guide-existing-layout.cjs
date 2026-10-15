'use strict';
// Run the existing four-list regression unchanged except for its screenshot path.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const original=path.resolve(__dirname,'layout.cjs'),output=path.resolve(__dirname,'../../repair-menu-qa');fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(original,'utf8').replace('C:/Users/pc/kgm-safety-desktop.png',path.join(output,'legacy-desktop.png').replace(/\\/g,'/'));
const instance=new Module(original,module);instance.filename=original;instance.paths=module.paths;instance._compile(source,original);
