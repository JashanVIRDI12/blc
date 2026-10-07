// Render the actual configured showcase cars through the local Chrome CDP
// session. No Playwright installation is needed. See README for launch steps.
// STILLS=gls npm run stills renders only the listed showcase IDs; FLEET=1
// renders the collection drive's repainted cars (<id>-fleet.webp).
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
const base=process.env.FORMA_SITE_URL || 'http://127.0.0.1:5174';
const debug=process.env.FORMA_CDP_URL || 'http://127.0.0.1:9222';
const tab=await(await fetch(`${debug}/json/new?about:blank`,{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const pending=new Map();
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,m=>m.error?reject(m.error):resolve(m.result));socket.send(JSON.stringify({id,method,params}));});
try {
  const only=process.env.FLEET?'?fleet':process.env.STILLS?`?only=${encodeURIComponent(process.env.STILLS)}`:'';
  await send('Page.navigate',{url:`${base}/tools/stills.html${only}`});
  let stills;
  for(let i=0;i<240;i++){
    await new Promise(resolve=>setTimeout(resolve,250));
    const result=await send('Runtime.evaluate',{expression:'window.__stills',returnByValue:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);
    if(result.result?.value){stills=result.result.value;break;}
  }
  if(!stills)throw new Error('Still rendering timed out. Check the dev server and model assets.');
  await mkdir('public/stills',{recursive:true});
  for(const [id,dataURL]of Object.entries(stills)){
    if(!/^[a-z0-9_-]+$/.test(id))throw new Error('Invalid showcase ID');
    await sharp(Buffer.from(dataURL.split(',')[1],'base64')).trim({threshold:1}).resize({width:1800,withoutEnlargement:true}).webp({quality:91,alphaQuality:92}).toFile(`public/stills/${id}.webp`);
    console.log(`Rendered public/stills/${id}.webp`);
  }
} finally {socket.close();await fetch(`${debug}/json/close/${tab.id}`);}
