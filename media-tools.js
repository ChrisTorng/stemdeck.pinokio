'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');

function probePair(ffmpeg,ffprobe,spawn=cp.spawnSync){
 const filters=spawn(ffmpeg,['-hide_banner','-filters'],{encoding:'utf8',timeout:15000,windowsHide:true});
 if(filters.error||filters.status!==0||!/^\s*\S+\s+rubberband\s/m.test(filters.stdout||''))return false;
 const probe=spawn(ffprobe,['-version'],{encoding:'utf8',timeout:15000,windowsHide:true});
 return !probe.error&&probe.status===0;
}
function findMediaTools(root,env=process.env,spawn=cp.spawnSync){
 const suffix=process.platform==='win32'?'.exe':'';
 if(env.STEMDECK_FFMPEG||env.STEMDECK_FFPROBE){
  const ffmpeg=env.STEMDECK_FFMPEG||path.join(path.dirname(env.STEMDECK_FFPROBE),'ffmpeg'+suffix);
  const ffprobe=env.STEMDECK_FFPROBE||path.join(path.dirname(ffmpeg),'ffprobe'+suffix);
  if(!probePair(ffmpeg,ffprobe,spawn))throw Error('Configured STEMDECK_FFMPEG/FFPROBE cannot transpose: a working pair with the rubberband filter is required.');
  return {ffmpeg,ffprobe};
 }
 const prefix=path.join(root,'cache','ffmpeg-runtime');
 const folders=[process.platform==='win32'?path.join(prefix,'Library','bin'):path.join(prefix,'bin'),
  ...String(env.PATH||env.Path||'').split(path.delimiter).filter(Boolean).map(p=>p.replace(/^"|"$/g,''))];
 for(const folder of new Set(folders)){
  const ffmpeg=path.join(folder,'ffmpeg'+suffix),ffprobe=path.join(folder,'ffprobe'+suffix);
  if(fs.existsSync(ffmpeg)&&fs.existsSync(ffprobe)&&probePair(ffmpeg,ffprobe,spawn))return {ffmpeg,ffprobe};
 }
 return null;
}
async function ensureMediaTools(root){
 let tools=findMediaTools(root);
 if(!tools){
  // A dedicated prefix avoids replacing Pinokio's shared FFmpeg or CUDA runtime.
  const prefix=path.join(root,'cache','ffmpeg-runtime');
  console.log('Installing FFmpeg with rubberband for native StemDeck transpose exports');
  const result=cp.spawnSync('conda',['create','--yes','--prefix',prefix,'--channel','conda-forge','ffmpeg=*=gpl*'],{stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('FFmpeg installation failed: '+result.status);
  tools=findMediaTools(root);
 }
 if(!tools)throw Error('No FFmpeg/ffprobe pair with rubberband found after installation');
 console.log('Verified native transpose FFmpeg: '+tools.ffmpeg);
 return tools;
}
module.exports={probePair,findMediaTools,ensureMediaTools};
