const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const x of ['manager.js','pinokio.js','install.js','update.js','reset.js','start.js']){
 test(x+' parses',()=>{new vm.Script(fs.readFileSync(path.join(__dirname,'..',x),'utf8'));});
}
test('menu has install action',async()=>{let items=await require('../pinokio.js').menu({platform:'win32'},{running:()=>false,exists:()=>false});assert.ok(items.some(x=>x.href==='install.js'));});
test('installed menu exposes start, update and confirmed reset',async()=>{
 const items=await require('../pinokio.js').menu({platform:'linux'},{running:()=>false,exists:()=>true});
 assert.equal(items.find(x=>x.default)?.href,'start.js');
 assert.ok(items.some(x=>x.href==='update.js'));
 assert.ok(items.find(x=>x.href==='reset.js')?.confirm);
});

const fp=require('node:fs/promises'),os=require('node:os');
const {copyPortable,repairPortableLinks}=require('../manager.js');
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
