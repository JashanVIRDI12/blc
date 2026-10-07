import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrivePath, createVehicleJourney } from '../src/motion.js';
import { createCameraPath } from '../src/camera-path.js';
import { PerspectiveCamera, Vector3 } from 'three';
import { journeys, cameraFrames, mobileCameraFrames, wipes, doorProgress, bonnetProgress, lookAroundWeight, moments } from '../src/storyboard.js';
import { aboutJourneys, aboutMarks, aboutCamera, aboutAnchor, aboutTurn, aboutTurnWeight } from '../src/about-storyboard.js';
import { carCorners, fitFrame, frameCamera, freeRegion, screenBounds } from '../src/about-framing.js';
import { filmVehicles, aboutVehicles, lineupVehicles, fleetVehicles } from '../src/config.js';
import { slots, stagePoints, lineupCamera, carouselShot, lineupReveal, orbitLimits, orbitShot, maxElevation } from '../src/lineup.js';
import { vehicleParts } from '../src/vehicle-parts.js';
import { showroomRoom } from '../src/showroom-room.js';
const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
const angle = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));

// The film and About journeys separately: one car may appear in both.
const allJourneys = [...Object.entries(journeys).map(([id, c]) => ['film', id, c]), ...Object.entries(aboutJourneys).map(([id, c]) => ['about', id, c])];
for (const [scene, id, config] of allJourneys) {
  const parts = vehicleParts[id];
  test(`${scene} ${id}: path length, heading and steering agree with physical travel`,()=>{
    for(const kind of ['arrival','departure']) {
      const path=createDrivePath(config[kind].points,parts.wheelbase);
      let previous=path.sample(0), summedDistance=0;
      for(let i=1;i<=2000;i++) {
        const current=path.sample(i/2000);
        const travelled=distance(current.position,previous.position);
        summedDistance+=travelled;
        assert(current.distance>=previous.distance,'Distance must advance monotonically');
        if(travelled>.005) {
          const dx=current.position[0]-previous.position[0], dz=current.position[2]-previous.position[2];
          assert(Math.abs(angle(current.yaw,Math.atan2(dx,dz)))<.04,'Heading must follow travel without sideways sliding');
          const curvature=Math.abs(angle(current.yaw,previous.yaw))/travelled;
          assert(Math.atan(curvature*parts.wheelbase)<.59,'Path must stay inside the steering range');
        }
        assert.equal(current.position[1],0,'Tyres must remain on the floor');
        previous=current;
      }
      assert(Math.abs(path.length-summedDistance)<.015,'Wheel distance must match geometric travel');
      assert(path.sample(.0001).distance<.00001,'Vehicle must accelerate from rest');
      assert(path.length-path.sample(.9999).distance<.00001,'Vehicle must decelerate to rest');
    }
  });
  test(`${scene} ${id}: scroll reversal and arrival/departure boundaries are continuous`,()=>{
    const journey=createVehicleJourney(config,parts.wheelbase);
    const parked=journey(config.arrival.end+.001);
    assert.deepEqual(journey((config.arrival.end+config.departure.start)/2),parked,'Inspection cannot rotate or move the parked car');
    for(const at of [config.arrival.start,config.arrival.end,config.departure.start,config.departure.end]) {
      const before=journey(at-.000001),after=journey(at+.000001);
      assert(distance(before.position,after.position)<.0001,'No position jump at a boundary');
      assert(Math.abs(angle(before.yaw,after.yaw))<.001,'No heading snap at a boundary');
      assert(Math.abs(before.steer-after.steer)<.001,'Wheels must straighten continuously');
      assert(Math.abs(before.distance-after.distance)<.0001,'No wheel rotation jump');
    }
    const checkpoints=[.02,.08,.15,.31,.45,.55,.6,.67,.71,.8,.9,.97];
    const forward=checkpoints.map(t=>structuredClone(journey(t)));
    checkpoints.toReversed().forEach((t,i)=>assert.deepEqual(journey(t),forward[forward.length-1-i],'Reverse scroll must reconstruct the same pose'));
  });
}
for(const [name,frames] of [['desktop',cameraFrames],['mobile',mobileCameraFrames]]) {
  test(`${name}: camera stays outside body geometry for the entire continuous film`,()=>{
    const camera=createCameraPath(frames);
    const travel=Object.fromEntries(Object.entries(journeys).map(([id,c])=>[id,createVehicleJourney(c,vehicleParts[id].wheelbase)]));
    for(let i=0;i<=2400;i++) {
      const p=i/2400, shot=camera(p);
      assert(shot.position.every(Number.isFinite) && shot.target.every(Number.isFinite));
      for(const [id,journey] of Object.entries(travel)) {
        const car=journey(p),dx=shot.position[0]-car.position[0],dz=shot.position[2]-car.position[2];
        const x=dx*Math.cos(car.yaw)-dz*Math.sin(car.yaw),z=dx*Math.sin(car.yaw)+dz*Math.cos(car.yaw);
        assert(!(Math.abs(x)<1.15 && Math.abs(z)<2.65 && shot.position[1]<1.9),`Camera inside ${id} at ${p}`);
      }
    }
    assert.equal(frames.filter(f=>f.cut).length,0,'The film must have no cuts');
    assert.equal(wipes.length,0,'The film must have no hidden wipe transitions');
  });
  test(`${name}: camera stays inside the showroom, under its ceiling grid`,()=>{
    const camera=createCameraPath(frames);
    for(let i=0;i<=3000;i++) {
      const [x,y,z]=camera(i/3000).position;
      assert(Math.abs(x)<showroomRoom.wall.inner-.5, `Camera crosses a side wall at ${i/3000}`);
      assert(Math.abs(z)<showroomRoom.wall.inner-.5,`Camera crosses the front or rear wall at ${i/3000}`);
      assert(y>.3 && y<showroomRoom.ceiling-.4, `Camera must stay above the floor and below the ceiling at ${i/3000}`);
    }
  });
  test(`${name}: the walkaround circles one way, under a full turn, without stalling`,()=>{
    const camera=createCameraPath(frames), from=journeys[filmVehicles.first].arrival.end, to=journeys[filmVehicles.first].departure.start;
    const azimuth=p=>{const [x,,z]=camera(p).position;return Math.atan2(x,z);};
    let swept=0,previous=azimuth(from);const steps=2000,rates=[];
    for(let i=1;i<=steps;i++) {
      const p=from+(to-from)*i/steps,a=azimuth(p),delta=angle(a,previous);
      assert(delta>-1e-9,`Walkaround reverses direction at ${p.toFixed(4)}`);
      swept+=delta;rates.push(delta);previous=a;
    }
    const mean=swept/steps;
    assert(swept>Math.PI*1.1 && swept<Math.PI*1.9,`Walkaround sweeps ${(swept*180/Math.PI).toFixed(0)} degrees`);
    // It may settle as the car parks and before it drives away, nowhere between.
    const walking=rates.slice(steps*.1,steps*.9);
    assert(Math.min(...walking)>mean*.12,'The camera keeps walking between inspection points instead of stopping at each');
  });
}
// Conservative 2.3 x 5.8 m footprint includes mirrors on both SUVs.
const outline=car=>{
  const points=[],corners=[[-1.15,-2.9],[1.15,-2.9],[1.15,2.9],[-1.15,2.9]];
  corners.forEach((a,i)=>{const b=corners[(i+1)%4];for(let k=0;k<60;k++){
    const x=a[0]+(b[0]-a[0])*k/60,z=a[1]+(b[1]-a[1])*k/60;
    points.push([car.position[0]+x*Math.cos(car.yaw)+z*Math.sin(car.yaw),car.position[2]-x*Math.sin(car.yaw)+z*Math.cos(car.yaw)]);
  }});
  return points;
};
test('both complete vehicle footprints pass through the doorways, never the walls',()=>{
  const {inner,outer}=showroomRoom.wall,slab=v=>Math.abs(v)>inner-.2&&Math.abs(v)<outer+.2;
  for(const [id,config] of Object.entries(journeys)) {
    const sample=createVehicleJourney(config,vehicleParts[id].wheelbase);
    for(let i=0;i<=4000;i++) {
      const car=sample(i/4000);
      for(const [x,z] of outline(car)) {
        if(Math.abs(x)<outer+.2&&slab(z)) {
          const door=showroomRoom.doorways.find(d=>Math.sign(d.z)===Math.sign(z));
          assert(door&&x>door.x[0]+.15&&x<door.x[1]-.15,`${id} strikes the ${z>0?'front':'rear'} wall at ${i/4000}`);
        }
        assert(!(Math.abs(z)<outer+.2&&slab(x)),`${id} strikes a side wall at ${i/4000}`);
      }
    }
  }
  assert(showroomRoom.doorways.every(d=>d.height>2.2),'Doorways must clear the SUVs');
});
test('the camera remains continuous and does not orbit after the interior',()=>{
  const camera=createCameraPath(cameraFrames);
  assert(cameraFrames.every(f=>!f.orbit),'There must be no 360-degree orbit');
  for(let i=1;i<=10000;i++) assert(distance(camera(i/10000).position,camera((i-1)/10000).position)<.2,'No camera jump');
  for(let i=737;i<=1000;i++) assert(camera(i/1000).position[0]>2,'The camera pulls back on the door side, without circling the car');
});
test('the bonnet and door are shut before departure; the car drives out through the front doorway',()=>{
  const first=journeys[filmVehicles.first];
  if(vehicleParts[filmVehicles.first].supports.engine) assert(bonnetProgress(.64)>.99 && bonnetProgress(.7)===0,'Bonnet open for the engine, shut before the cabin');
  else for(let p=0;p<=1;p+=.001) assert.equal(bonnetProgress(p),0,'A car without a modelled engine keeps its bonnet shut');
  assert(doorProgress(.742)>.99,'The interior must be revealed before departure');
  assert.equal(doorProgress(first.departure.start),0,'Shut the door before driving');
  for(let p=first.departure.start;p<=first.departure.end;p+=.001)assert.equal(doorProgress(p),0);
  const sample=createVehicleJourney(first,vehicleParts[filmVehicles.first].wheelbase),parked=sample(first.departure.start);
  const moved=sample(first.departure.start+.03).position.map((v,i)=>v-parked.position[i]);
  assert(moved[0]*Math.sin(parked.yaw)+moved[2]*Math.cos(parked.yaw)>0,'Drive forwards after the reveal');
  assert(Math.max(...sample(first.departure.end).position.map(Math.abs))>showroomRoom.wall.outer+8,'The departure continues beyond the showroom');
  // The film ends as the car crosses the front threshold: nose out, tail lamps in the light.
  const last=sample(1),nose=last.position[2]+2.6*Math.cos(last.yaw),tail=last.position[2]-2.6*Math.cos(last.yaw);
  assert(nose>showroomRoom.wall.inner && tail<showroomRoom.wall.inner-1.5,'The last frame holds the car on the front threshold');
  assert(last.visible && sample(0).visible,'The car is in the showroom from the first frame to the last');
});

// The About drive on white. Footprints are oriented rectangles with a margin.
const about=Object.fromEntries(Object.entries(aboutJourneys).map(([id,c])=>[id,createVehicleJourney(c,vehicleParts[id].wheelbase)]));
const footprint=(state,[width,,length],margin)=>{
  const c=Math.cos(state.yaw),s=Math.sin(state.yaw);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>{const x=u*(width/2+margin),z=v*(length/2+margin);return [state.position[0]+x*c+z*s,state.position[2]-x*s+z*c];});
};
const separated=(a,b)=>[a,b].some(poly=>poly.some((p,i)=>{
  const q=poly[(i+1)%4],axis=[q[1]-p[1],p[0]-q[0]];
  const project=points=>points.map(([x,z])=>x*axis[0]+z*axis[1]);
  const pa=project(a),pb=project(b);
  return Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa);
}));
test('about: the two cars never touch, and both stop at their marks',()=>{
  const [near,far]=[aboutVehicles.near,aboutVehicles.far];
  for(let i=0;i<=4000;i++){
    const p=i/4000;
    assert(separated(footprint(about[near](p),vehicleParts[near].size,.2),footprint(about[far](p),vehicleParts[far].size,.2)),`The About cars touch at ${p}`);
  }
  const parked=[Math.max(...Object.values(aboutJourneys).map(j=>j.arrival.end)),Math.min(...Object.values(aboutJourneys).map(j=>j.departure.start))];
  assert(aboutAnchor>parked[0] && aboutAnchor<parked[1],'Navigation lands while both cars are parked');
  for(const [id,sample] of Object.entries(about)) for(let p=parked[0];p<=parked[1];p+=.005) {
    assert(distance(sample(p).position,aboutMarks[id])<1e-6,`${id} rests on its mark while parked`);
  }
});
// Representative stage layouts: the copy's rect as laid out by about.css,
// measured in Chrome at the anchor.
const layouts=[
  { name:'desktop', view:'desktop', width:1440, height:900, header:84, copy:{left:86,right:566,top:256,bottom:718} },
  { name:'phone', view:'portrait', width:390, height:844, header:68, copy:{left:23,right:367,top:93,bottom:350} },
  { name:'phone with toolbars', view:'portrait', width:390, height:664, header:68, copy:{left:23,right:367,top:88,bottom:296} },
  { name:'tablet portrait', view:'portrait', width:820, height:1180, header:68, copy:{left:49,right:771,top:103,bottom:537} },
];
for(const layout of layouts) {
  const {width,height}=layout,frames=aboutCamera[layout.view].frames,path=createCameraPath(frames);
  const region=freeRegion(layout.view,width,height,layout.copy,layout.header);
  const boxes=p=>Object.entries(about).map(([id,sample])=>({id,state:sample(p),corners:carCorners(sample(p),vehicleParts[id].size)}));
  const fit=fitFrame({shot:path(aboutAnchor),width,height,region,boxes:boxes(aboutAnchor).map(b=>b.corners)});
  const camera=new PerspectiveCamera(30,width/height,.1,500);
  const view=p=>frameCamera(camera,path(p),width,height,fit);
  const inFrame=b=>b.right>0&&b.left<width&&b.bottom>0&&b.top<height;
  test(`about (${layout.name}): the parked pair fills the space beside the copy`,()=>{
    const b=screenBounds(view(aboutAnchor),boxes(aboutAnchor).map(x=>x.corners),width,height);
    assert(b.left>=region.left-1&&b.right<=region.right+1&&b.top>=region.top-1&&b.bottom<=region.bottom+1,'Parked cars stay inside the free region');
    assert((b.right-b.left)/(region.right-region.left)>.97||(b.bottom-b.top)/(region.bottom-region.top)>.97,'The pair fills the free region along one axis');
  });
  // The copy is always set, so this holds for the whole drive; a car still
  // lost in the white (fog over 80%) cannot be seen behind it.
  test(`about (${layout.name}): the cars never pass behind the copy`,()=>{
    const [fogNear,fogFar]=aboutCamera[layout.view].fog;
    for(let i=0;i<=2000;i++) {
      const p=i/2000,cam=view(p);
      for(const {id,corners} of boxes(p)) {
        const b=screenBounds(cam,[corners],width,height);
        assert(!b.behind,`${id} passes behind the camera at ${p}`);
        const nearest=Math.min(...corners.map(c=>c.distanceTo(cam.position)));
        if(!inFrame(b)||(nearest-fogNear)/(fogFar-fogNear)>.8) continue;
        const clear=b.right<layout.copy.left||b.left>layout.copy.right||b.bottom<layout.copy.top||b.top>layout.copy.bottom;
        assert(clear,`${id} crosses the copy at ${p.toFixed(3)}`);
      }
    }
  });
  test(`about (${layout.name}): the cars arrive out of the white or from beyond the frame, and leave it`,()=>{
    const [fogNear,fogFar]=aboutCamera[layout.view].fog;
    for(const {id,corners} of boxes(0)) {
      const cam=view(0),b=screenBounds(cam,[corners],width,height);
      const nearest=Math.min(...corners.map(c=>c.distanceTo(cam.position)));
      assert(!inFrame(b)||(nearest-fogNear)/(fogFar-fogNear)>.8,`${id} is visible before it arrives`);
    }
    for(const {id,corners} of boxes(1)) assert(!inFrame(screenBounds(view(1),[corners],width,height)),`${id} is still in frame at the end`);
  });
}
test('about: the camera drifts continuously',()=>{
  for(const {frames} of Object.values(aboutCamera)) {
    const path=createCameraPath(frames);
    for(let i=1;i<=4000;i++) assert(distance(path(i/4000).position,path((i-1)/4000).position)<.02,'No camera jump');
  }
});
test('every car in the film, About and the lineup carries a front and a rear plate on its body, facing out',()=>{
  // The collection drive's cars wear none (fleet-drive.js removes them all).
  const plated=new Set([filmVehicles.first,...Object.values(aboutVehicles),...lineupVehicles]);
  for(const [id,parts] of Object.entries(vehicleParts).filter(([id])=>plated.has(id))) {
    const [width,height,length]=parts.size;
    assert.equal(parts.plates?.length,2,`${id} needs a front and a rear plate`);
    const [front,rear]=parts.plates;
    for(const {at,normal} of parts.plates) {
      // A rear-mounted spare wheel stands proud of the tailgate and bumper.
      const end=length/2-(at[2]<0?parts.spare??0:0);
      assert(Math.abs(at[0])<.05,`${id} plate sits on the centre line`);
      assert(at[1]>.3&&at[1]<height*.65,`${id} plate sits at bumper or tailgate height`);
      assert(Math.abs(at[2])<end+.02&&Math.abs(at[2])>end-.2,`${id} plate sits on the body's end`);
      assert(Math.sign(normal[2])===Math.sign(at[2])&&Math.abs(normal[2])>.9,`${id} plate faces out from its end`);
    }
    assert(front.at[2]>0&&rear.at[2]<0,`${id} has one plate at each end`);
    assert(Math.abs(front.at[0])<width/2,`${id} plate stays within the body`);
  }
});
test('turning by hand only counts while the cars are parked, and is undone before they move',()=>{
  const first=journeys[filmVehicles.first];
  for(let i=0;i<=4000;i++){
    const p=i/4000,w=lookAroundWeight(p);
    assert(w>=0&&w<=1);
    if(p<=first.arrival.end||p>=first.departure.start-.01)assert.equal(w,0,`The film turns while the car moves at ${p}`);
  }
  assert.equal(lookAroundWeight((first.arrival.end+first.departure.start)/2),1,'Full turn while parked');
  const arrived=Math.max(...Object.values(aboutJourneys).map(j=>j.arrival.end)),leaving=Math.min(...Object.values(aboutJourneys).map(j=>j.departure.start));
  assert(aboutTurn.from>=arrived&&aboutTurn.settle<=leaving,'About turns sit inside the parked window');
  for(let i=0;i<=4000;i++){const p=i/4000;if(p<=arrived||p>=leaving)assert.equal(aboutTurnWeight(p),0,`About cars turned while moving at ${p}`);}
  for(let p=aboutTurn.start;p<=aboutTurn.until;p+=.005)assert.equal(aboutTurnWeight(p),1);
  assert(aboutAnchor>=aboutTurn.start&&aboutAnchor<=aboutTurn.until,'Navigation lands where the cars can be turned');
});

// The logo on the back wall is lit for the whole film. It must stand clear
// of the two headlines composed around the room: the opening title at rest,
// and the departure line. (In the inspection shots it may stand beside a
// headline, far off and dimmed by distance, behind the type's halo; while the
// car drives across the opening title, the car, not the wall, crosses it.)
test('the lit logo stands clear of the opening and departure headlines',()=>{
  const {logo,wall}=showroomRoom,height=logo.width/logo.aspect;
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>new Vector3(logo.x+u*logo.width/2,logo.y+v*height/2,-(wall.inner-.012)));
  // Where each headline is set (film.css), as fractions of the frame.
  const place={opening:'hero',condition:'lead',tyres:'trail',mechanical:'low',interior:'lead',departure:'centre'};
  const regions={
    desktop:{hero:{l:.06,r:.80,t:.30,b:.48},lead:{l:.04,r:.5,t:.18,b:.55},trail:{l:.5,r:.96,t:.18,b:.5},low:{l:.04,r:.5,t:.45,b:.8},centre:{l:.16,r:.84,t:.30,b:.48}},
    mobile:{hero:{l:.06,r:.85,t:.27,b:.44},lead:{l:0,r:1,t:.12,b:.42},trail:{l:0,r:1,t:.12,b:.42},low:{l:0,r:1,t:.12,b:.42},centre:{l:.06,r:.94,t:.27,b:.34}},
  };
  for(const [name,frames,aspect] of [['desktop',cameraFrames,1.6],['mobile',mobileCameraFrames,390/844]]) {
    const path=createCameraPath(frames),camera=new PerspectiveCamera(34,aspect,.05,100);
    for(const m of moments.filter(m=>['opening','departure'].includes(m.id))) {
      const span=Math.min(.04,(m.end-m.start)*.3),from=m.start===0?0:m.start+span,to=m.start===0?.03:m.end-span;
      for(let p=from;p<=to;p+=.002) {
        const shot=path(p);
        camera.position.set(...shot.position);camera.lookAt(...shot.target);camera.fov=shot.fov;
        camera.setViewOffset(1000,1000/aspect,-shot.offset[0]*1000,-shot.offset[1]*1000/aspect,1000,1000/aspect);
        camera.updateProjectionMatrix();camera.updateMatrixWorld();
        const points=corners.map(c=>c.clone().project(camera));
        if(points.some(q=>q.z>1))continue;
        const box={l:Math.min(...points.map(q=>(q.x+1)/2)),r:Math.max(...points.map(q=>(q.x+1)/2)),t:Math.min(...points.map(q=>(1-q.y)/2)),b:Math.max(...points.map(q=>(1-q.y)/2))};
        const head=regions[name][place[m.id]];
        const clear=box.r<head.l||box.l>head.r||box.b<head.t||box.t>head.b||box.r<0||box.l>1||box.b<0||box.t>1;
        assert(clear,`${name}: the logo stands behind the ${m.id} headline at ${p.toFixed(3)}`);
      }
    }
  }
});

// The collection after the film (src/lineup.js).
const parked=id=>({position:slots[id].position,yaw:slots[id].yaw});
const insidePolygon=([x,z],poly)=>poly.reduce((inside,p,i)=>{const q=poly[(i+1)%poly.length];return ((p[1]>z)!==(q[1]>z))&&(x<(q[0]-p[0])*(z-p[1])/(q[1]-p[1])+p[0])?!inside:inside;},false);
test('collection: the configured cars park on the arc, apart, inside the walls',()=>{
  assert.deepEqual(Object.keys(slots).sort(),[...lineupVehicles].sort());
  for(const id of lineupVehicles) for(const [x,z] of footprint(parked(id),vehicleParts[id].size,0)) {
    assert(Math.abs(x)<showroomRoom.wall.inner-.3&&Math.abs(z)<showroomRoom.wall.inner-.3,`${id} parks inside the walls`);
  }
  for(let i=0;i<lineupVehicles.length;i++) for(let k=i+1;k<lineupVehicles.length;k++) {
    const [a,b]=[lineupVehicles[i],lineupVehicles[k]];
    assert(separated(footprint(parked(a),vehicleParts[a].size,.2),footprint(parked(b),vehicleParts[b].size,.2)),`${a} and ${b} park at least 40 cm apart`);
  }
});
test('collection: a chosen car drives straight to the stage, clear of every other car',()=>{
  for(const id of lineupVehicles) {
    const path=createDrivePath(stagePoints(id),vehicleParts[id].wheelbase);
    for(let i=0;i<=400;i++) {
      const pose=path.sample(i/400);
      assert(Math.abs(pose.steer)<1e-6,`${id} drives straight`);
      for(const other of lineupVehicles) if(other!==id) {
        assert(separated(footprint(pose,vehicleParts[id].size,.1),footprint(parked(other),vehicleParts[other].size,.1)),`${id} clears ${other} at ${i/400}`);
      }
    }
    const end=path.sample(1).position;
    assert(Math.hypot(end[0],end[2])<1e-6,`${id} comes to rest on the stage`);
  }
});
const clearOfCars=([x,,z],margin)=>lineupVehicles.every(id=>!insidePolygon([x,z],footprint(parked(id),vehicleParts[id].size,margin)));
const inRoom=([x,y,z])=>Math.abs(x)<showroomRoom.wall.inner-.5&&Math.abs(z)<showroomRoom.wall.inner-.5&&y>.3&&y<showroomRoom.ceiling-.4;
test('collection: every camera stays in the room, under the ceiling and out of the cars',()=>{
  for(const [name,frames] of Object.entries(lineupCamera)) {
    const path=createCameraPath(frames);
    for(let i=0;i<=1000;i++) { const shot=path(i/1000); assert(inRoom(shot.position)&&clearOfCars(shot.position,.4),`${name} line-up camera at ${i/1000}`); }
  }
  for(let f=0;f<=lineupVehicles.length-1;f+=.05) { const shot=carouselShot(f); assert(inRoom(shot.position)&&clearOfCars(shot.position,.4),`carousel camera at ${f}`); }
  const [near,far]=orbitLimits.distance,[low]=orbitLimits.elevation;
  for(let yaw=0;yaw<Math.PI*2;yaw+=.05) for(const distance of [near,(near+far)/2,far]) for(const elevation of [low,maxElevation(distance)]) {
    const shot=orbitShot(yaw,elevation,distance,40);
    assert(inRoom(shot.position)&&clearOfCars(shot.position,.4),`orbit camera at yaw ${yaw.toFixed(2)}, ${distance} m`);
  }
});
test('collection: the cars appear, and the film car takes its slot, only while the camera faces away',()=>{
  const camera=new PerspectiveCamera(40,1.6,.05,200);
  const sees=(shot,aspect,corners)=>{
    camera.position.set(...shot.position);camera.lookAt(...shot.target);camera.fov=shot.fov;camera.aspect=aspect;
    camera.setViewOffset(1000,1000/aspect,-shot.offset[0]*1000,-shot.offset[1]*1000/aspect,1000,1000/aspect);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    return corners.some(c=>{const v=c.clone().project(camera);return v.z<1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.05;});
  };
  for(const [name,frames] of Object.entries(lineupCamera)) {
    const path=createCameraPath(frames),aspect=name==='desktop'?1.6:390/844;
    for(const id of lineupVehicles) {
      const corners=carCorners(parked(id),vehicleParts[id].size);
      const appears=id===filmVehicles.first?lineupReveal.filmCarParks:lineupReveal.cars;
      for(let q=0;q<=appears+.01;q+=.002) assert(!sees(path(q),aspect,corners),`${name}: ${id} would be seen appearing at ${q.toFixed(3)}`);
    }
  }
});

// The collection drive (src/fleet-storyboard.js).
import { fleetMarks, fleetJourneys, fleetViews } from '../src/fleet-storyboard.js';
test('collection drive: five cars set off line abreast and park apart, the leader last',()=>{
  for(const view of fleetViews) {
    const marks=fleetMarks(view), journeys=fleetJourneys(view);
    assert.deepEqual(Object.keys(marks),fleetVehicles.map(v=>v.id));
    const starts=new Set(Object.values(journeys).map(j=>j.points[0][2]));
    assert.equal(starts.size,1,`${view}: every car starts on the same line`);
    const ids=Object.keys(marks);
    for(let i=0;i<ids.length;i++) for(let k=i+1;k<ids.length;k++) {
      const [a,b]=[ids[i],ids[k]], [wa,,la]=vehicleParts[a].size, [wb,,lb]=vehicleParts[b].size;
      const apartX=Math.abs(marks[a][0]-marks[b][0])-(wa+wb)/2, apartZ=Math.abs(marks[a][2]-marks[b][2])-(la+lb)/2;
      assert(apartX>.2||apartZ>.2,`${view}: ${a} and ${b} park clear of each other`);
    }
    const leader=ids.reduce((best,id)=>marks[id][2]>marks[best][2]?id:best);
    assert.equal(Math.max(...Object.values(journeys).map(j=>j.end)),journeys[leader].end,`${view}: the leader comes to rest last`);
  }
});

// Lights on, the home page's collection (src/lights-on-storyboard.js).
import { lightsMarks, lightsCamera, lightsViews, LIGHTS, bayLevel, roomLevel } from '../src/lights-on-storyboard.js';
import { lightsVehicles } from '../src/config.js';
const bayFootprint = (mark, [width, , length]) => {
  const c = Math.cos(mark.yaw), s = Math.sin(mark.yaw), [x, , z] = mark.position;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + u * width / 2 * c + v * length / 2 * s, z - u * width / 2 * s + v * length / 2 * c]);
};
// Separating axes: two rectangles on the floor are apart by `gap` metres
// along some edge normal of either.
const bayApart = (a, b, gap) => [a, b].some(poly => poly.some((p, i) => {
  const q = poly[(i + 1) % poly.length], n = [q[1] - p[1], p[0] - q[0]], len = Math.hypot(...n);
  const proj = pts => pts.map(([x, z]) => (x * n[0] + z * n[1]) / len);
  const [pa, pb] = [proj(a), proj(b)];
  return Math.min(...pb) - Math.max(...pa) > gap || Math.min(...pa) - Math.max(...pb) > gap;
}));
test('lights on: the cars (no Land Cruiser) park side by side, apart, in both views', () => {
  for (const view of lightsViews) {
    const marks = lightsMarks(view), ids = Object.keys(marks);
    assert.deepEqual(ids, lightsVehicles.map(v => v.id));
    assert(!ids.includes('landcruiser'));
    for (let i = 0; i < ids.length; i++) for (let k = i + 1; k < ids.length; k++) {
      assert(bayApart(bayFootprint(marks[ids[i]], vehicleParts[ids[i]].size), bayFootprint(marks[ids[k]], vehicleParts[ids[k]].size), .4), `${view}: ${ids[i]} and ${ids[k]} park clear of each other`);
    }
  }
});
test('lights on: the camera never comes within two metres of a car', () => {
  for (const view of lightsViews) {
    const path = createCameraPath(lightsCamera[view]), marks = lightsMarks(view);
    for (let p = 0; p <= 1; p += .002) {
      const [x, , z] = path(p).position;
      for (const [id, mark] of Object.entries(marks)) {
        const cam = [[x - .01, z - .01], [x + .01, z - .01], [x + .01, z + .01], [x - .01, z + .01]];
        assert(bayApart(cam, bayFootprint(mark, vehicleParts[id].size), 2), `${view}: camera too near the ${id} at ${p.toFixed(3)}`);
      }
    }
  }
});
test('lights on: each light comes up in turn with the scroll, steadily, before the studio', () => {
  for (let i = 1; i < LIGHTS.panels.length; i++) assert(LIGHTS.panels[i] > LIGHTS.panels[i - 1]);
  assert(LIGHTS.panels.at(-1) < LIGHTS.room[0] && LIGHTS.room[1] <= LIGHTS.anchor && LIGHTS.words <= LIGHTS.anchor);
  // Never a flicker: every light only ever rises with the scroll.
  LIGHTS.panels.forEach((_, i) => { let before = 0; for (let p = 0; p <= 1; p += .001) { const v = bayLevel(p, i); assert(v >= before - 1e-9, `light ${i} dips at ${p.toFixed(3)}`); before = v; } assert.equal(bayLevel(LIGHTS.room[0], i), 1); });
  assert.equal(roomLevel(LIGHTS.anchor), 1); assert.equal(roomLevel(LIGHTS.panels[0]), 0);
});
