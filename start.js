module.exports={
 daemon:true,
 run:[{
  method:'shell.run',
  params:{
   path:'.',
   message:'node manager.js start stemdeck {{port}}',
   // WebKit can report this nonfatal X11 warning while CUDA and the UI work.
   on:[{event:'/(http:\\/\\/[0-9.:]+)/',done:true},{event:'/libEGL warning: DRI3 error: Could not get DRI3 device/',break:false}]
  }
 },{
  method:'local.set',
  params:{url:'{{input.event[1]}}'}
 }]
};
