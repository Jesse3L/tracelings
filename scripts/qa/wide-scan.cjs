const { chromium } = require('playwright');
const fs=require('fs');const path=require('path');
// Usage: build, serve dist/client on port 4599 (python3 -m http.server 4599), then node scripts/qa/wide-scan.cjs
// Opens every built page at 390px with every FAQ open and prints any page wider than the screen.
const root=path.resolve(__dirname,'../../dist/client');
const list=[];(function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(f.name!=='_astro')walk(p)}else if(f.name==='index.html')list.push('/'+path.relative(root,path.dirname(p))+'/')}})(root);
(async()=>{const b=await chromium.launch();const p=await(await b.newContext({viewport:{width:390,height:900}})).newPage();
await p.route(/^(?!http:\/\/localhost)/, r=>r.abort());
let bad=0;for(const u of list){try{await p.goto('http://localhost:4599'+u.replace('//','/'),{waitUntil:'load',timeout:15000});
await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await p.waitForTimeout(150);
const sw=await p.evaluate(()=>document.documentElement.scrollWidth);if(sw>390){bad++;console.log('WIDE',sw,u)}}catch(e){console.log('ERR',u,e.message.slice(0,80))}}
console.log('pages',list.length,'wide',bad);await b.close()})();
