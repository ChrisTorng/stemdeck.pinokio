'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const {setTimeout:delay}=require('node:timers/promises');

async function waitForBackend(logFile,{since=Date.now(),signal,timeout=30*60*1000}={}){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  signal?.throwIfAborted();
  try{
   const stat=await fs.stat(logFile);
   if(stat.mtimeMs>=since){
    const log=await fs.readFile(logFile,'utf8');
    const ports=[...log.matchAll(/Uvicorn running on http:\/\/[\d.]+:(\d+)/g)];
    const pids=[...log.matchAll(/Started server process \[(\d+)\]/g)];
    if(ports.length&&pids.length){
     const base='http://127.0.0.1:'+ports.at(-1)[1];
     const response=await fetch(base+'/api/health',{signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(2000)])});
     const health=await response.json();
     if(response.ok&&health.name==='StemDeck'&&health.status==='ok'&&health.pid===Number(pids.at(-1)[1]))return base;
    }
   }
  }catch(err){if(signal?.aborted)throw err;}
  await delay(1000,undefined,{signal});
 }
 throw Error('StemDeck backend did not become ready; check its logs/setup.log and logs/backend.log');
}

function createWebProxy(base){
 const upstream=new URL(base);
 // Stream requests and responses unchanged, including uploads, ranges and SSE.
 // Only the frame prohibition is removed so Pinokio can embed the application.
 return http.createServer((req,res)=>{
  const request=http.request({hostname:upstream.hostname,port:upstream.port,path:req.url,method:req.method,
   headers:{...req.headers,host:upstream.host}},response=>{
   const headers={...response.headers};
   if(headers['content-security-policy'])headers['content-security-policy']=headers['content-security-policy'].replace(/(?:^|;)\s*frame-ancestors\s+[^;]*/gi,'');
   delete headers['x-frame-options'];
   res.writeHead(response.statusCode,headers);
   response.pipe(res);
   response.on('error',()=>res.destroy());
  });
  request.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('StemDeck backend is unavailable');});
  req.on('aborted',()=>request.destroy());
  res.on('close',()=>request.destroy());
  req.pipe(request);
 });
}

async function exposeWebUI(child,port,logFile){
 const controller=new AbortController();
 let server;
 const stop=()=>{controller.abort();server?.close();server?.closeAllConnections();};
 child.once('exit',stop);child.once('error',stop);
 try{
  console.log('Waiting for StemDeck setup and web backend...');
  const base=await waitForBackend(logFile,{signal:controller.signal});
  controller.signal.throwIfAborted();
  server=createWebProxy(base);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  if(controller.signal.aborted){server.close();return;}
  console.log('StemDeck Web UI: http://127.0.0.1:'+server.address().port);
 }catch(err){
  if(!controller.signal.aborted){console.error(err);stop();child.kill();process.exitCode=1;}
 }
}
module.exports={waitForBackend,createWebProxy,exposeWebUI};
