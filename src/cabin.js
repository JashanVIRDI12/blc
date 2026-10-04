import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { glassFinish, plainTransparent } from './glass.js';

// Displays use the model's actual screen geometry. Their UVs were removed
// during model preparation, so restore a planar projection in vehicle space.
export function createCabin(root, chassis, spec) {
  const enabled = Boolean(spec.cabin);
  if (!enabled) return { setLevel() {}, screens: [] };
  if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
  root.updateMatrixWorld(true);
  const screens = [];
  const displayBounds = new THREE.Box3();
  root.traverse(o=>{if(o.isMesh && /gls_(gauges|gps)_screen/.test(o.material.name))displayBounds.union(new THREE.Box3().setFromObject(o));});
  displayBounds.expandByScalar(.012);
  const point = new THREE.Vector3();
  const finishes = {
    gls_torpedka1: [.02,.7], gls_interior: [0,.76],
    steering_leather: [0,.68], gls_leather_niz: [0,.7],
    gls_wood_black: [.08,.26], gls_wood_black1: [.02,.38],
  };
  root.traverse(object => {
    if (!object.isMesh) return;
    const name = object.material.name;
    if (name==='gls_glass_1') clearFunctionalGlazing(object,displayBounds);
    const finish = finishes[name];
    if (finish) {
      // Preserve the authored base colour. Correct only surface response.
      object.material.metalness = finish[0]; object.material.roughness = finish[1];
    }
    if (!['gls_gauges_screen','gls_gps_screen'].includes(name)) return;
    object.geometry = object.geometry.clone();
    const position = object.geometry.attributes.position;
    const bounds = new THREE.Box3().setFromObject(object);
    const uv = new Float32Array(position.count*2);
    for (let i=0;i<position.count;i++) {
      point.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld);
      uv[i*2] = (bounds.max.x-point.x)/(bounds.max.x-bounds.min.x);
      uv[i*2+1] = (point.y-bounds.min.y)/(bounds.max.y-bounds.min.y);
    }
    object.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const texture = displayTexture(name==='gls_gauges_screen' ? 'instruments' : 'navigation');
    const material = new THREE.MeshStandardMaterial({name, color:0x020304, emissive:0xffffff, emissiveMap:texture, emissiveIntensity:.75, metalness:0, roughness:.48, toneMapped:false});
    object.material = material;
    screens.push(material);
  });
  // Neutral light from the windscreen and headliner reveals black surfaces.
  // Local sources travel with the car and do not brighten the whole room.
  const lights = [];
  function softbox(color, power, width, height, position, target) {
    const light = new THREE.RectAreaLight(color,0,width,height);
    light.position.set(...position); light.lookAt(...target);
    chassis.add(light); lights.push({light,power});
  }
  softbox('#fff3e3',2.2,1.35,.65,[0,1.68,.42],[0,.7,.35]);
  softbox('#e5edff',1.5,1.1,.65,[0,1.42,1.08],[0,1,-.45]);
  return {
    screens,
    setLevel(level) {
      lights.forEach(({light,power})=>{light.intensity=power*level;});
      screens.forEach(material=>{material.emissiveIntensity=.4+level*1.6;});
    },
  };
}

function clearFunctionalGlazing(object,bounds) {
  const geometry=object.geometry,position=geometry.attributes.position,index=geometry.index;
  if(!index || bounds.isEmpty())return;
  const point=new THREE.Vector3(),groups=[];
  let count=0;
  for(let start=0;start<index.count;start+=3) {
    let display=true,headlamp=true;
    for(let k=0;k<3;k++) {
      point.fromBufferAttribute(position,index.getX(start+k)).applyMatrix4(object.matrixWorld);
      if(!bounds.containsPoint(point))display=false;
      if(!(point.z>2 && Math.abs(point.x)>.35 && point.y>.8 && point.y<1.12))headlamp=false;
    }
    const materialIndex=display?1:headlamp?2:0;
    if(materialIndex)count++;
    const last=groups.at(-1);
    if(last?.materialIndex===materialIndex)last.count+=3;
    else groups.push({start,count:3,materialIndex});
  }
  if(!count)return;
  // Clear the screen covers and headlamp lenses by triangle position. Keep
  // every window's original tint despite the source's shared material.
  // The screen covers stay plainly transparent: inside the cabin, the room's
  // reflections would only veil the displays. The headlamp lenses are clear
  // polycarbonate: almost no tint, and the room's reflections over the lamp.
  const glazing=plainTransparent(object.material.clone());
  glazing.name='display_glazing';glazing.color.set('#ffffff');
  glazing.opacity=.075;glazing.roughness=.2;glazing.metalness=0;
  const lampGlazing=glassFinish(object.material.clone());lampGlazing.name='headlamp_glazing';
  lampGlazing.color.set('#202224');lampGlazing.metalness=0;
  lampGlazing.opacity=.025;lampGlazing.roughness=.015;lampGlazing.specularIntensity=1;
  object.geometry=geometry.clone();object.geometry.clearGroups();
  groups.forEach(group=>object.geometry.addGroup(group.start,group.count,group.materialIndex));
  object.material=[object.material,glazing,lampGlazing];
}

function displayTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width=1024; canvas.height=kind==='instruments'?440:376;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const background=c.createLinearGradient(0,0,w,h);
  background.addColorStop(0,'#071725');background.addColorStop(.6,'#0b1522');background.addColorStop(1,'#182334');
  c.fillStyle=background;c.fillRect(0,0,w,h);
  const text=(value,x,y,size=22,color='#dcebf1',align='left')=>{
    c.font=`500 ${size}px "Jost", sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(value,x,y);
  };
  const line=(points,color,width=2)=>{
    c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  };
  if(kind==='instruments') {
    const dial=(x,label,max,accent)=>{
      const y=230,r=135,start=.76*Math.PI,end=2.24*Math.PI;
      c.lineWidth=9;c.strokeStyle='#243443';c.beginPath();c.arc(x,y,r,start,end);c.stroke();
      c.strokeStyle=accent;c.lineWidth=4;c.beginPath();c.arc(x,y,r+9,start,end);c.stroke();
      for(let i=0;i<=40;i++) {
        const a=start+(end-start)*i/40,major=i%5===0,inner=r-(major?18:9);
        line([[x+Math.cos(a)*inner,y+Math.sin(a)*inner],[x+Math.cos(a)*(r-2),y+Math.sin(a)*(r-2)]],major?'#d8e6ea':'#526979',major?3:1.5);
        if(major)text(String(Math.round(max*i/40)),x+Math.cos(a)*(r-37),y+Math.sin(a)*(r-37)+7,18,'#9aadb9','center');
      }
      line([[x,y],[x+Math.cos(start)*(r-34),y+Math.sin(start)*(r-34)]],accent,4);
      c.fillStyle='#a5cddc';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();
      text(label,x,y+77,17,'#95abb9','center');
    };
    text('COMFORT',58,45,20,'#9bb5c4');text('P  R  N  D',w-58,45,20,'#c7d8de','right');
    dial(235,'km/h',240,'#80cadd');dial(789,'× 1000 / min',8,'#a8addf');
    text('0',512,195,98,'#f3f6f7','center');text('km/h',512,230,19,'#a8becb','center');
    text('P',512,290,40,'#e1edf1','center');text('PARK',512,324,16,'#7dcdb4','center');
    line([[64,380],[960,380]],'#304754',1);
    text('READY',68,412,17,'#8bcdb8');text('Individual comfort',512,412,17,'#96adbb','center');text('AUTO',958,412,17,'#afc4cd','right');
  } else {
    // An abstract navigation overview, with no fabricated odometer or address.
    c.fillStyle='#101f2b';c.fillRect(260,54,764,265);
    for(let i=0;i<8;i++) {
      const x=290+i*105;
      line([[x,54],[x-20,144],[x+48,227],[x+22,318]],'#243746',9);
    }
    for(let i=0;i<5;i++)line([[260,65+i*55],[430,96+i*48],[640,70+i*55],[830,109+i*48],[1024,80+i*54]],'#2d414d',6);
    line([[790,56],[745,120],[777,180],[736,241],[764,320]],'#264c5b',26);
    line([[530,288],[555,246],[630,229],[655,166],[719,145],[735,109]],'#75d3da',6);
    c.save();c.translate(530,288);c.rotate(.35);c.fillStyle='#d7f9f5';c.beginPath();c.moveTo(0,-16);c.lineTo(11,13);c.lineTo(0,8);c.lineTo(-11,13);c.closePath();c.fill();c.restore();
    c.strokeStyle='#86dce0';c.lineWidth=3;c.beginPath();c.arc(735,109,9,0,Math.PI*2);c.stroke();
    text('Navigation',34,38,22);text('Comfort',432,38,20,'#9dafbb');text('Media',665,38,20,'#9dafbb');text('Settings',858,38,20,'#9dafbb');
    text('Good evening.',32,114,25,'#f0f4f4');text('Your next journey',32,147,16,'#92aab8');
    text('Overview',32,214,22,'#8cdbdf');text('Destinations',32,255,18,'#819ba9');
    line([[28,322],[996,322]],'#304957',1);
    text('22.0°',35,359,23);text('CLIMATE',155,357,14,'#9ab4c0');text('AUTO',470,357,17,'#c8dde2');text('22.0°',983,359,23,'#dcebf1','right');
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
