const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const x of ['manager.js','web-ui.js','pinokio.js','install.js','update.js','reset.js','start.js']){
 test(x+' parses',()=>{new vm.Script(fs.readFileSync(path.join(__dirname,'..',x),'utf8'));});
}
test('menu has install action',async()=>{let items=await require('../pinokio.js').menu({platform:'win32'},{running:()=>false,exists:()=>false});assert.ok(items.some(x=>x.href==='install.js'));});
test('installed menu exposes start, update and confirmed reset',async()=>{
 const items=await require('../pinokio.js').menu({platform:'linux'},{running:()=>false,exists:()=>true});
 assert.equal(items.find(x=>x.default)?.href,'start.js');
 assert.ok(items.some(x=>x.href==='update.js'));
 assert.ok(items.find(x=>x.href==='reset.js')?.confirm);
});
test('known nonfatal DRI3 warning does not trigger Pinokio error detection',()=>{
 const handlers=require('../start.js').run[0].params.on;
 const ignored=handlers.filter(x=>x.break===false).map(x=>new RegExp(x.event.slice(1,-1)));
 assert.ok(ignored.some(re=>re.test('libEGL warning: DRI3 error: Could not get DRI3 device')));
 assert.ok(ignored.every(re=>!re.test('Error: CUDA installation failed')));
});
test('running menu opens the captured web URL and keeps Terminal available',async()=>{
 const menu=require('../pinokio.js').menu;
 const info={running:x=>x==='start.js',exists:()=>true,local:()=>({url:'http://127.0.0.1:43210'})};
 const items=await menu({platform:'linux'},info);
 assert.equal(items.find(x=>x.default)?.href,'http://127.0.0.1:43210');
 assert.ok(items.some(x=>x.href==='start.js'));
 info.local=()=>({});
 assert.equal((await menu({platform:'linux'},info)).find(x=>x.default)?.href,'start.js');
 const script=require('../start.js');
 const capture=script.run[0].params.on.find(x=>x.done);
 const match=new RegExp(capture.event.slice(1,-1)).exec('StemDeck Web UI: http://127.0.0.1:43210');
 assert.equal(match[1],'http://127.0.0.1:43210');
 assert.equal(script.run[1].params.url,'{{input.event[1]}}');
});

const fp=require('node:fs/promises'),os=require('node:os');
test('web bridge embeds the page and forwards API, upload and event streams',async t=>{
 const http=require('node:http');
 const {createWebProxy,waitForBackend}=require('../web-ui.js');
 const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
 const upstream=http.createServer((req,res)=>{
  if(req.url==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({name:'StemDeck',status:'ok',pid:123}));}
  else if(req.url==='/upload'){req.pipe(res);}
  else if(req.url==='/events'){res.setHeader('Content-Type','text/event-stream');res.write('data: ready\n\n');setTimeout(()=>res.end('data: done\n\n'),20);}
  else {res.setHeader('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'; object-src 'none'");res.setHeader('X-Frame-Options','DENY');res.end('<html>StemDeck</html>');}
 });
 t.after(()=>{upstream.closeAllConnections();upstream.close();});
 const base=await listen(upstream),proxy=createWebProxy(base);
 t.after(()=>{proxy.closeAllConnections();proxy.close();});
 const web=await listen(proxy),response=await fetch(web);
 assert.equal(await response.text(),'<html>StemDeck</html>');
 assert.equal(response.headers.get('x-frame-options'),null);
 assert.ok(!response.headers.get('content-security-policy').includes('frame-ancestors'));
 assert.ok(response.headers.get('content-security-policy').includes("object-src 'none'"));
 assert.equal((await (await fetch(web+'/api/health')).json()).status,'ok');
 const audio=Buffer.from([0,255,13,10,42]);
 assert.deepEqual(Buffer.from(await (await fetch(web+'/upload',{method:'POST',body:audio})).arrayBuffer()),audio);
 assert.equal(await (await fetch(web+'/events')).text(),'data: ready\n\ndata: done\n\n');
 const temp=await fp.mkdtemp(path.join(os.tmpdir(),'stemdeck-ready-'));
 t.after(()=>fp.rm(temp,{recursive:true,force:true}));
 const log=path.join(temp,'backend.log');
 await fp.writeFile(log,'Started server process [123]\nUvicorn running on '+base+'\n');
 assert.equal(await waitForBackend(log,{since:0,timeout:2000}),base);
 const controller=new AbortController();controller.abort();
 await assert.rejects(waitForBackend(log,{signal:controller.signal}));
});
const {copyPortable,repairPortableLinks,installedReleaseMatches,copyStemDeckUpdate}=require('../manager.js');
test('same release skips reinstall only when the installed runtime exists',async t=>{
 const temp=await fp.mkdtemp(path.join(os.tmpdir(),'stemdeck-update-'));
 t.after(()=>fp.rm(temp,{recursive:true,force:true}));
 const python=path.join(temp,'python',process.platform==='win32'?'python.exe':'bin/python3');
 await fp.mkdir(path.dirname(python),{recursive:true});
 await fp.writeFile(python,'runtime');await fp.writeFile(path.join(temp,'StemDeck'),'binary');
 await fp.writeFile(path.join(temp,'.pinokio-installed.json'),JSON.stringify({name:'stemdeck',mode:'nvidia',version:'v1'}));
 assert.equal(await installedReleaseMatches(temp,'stemdeck','nvidia','v1','StemDeck'),true);
 assert.equal(await installedReleaseMatches(temp,'stemdeck','nvidia','v2','StemDeck'),false);
 assert.equal(await installedReleaseMatches(temp,'stemdeck','cpu','v1','StemDeck'),false);
 await fp.unlink(python);
 assert.equal(await installedReleaseMatches(temp,'stemdeck','nvidia','v1','StemDeck'),false);
});
test('application update preserves CUDA for matching runtime IDs and replaces changed runtimes',async t=>{
 const temp=await fp.mkdtemp(path.join(os.tmpdir(),'stemdeck-update-'));
 t.after(()=>fp.rm(temp,{recursive:true,force:true}));
 const stage=path.join(temp,'stage'),app=path.join(temp,'app');
 const python=process.platform==='win32'?'python.exe':'bin/python3';
 for(const dir of [stage,app]){
  await fp.mkdir(path.dirname(path.join(dir,'python',python)),{recursive:true});
  await fp.writeFile(path.join(dir,'python',python),'python');
  await fp.writeFile(path.join(dir,'python','runtime-version.json'),JSON.stringify({runtimeId:'same-dependencies'}));
 }
 await fp.writeFile(path.join(app,'python','torch.txt'),'working CUDA');
 await fp.writeFile(path.join(stage,'python','torch.txt'),'bundled CPU');
 await fp.writeFile(path.join(stage,'StemDeck'),'new app');
 await copyStemDeckUpdate(stage,app);
 assert.equal(await fp.readFile(path.join(app,'StemDeck'),'utf8'),'new app');
 assert.equal(await fp.readFile(path.join(app,'python','torch.txt'),'utf8'),'working CUDA');
 await fp.writeFile(path.join(stage,'python','runtime-version.json'),JSON.stringify({runtimeId:'new-dependencies'}));
 await copyStemDeckUpdate(stage,app);
 assert.equal(await fp.readFile(path.join(app,'python','torch.txt'),'utf8'),'bundled CPU');
});
test('portable child supports Pinokio pip and remote Linux rendering',{skip:process.platform!=='linux'},async t=>{
 const temp=await fp.mkdtemp(path.join(os.tmpdir(),'stemdeck-test-'));
 t.after(()=>fp.rm(temp,{recursive:true,force:true}));
 await fp.mkdir(path.join(temp,'app'));
 await fp.copyFile(path.join(__dirname,'..','manager.js'),path.join(temp,'manager.js'));
 await fp.writeFile(path.join(temp,'app','.pinokio-installed.json'),'{}');
 await fp.writeFile(path.join(temp,'app','StemDeck'),'#!/bin/sh\nprintf "%s,%s" "$PIP_REQUIRE_VIRTUALENV" "$WEBKIT_DISABLE_COMPOSITING_MODE"\n',{mode:0o755});
 const execFile=require('node:util').promisify(require('node:child_process').execFile);
 const env={...process.env,DISPLAY:':test',PIP_REQUIRE_VIRTUALENV:'true'};
 delete env.WEBKIT_DISABLE_COMPOSITING_MODE;
 const result=await execFile(process.execPath,[path.join(temp,'manager.js'),'start','stemdeck'],{env});
 assert.equal(result.stdout,'false,1');
 const override=await execFile(process.execPath,[path.join(temp,'manager.js'),'start','stemdeck'],{env:{...env,WEBKIT_DISABLE_COMPOSITING_MODE:'0'}});
 assert.equal(override.stdout,'false,0');
});
test('portable Python survives staging cleanup and a repeated install',{skip:process.platform==='win32'},async t=>{
 const temp=await fp.mkdtemp(path.join(os.tmpdir(),'stemdeck-test-'));
 t.after(()=>fp.rm(temp,{recursive:true,force:true}));
 const stage=path.join(temp,'stage'),app=path.join(temp,'app');
 await fp.mkdir(path.join(stage,'python','bin'),{recursive:true});
 await fp.writeFile(path.join(stage,'python','bin','python3.12'),'runtime');
 await fp.symlink('python3.12',path.join(stage,'python','bin','python3'));
 await copyPortable(stage,app);
 await fp.unlink(path.join(app,'python','bin','python3'));
 await fp.symlink('/removed/pinokio-old/stage/StemDeck/python/bin/python3.12',path.join(app,'python','bin','python3'));
 await copyPortable(stage,app);
 await fp.rm(stage,{recursive:true});
 assert.equal(await fp.readlink(path.join(app,'python','bin','python3')),'python3.12');
 assert.equal(await fp.readFile(path.join(app,'python','bin','python3'),'utf8'),'runtime');
});
test('repairs legacy staging links without changing unrelated links',{skip:process.platform==='win32'},async t=>{
 const temp=await fp.mkdtemp(path.join(os.tmpdir(),'stemdeck-test-'));
 t.after(()=>fp.rm(temp,{recursive:true,force:true}));
 const bin=path.join(temp,'python','bin');
 await fp.mkdir(bin,{recursive:true});
 await fp.writeFile(path.join(bin,'python3.12'),'runtime');
 await fp.symlink('/removed/pinokio-old/stage/StemDeck-Linux-x64.NVIDIA/python/bin/python3.12',path.join(bin,'python3'));
 await fp.symlink('python3',path.join(bin,'python'));
 await fp.symlink('/unrelated/missing',path.join(bin,'unrelated'));
 assert.equal(await repairPortableLinks(temp),1);
 assert.equal(await fp.readFile(path.join(bin,'python'),'utf8'),'runtime');
 assert.equal(await fp.readlink(path.join(bin,'unrelated')),'/unrelated/missing');
 assert.equal(await repairPortableLinks(temp),0);
});
