// End-to-end review against an existing local Chrome debugging session.
// Start Vite and Chrome (see README), then npm run check:browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { aboutAnchor, aboutMarks } from '../src/about-storyboard.js';
import { filmVehicles, showcase } from '../src/config.js';
const base=process.env.FORMA_SITE_URL || 'http://127.0.0.1:5174';
const debug=process.env.FORMA_CDP_URL || 'http://127.0.0.1:9222';
const out=process.env.FORMA_REVIEW_DIR || '/tmp/baba-review';
await fs.mkdir(out,{recursive:true});
const tab=await(await fetch(`${debug}/json/new?about:blank`,{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const requests=new Map(),errors=[];let assets=[];
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id){requests.get(message.id)?.(message);requests.delete(message.id);}
  else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  else if(message.method==='Network.requestWillBeSent')assets.push(message.params.request.url);
});
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++sequence;requests.set(id,m=>m.error?reject(m.error):resolve(m.result));socket.send(JSON.stringify({id,method,params}));
});
const evaluate=async expression=>{
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result?.value;
};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(250);}throw new Error(`Timed out: ${expression}`);};
const navigate=async()=>{await send('Page.navigate',{url:base});await delay(500);await waitFor('document.querySelector("#loader")?.classList.contains("is-complete")');await delay(800);};
const shot=async name=>{const image=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${out}/${name}.png`,Buffer.from(image.data,'base64'));};
const scroll=async progress=>{await evaluate(`window.__showroom.scrollTo(${progress})`);await waitFor(`Math.abs(window.__filmProgress-${progress})<.0004`);await delay(300);};
const aboutScroll=async progress=>{await evaluate(`window.__about.scrollTo(${progress})`);await waitFor(`Math.abs(window.__aboutProgress-${progress})<.0006`);await delay(300);};
const aboutPose=vehicles=>vehicles.map(({id,position,yaw,wheel})=>({id,position:position.map(v=>+v.toFixed(5)),yaw:+yaw.toFixed(5),wheel:+wheel.toFixed(4)}));
async function checkAbout(mobile) {
  const prefix=mobile?'mobile':'desktop';
  // Navigation lands where both cars have stopped and the introduction is set.
  await waitFor('window.__about?.snapshot().ready');
  await evaluate(`document.querySelector('${mobile?'#mobile-menu':'.desktop-nav'} a[href="#about"]').click()`);await delay(1800);
  await waitFor(`Math.abs(window.__aboutProgress-${aboutAnchor})<.002 && window.__about.snapshot().rendered`);await delay(400);
  const state=await evaluate('({about:window.__about.snapshot(),background:getComputedStyle(document.querySelector("#about")).backgroundColor,copy:document.querySelector(".brand-copy").getBoundingClientRect().toJSON(),stage:document.querySelector("#about .brand-visual").getBoundingClientRect().toJSON(),set:getComputedStyle(document.querySelector(".brand-signoff")).opacity,header:document.querySelector(".site-header").classList.contains("is-practical"),sections:[...document.querySelectorAll("main section")].map(n=>n.id),width:document.documentElement.scrollWidth,controls:document.querySelectorAll("button[data-engine],button[data-sound],button[data-orbit]").length})');
  assert.equal(state.background,'rgb(255, 255, 255)');assert.equal(state.about.background,'#ffffff');assert.equal(state.controls,0,'Remove the ignition and orbit system');
  assert.deepEqual(state.sections,['home','inventory','about','standard','sell'],'The film, then the collection, then About Baba');
  assert(state.about.pinned,'The About stage is pinned while the cars are parked');assert(state.header,'The header is in its white practical style');
  assert.deepEqual(state.about.vehicles.map(v=>v.id).sort(),Object.keys(aboutMarks).sort(),'The GLS 580 and the Defender drive in');
  for(const v of state.about.vehicles) assert(Math.hypot(...v.position.map((c,i)=>c-aboutMarks[v.id][i]))<.01,`${v.id} is parked on its mark`);
  assert(Number(state.set)>.99,'The introduction is fully set while the cars are parked');
  assert(await evaluate('[...document.querySelectorAll("#about .reveal-word")].every(w=>Number(getComputedStyle(w).opacity)>.99)'),'Every word of the introduction is revealed while the cars are parked');
  const cars={left:state.stage.left+state.about.bounds.left,top:state.stage.top+state.about.bounds.top};
  if(!mobile)assert(cars.left>state.copy.right,'Cars are framed to the right of the copy');
  else assert(cars.top>=state.copy.bottom-2,'Mobile frames the cars below the copy');
  assert.equal(state.width,mobile?390:1440,'No horizontal overflow');
  assert(await evaluate('document.title.includes("BABA Luxury Cars")'));
  await shot(`${prefix}-baba-about`);
  // Both cars arrive, and both drive away out of frame; reversing restores the parked pose.
  await aboutScroll(.26);await shot(`${prefix}-about-arrival`);
  const arriving=await evaluate('window.__about.snapshot()');
  assert(arriving.vehicles.every(v=>Math.hypot(...v.position.map((c,i)=>c-aboutMarks[v.id][i]))>1),'The cars are still driving in');
  assert(Number(await evaluate('getComputedStyle(document.querySelector(".brand-signoff")).opacity'))<.01,'The introduction waits for the cars');
  assert(await evaluate('[...document.querySelectorAll("#about .reveal-word")].every(w=>Number(getComputedStyle(w).opacity)<.01)'),'The words wait, not even ghosted, until the cars settle');
  await aboutScroll(.74);await shot(`${prefix}-about-departure`);
  const gone=await evaluate('window.__about.snapshot().bounds');
  assert(gone.left>state.about.bounds.left,'The cars leave to the right, away from the copy');
  await aboutScroll(aboutAnchor);
  assert.deepEqual(aboutPose((await evaluate('window.__about.snapshot()')).vehicles),aboutPose(state.about.vehicles),'Reverse scrolling restores the parked pair');
  console.log(`PASS ${prefix} About Baba: white pinned stage, GLS 580 and Defender drive in, copy read in word by word while parked, both drive away, reversal and responsive framing.`);
}
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
try {
  if(process.argv.includes('--smoke')) {
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:process.argv.includes('--retina')?2:1,mobile:false});
    await navigate();assert(await evaluate('!!window.__showroom'),'Showroom should load');
    await evaluate('window.__showroom.setProgress(.3)');await delay(300);
    const snapshot=await evaluate('window.__showroom.snapshot()');
    assert.deepEqual(snapshot.vehicles.map(v=>v.id),[filmVehicles.first],'The film inspects one car');
    if(process.argv.includes('--retina')){
      await delay(350);
      assert.equal((await evaluate('window.__showroom.snapshot()')).dpr,2,'Settled desktop render must return to native Retina detail');
      assert.equal(await evaluate('document.querySelector("#showroom").width'),2880,'Canvas should allocate full Retina width');
    }
    await shot('final-showroom');
    await waitFor('window.__about?.snapshot().ready');assert.deepEqual(errors,[]);
    console.log('PASS final boot: the film and the About cars loaded and rendered with no browser exceptions.');
  } else {
  if(!process.argv.includes('--mobile-only')) {
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await navigate();
  assert(await evaluate('!!window.__showroom'),'WebGL should load');
  await shot('desktop-opening');
  await scroll(.3);const parked=await evaluate('window.__showroom.snapshot()');await shot('desktop-showroom');
  await scroll(.517);await shot('desktop-wheel');
  await scroll(.65);await shot('desktop-engine');
  await scroll(.737);await shot('desktop-open-door');
  await scroll(.832);await shot('desktop-door-closed');
  const closedDoor=(await evaluate('window.__showroom.snapshot()')).vehicles.find(v=>v.id===filmVehicles.first).door;
  assert(Math.abs(closedDoor)<.0001,'Door must be shut before departure');
  await scroll(.925);await shot('desktop-drive-away');
  await scroll(1);await delay(900);await shot('desktop-threshold');
  const threshold=(await evaluate('window.__showroom.snapshot()')).vehicles[0];
  assert(threshold.visible&&threshold.position[2]>12,'The film ends with the car on the front threshold');
  await checkAbout(false);
  await scroll(.3);const reversed=await evaluate('window.__showroom.snapshot()');
  // Lamp glow follows the viewing angle, which lands within the scroll tolerance.
  const pose=vehicles=>vehicles.map(({lights,...rest})=>rest);
  assert.deepEqual(pose(reversed.vehicles),pose(parked.vehicles),'Reverse scrolling must restore wheel and body poses');
  reversed.vehicles.forEach((v,i)=>v.lights.rearGlows.forEach((g,k)=>assert(Math.abs(g-parked.vehicles[i].lights.rearGlows[k])<.005,'Reverse scrolling must restore the lamps')));
  assert.equal(reversed.vehicles.length,1,'The film inspects one car');assert.deepEqual(reversed.vehicles[0].scale,[1,1,1]);
  await evaluate('document.querySelector("#skip-film").click()');await delay(1800);
  const layout=await evaluate('({cinemaBottom:document.querySelector(".cinema").getBoundingClientRect().bottom, inventoryTop:document.querySelector("#inventory").getBoundingClientRect().top, header:document.querySelector(".site-header").getBoundingClientRect().bottom, cards:document.querySelectorAll(".vehicle-card").length, width:document.documentElement.scrollWidth})');
  // The collection follows the film directly; what remains of the film sits under the header.
  assert(layout.cinemaBottom<=layout.inventoryTop+1&&layout.cinemaBottom<=layout.header+1,'Pinned car scene must finish before inventory');assert.equal(layout.cards,showcase.length);
  await shot('desktop-inventory');
  await evaluate('document.querySelector("#vehicle-search").value="No such vehicle";document.querySelector("#vehicle-search").dispatchEvent(new Event("input"))');
  assert(await evaluate('!document.querySelector("#no-results").hidden'));
  await evaluate('document.querySelector("#reset-filters").click();document.querySelector("#make-filter").value="BMW";document.querySelector("#make-filter").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelectorAll(".vehicle-card").length'),1);
  await evaluate('document.querySelector(".vehicle-visual").click()');
  assert(await evaluate('document.querySelector("#vehicle-dialog").open'));
  assert(await evaluate('document.querySelector("#vehicle-details").textContent.includes("Not supplied")'));
  await shot('vehicle-details');
  await evaluate('document.querySelector("#vehicle-enquire").click()');
  assert(await evaluate('document.querySelector("#enquiry-dialog").open'));
  assert(await evaluate('document.querySelector("#enquiry-subject").value.includes("BMW")'));
  const connected=await evaluate('(async()=>{const {dealer}=await import("/src/config.js");return Boolean(dealer.enquiryEndpoint);})()');
  if(!connected){
    await evaluate('(()=>{const f=document.querySelector("#enquiry-dialog form");f.elements.name.value="Browser Review";f.elements.phone.value="9999999999";f.requestSubmit();})()');
    assert(await evaluate('document.querySelector("#enquiry-dialog .form-result").textContent.includes("nothing has been sent")'));
    assert(await evaluate('document.querySelector("#enquiry-dialog pre").textContent.includes("BMW")'));
  }
  await evaluate('document.querySelector("#enquiry-dialog").close();document.querySelector("#reset-filters").click()');
  if(!connected){
    await evaluate('(()=>{const f=document.querySelector("#valuation-form");for(const [k,v]of Object.entries({vehicle:"Review vehicle",registration:"TEST 0000",kilometres:"42000",name:"Browser Review",phone:"9999999999"}))f.elements[k].value=v;f.requestSubmit();})()');
    assert(await evaluate('document.querySelector("#valuation-form pre").textContent.includes("Kilometres: 42000")'));
  }
  console.log('PASS desktop: the film car, door-close/departure to the threshold, reversal, scene boundary, filters, vehicle dialog, enquiries and valuation.');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await navigate();
  assert.equal(await evaluate('innerWidth'),390);assert.equal(await evaluate('document.documentElement.scrollWidth'),390,'No horizontal overflow');
  await scroll(.3);await shot('mobile-showroom');
  await scroll(.517);await shot('mobile-wheel');
  await scroll(.737);await shot('mobile-open-door');
  const cabinSurface=await evaluate('window.__showroom.snapshot().viewSurface');
  assert(!cabinSurface || cabinSurface.distance>.2, 'Portrait open-door camera must remain outside the car');
  // Cars whose dashboard screens were modelled as their own meshes show lit displays.
  const displays=await evaluate(`window.__showroom.snapshot().vehicles.find(v=>v.id==="${filmVehicles.first}").screens`);
  assert(displays.every(screen=>screen.texture && screen.lit>1),'Dashboard displays must be illuminated in the open-door shot');
  assert(await evaluate('window.__showroom.snapshot().studio'),'The supplied studio must be loaded');
  await scroll(1);await delay(900);await shot('mobile-threshold');
  await evaluate('document.querySelector(".menu-toggle").click()');
  assert(await evaluate('!document.querySelector("#mobile-menu").hidden'));
  await checkAbout(true);
  assert(await evaluate('document.querySelector("#mobile-menu").hidden'),'The menu closes after navigating');
  await evaluate('document.querySelector(".menu-toggle").click()');
  await evaluate('document.querySelector(\'#mobile-menu a[href="#inventory"]\').click()');await delay(1200);
  assert(await evaluate('document.querySelector("#mobile-menu").hidden'));await shot('mobile-inventory');
  assert.equal(await evaluate('document.documentElement.scrollWidth'),390);
  console.log('PASS mobile: camera shots, navigation, inventory and overflow.');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assets=[];
  await navigate();
  assert(await evaluate('document.body.classList.contains("static-experience")'));
  assert.equal(await evaluate('document.querySelectorAll(".pin-spacer").length'),0);
  assert(!assets.some(url=>url.endsWith('.glb')),'Reduced motion should not download 3D models');await shot('reduced-motion');
  console.log('PASS reduced motion: static layout, no pinned film and no GLB downloads.');
  await send('Emulation.setEmulatedMedia',{features:[]});
  const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.includes("webgl"))return null;return original.call(this,type,...args);};'});
  await navigate();assert(await evaluate('document.body.classList.contains("static-experience")'));
  assert.equal(await evaluate('document.querySelectorAll(".vehicle-card").length'),showcase.length);
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
  console.log('PASS WebGL failure: static fallback and usable collection.');
  assert.deepEqual(errors,[],'No uncaught browser exceptions');
  console.log(`Screenshots: ${out}`);
  }
} finally {socket.close();await fetch(`${debug}/json/close/${tab.id}`);}
