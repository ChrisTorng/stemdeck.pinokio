const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {probePair,findMediaTools}=require('../media-tools');
test('rejects an FFmpeg lacking rubberband and a broken ffprobe',()=>{
 assert.equal(probePair('ffmpeg','ffprobe',()=>({status:0,stdout:' .. afade A->A'})),false);
 assert.equal(probePair('ffmpeg','ffprobe',(exe)=>exe==='ffmpeg'?{status:0,stdout:' .. rubberband A->A'}:{status:1}),false);
});
test('skips incompatible first PATH pair and selects capable later pair',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'stemdeck-media-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const suffix=process.platform==='win32'?'.exe':'';
 const dirs=['pinokio','system'].map(x=>path.join(root,x));
 for(const dir of dirs){await fs.mkdir(dir);for(const name of ['ffmpeg','ffprobe'])await fs.writeFile(path.join(dir,name+suffix),'fake executable');}
 const spawn=(exe,args)=>({status:0,stdout:args[0]==='-version'?'ffprobe version':exe.startsWith(dirs[1]+path.sep)?' .. rubberband A->A':' .. afade A->A'});
 const pair=findMediaTools(root,{PATH:dirs.join(path.delimiter)},spawn);
 assert.equal(pair.ffmpeg,path.join(dirs[1],'ffmpeg'+suffix));
 assert.equal(pair.ffprobe,path.join(dirs[1],'ffprobe'+suffix));
 assert.throws(()=>findMediaTools(root,{PATH:dirs.join(path.delimiter),STEMDECK_FFMPEG:path.join(dirs[0],'ffmpeg'+suffix)},spawn),/Configured.*cannot transpose/);
});
