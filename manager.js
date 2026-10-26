'use strict';
const fs=require('node:fs'),fp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
const root=__dirname,app=path.join(root,'app'),headers={'User-Agent':'pinokio-launcher','Accept':'application/vnd.github+json'};
function die(s){throw Error(s)}
function run(cmd,args,opts={}){let p=cp.spawnSync(cmd,args,{stdio:'inherit',...opts});if(p.error)throw p.error;if(p.status!==0)die(cmd+' failed: '+p.status);}
async function gh(url){let r=await fetch(url,{headers});if(!r.ok)die('GitHub HTTP '+r.status);return r.json();}
async function release(repo,beta){if(!beta)return gh('https://api.github.com/repos/'+repo+'/releases/latest');let all=await gh('https://api.github.com/repos/'+repo+'/releases?per_page=20');return all.find(r=>!r.draft&&r.assets?.length)||die('No release');}
async function download(url,to){let r=await fetch(url,{headers});if(!r.ok||!r.body)die('Download failed '+r.status);await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(to));}
async function digest(file){let h=crypto.createHash('sha256');await new Promise((ok,bad)=>fs.createReadStream(file).on('data',x=>h.update(x)).on('error',bad).on('end',ok));return h.digest('hex');}
async function verify(rel,asset,file){
 let expected=/^sha256:([0-9a-f]{64})$/i.exec(asset.digest||'')?.[1];
 if(!expected){let sum=rel.assets.find(x=>x.name==='SHA256SUMS');if(!sum)die('No upstream checksum');let res=await fetch(sum.browser_download_url,{headers});if(!res.ok)die('Checksum download failed');
 let items=(await res.text()).split(/\r?\n/).map(l=>/^([0-9a-f]{64})\s+\*?(.+)$/i.exec(l)).filter(Boolean);expected=items.find(x=>x[2].trim()===asset.name)?.[1];if(!expected)die('No matching checksum');}
 if((await digest(file)).toLowerCase()!==expected.toLowerCase())die('SHA256 mismatch '+asset.name);
 console.log('SHA256 verified');
}
function extract(file,to){
 fs.mkdirSync(to,{recursive:true});
 if(process.platform==='win32'&&file.endsWith('.zip')){let q=s=>"'"+s.replace(/'/g,"''")+"'";return run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath '+q(file)+' -DestinationPath '+q(to)+' -Force']);}
 let r=cp.spawnSync('tar',['-xf',file,'-C',to],{stdio:'inherit'});
 if(!r.error&&r.status===0)return;
 if(process.platform==='win32'&&file.endsWith('.7z')){let names=['7z.exe','7z','C:\\Program Files\\7-Zip\\7z.exe'];let bin=names.find(x=>fs.existsSync(x)||cp.spawnSync(x,['-h'],{stdio:'ignore'}).status===0);if(!bin)die('Install 7-Zip and retry');return run(bin,['x','-y','-o'+to,file]);}
 die('Archive extract failed');
}
async function locate(dir,name,level=0){if(level>5)return null;for(let e of await fp.readdir(dir,{withFileTypes:true})){let file=path.join(dir,e.name);if(e.isFile()&&e.name.toLowerCase()===name.toLowerCase())return file;if(e.isDirectory()){let found=await locate(file,name,level+1);if(found)return found;}}return null;}
async function copyPortable(from,to){
 // Keep archive-relative links relative after the staging directory is removed.
 await fp.cp(from,to,{recursive:true,force:true,verbatimSymlinks:true});
}
async function readJson(file){try{return JSON.parse(await fp.readFile(file,'utf8'));}catch{return null;}}
async function installedReleaseMatches(dir,name,mode,version,binary){
 const installed=await readJson(path.join(dir,'.pinokio-installed.json'));
 return installed?.name===name&&installed.mode===mode&&installed.version===version&&fs.existsSync(path.join(dir,binary))&&
  (name!=='stemdeck'||fs.existsSync(path.join(dir,'python',process.platform==='win32'?'python.exe':'bin/python3')));
}
async function copyStemDeckUpdate(from,to){
 // Upstream uses this dependency-set ID to decide whether python/ is reusable.
 const old=await readJson(path.join(to,'python','runtime-version.json'));
 const fresh=await readJson(path.join(from,'python','runtime-version.json'));
 const python=path.join(to,'python',process.platform==='win32'?'python.exe':'bin/python3');
 const keepPython=typeof old?.runtimeId==='string'&&old.runtimeId.length>0&&old.runtimeId===fresh?.runtimeId&&fs.existsSync(python);
 if(!keepPython)return copyPortable(from,to);
 console.log('Keeping installed Python/CUDA runtime (dependency set unchanged)');
 await fp.cp(from,to,{recursive:true,force:true,verbatimSymlinks:true,filter:src=>src!==path.join(from,'python')});
}
async function repairPortableLinks(dir){
 let repaired=0;
 async function visit(folder){
  for(const entry of await fp.readdir(folder,{withFileTypes:true})){
   const file=path.join(folder,entry.name);
   if(entry.isDirectory())await visit(file);
   else if(entry.isSymbolicLink()&&!fs.existsSync(file)){
    const target=await fp.readlink(file);
    // Earlier installers let fs.cp resolve links against its temporary stage.
    const match=/[/\\]pinokio-[^/\\]+[/\\]stage[/\\][^/\\]+[/\\](.+)$/.exec(target);
    if(!path.isAbsolute(target)||!match)continue;
    const replacement=path.resolve(dir,match[1]);
    if(!replacement.startsWith(path.resolve(dir)+path.sep)||!fs.existsSync(replacement))continue;
    await fp.unlink(file);
    await fp.symlink(path.relative(path.dirname(file),replacement),file);
    repaired++;
   }
  }
 }
 await visit(dir);
 if(repaired)console.log('Repaired '+repaired+' portable runtime links');
 return repaired;
}
async function installArchive(name,repo,mode,assetName,binary,beta){
 let rel=await release(repo,beta);let results=rel.assets.filter(x=>x.name===assetName||assetName instanceof RegExp&&assetName.test(x.name));if(results.length!==1)die('Release asset not found or ambiguous');let asset=results[0];
 if(await installedReleaseMatches(app,name,mode,rel.tag_name,binary)){
  if(name==='stemdeck'&&process.platform==='linux')await repairPortableLinks(app);
  console.log('Already installed '+rel.tag_name+'; keeping Python/CUDA runtime, no download needed');return;
 }
 let tmp=await fp.mkdtemp(path.join(os.tmpdir(),'pinokio-'));
 try{let file=path.join(tmp,asset.name),dir=path.join(tmp,'stage');console.log('Downloading '+asset.browser_download_url);await download(asset.browser_download_url,file);await verify(rel,asset,file);extract(file,dir);
 let exe=await locate(dir,binary);if(!exe)die('Missing '+binary+' in archive');
 await fp.mkdir(app,{recursive:true});if(name==='stemdeck')await copyStemDeckUpdate(path.dirname(exe),app);else await copyPortable(path.dirname(exe),app);if(process.platform!=='win32')await fp.chmod(path.join(app,binary),0o755);
 if(name==='pymss')await fp.writeFile(path.join(app,'pymss-studio.portable'),'');
 await fp.writeFile(path.join(app,'.pinokio-installed.json'),JSON.stringify({name,mode,version:rel.tag_name},null,2));console.log('Installed '+rel.tag_name);
 }finally{await fp.rm(tmp,{recursive:true,force:true});}
}
async function linuxPymss(){
 if(process.platform!=='linux')die('Linux only');let need=['git','pnpm','cargo','python3.12','pkg-config','ffmpeg'];let missing=need.filter(x=>{let r=cp.spawnSync(x,['--version'],{stdio:'ignore'});return r.error||r.status!==0;});if(missing.length)die('Missing prerequisites: '+missing.join(', '));
 let src=path.join(app,'source');await fp.mkdir(app,{recursive:true});
 if(!fs.existsSync(path.join(src,'.git')))run('git',['clone','--depth','1','https://github.com/pymss-project/pymss-studio.git',src]);else run('git',['-C',src,'pull','--ff-only']);
 run('pnpm',['install','--frozen-lockfile'],{cwd:src});let py=path.join(src,'.venv','bin','python');if(!fs.existsSync(py))run('python3.12',['-m','venv',path.join(src,'.venv')],{cwd:src});run(py,['-m','pip','install','requests[socks]>=2.32,<3'],{cwd:src});
 await fp.writeFile(path.join(app,'.pinokio-installed.json'),JSON.stringify({name:'pymss',mode:'source'}));console.log('Experimental Linux source prepared; compile via Start.');
}
async function install(name,mode){
 if(!['win32','linux'].includes(process.platform)||process.arch!=='x64')die('Only x64 Windows/Linux supported');
 if(name==='stemdeck'){let w=process.platform==='win32',file=w?'StemDeck-Windows-x64.NVIDIA.zip':'StemDeck-Linux-x64.NVIDIA.tar.gz';return installArchive(name,'stemdeckapp/stemdeck','nvidia',file,w?'StemDeck.exe':'StemDeck',false);}
 if(name!=='pymss')die('Unknown app');if(process.platform==='linux')return linuxPymss();if(!['cuda','online'].includes(mode))die('Invalid Windows mode');
 return installArchive(name,'pymss-project/pymss-studio',mode,new RegExp('^Pymss-Studio-[0-9.]+-windows-x64-'+mode+'\\.7z$'),'Pymss Studio.exe',true);
}
async function start(name,webPort){
 if(!fs.existsSync(path.join(app,'.pinokio-installed.json')))die('Not installed');
 if(process.platform==='linux'&&!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)die('Requires desktop session');
 if(process.platform==='linux'&&name==='stemdeck')await repairPortableLinks(app);
 let cwd=app,bin,args=[],env={...process.env};
 // StemDeck manages its own portable Python, rather than a Pinokio venv.
 if(name==='stemdeck')env.PIP_REQUIRE_VIRTUALENV='false';
 // WebKit's accelerated compositor can stop repainting on remote Linux X11.
 // This changes UI rendering only; CUDA audio processing stays enabled.
 if(name==='stemdeck'&&process.platform==='linux')env.WEBKIT_DISABLE_COMPOSITING_MODE??='1';
 if(name==='pymss'&&process.platform==='linux'){cwd=path.join(app,'source');bin='pnpm';args=['tauri','dev'];env.PYMSS_STUDIO_PYTHON=path.join(cwd,'.venv','bin','python');}
 else {bin=path.join(app,name==='stemdeck'?(process.platform==='win32'?'StemDeck.exe':'StemDeck'):'Pymss Studio.exe');if(!fs.existsSync(bin))die('Missing executable '+bin);}
 let child=cp.spawn(bin,args,{cwd,env,stdio:'inherit'});for(let sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));child.on('error',err=>{console.error(err);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code||0;});
 if(name==='stemdeck'&&webPort!==undefined){
  const port=Number(webPort);if(!Number.isInteger(port)||port<1||port>65535){child.kill();die('Invalid web port');}
  const data=env.STEMDECK_DATA_DIR||(process.platform==='win32'?(fs.existsSync(path.join(app,'portable.txt'))?path.join(app,'data'):path.join(env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'StemDeck')):path.join(env.XDG_DATA_HOME||path.join(os.homedir(),'.local','share'),'stemdeck'));
  void require('./web-ui.js').exposeWebUI(child,port,path.join(data,'logs','backend.log'));
 }
}
module.exports={copyPortable,repairPortableLinks,installedReleaseMatches,copyStemDeckUpdate};
if(require.main===module)(async()=>{let [cmd,name,mode]=process.argv.slice(2);if(cmd==='install')await install(name,mode);else if(cmd==='start')await start(name,mode);else die('Usage: node manager.js install|start app [mode or web port]');})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
