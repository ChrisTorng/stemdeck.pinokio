const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const x of ['manager.js','pinokio.js','install.js','update.js','start.js']){
 test(x+' parses',()=>{new vm.Script(fs.readFileSync(path.join(__dirname,'..',x),'utf8'));});
}
test('menu has install action',async()=>{let items=await require('../pinokio.js').menu({platform:'win32'},{running:()=>false,exists:()=>false});assert.ok(items.some(x=>x.href==='install.js'));});