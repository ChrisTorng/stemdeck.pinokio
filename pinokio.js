module.exports={
 version:'7.0',
 title:'StemDeck',
 description:'Unofficial Pinokio installer for StemDeck',
 menu:async(kernel,info)=>{
  const windows=kernel.platform==='win32',linux=kernel.platform==='linux';
  if(!windows&&!linux)return [{text:'Windows/Linux x64 only',href:'https://github.com/stemdeckapp/stemdeck',popout:true}];
  for(const script of ['install.js','install-online.js','update.js','start.js'])if(info.running(script))return [{default:true,text:'Working / Terminal',href:script}];
  const installed=info.exists('app/.pinokio-installed.json');
  return [...(installed?[{default:true,text:'Start',href:'start.js',icon:'fa-solid fa-play'},{text:'Update',href:'update.js',icon:'fa-solid fa-rotate'}]:[{default:true,text:windows?'Install (NVIDIA)':'Install NVIDIA',href:'install.js',icon:'fa-solid fa-download'}]),
   
   {text:'Upstream repository',href:'https://github.com/stemdeckapp/stemdeck',popout:true}];
 }
};