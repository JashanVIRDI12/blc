import * as THREE from 'three';

export function createVehicleLighting(holder,car,parts) {
  const beams=[],glows=[];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d'),gradient=c.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.15,'rgba(255,255,255,.7)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=gradient;c.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);
  for(const position of parts.headlamps) {
    const lamp=new THREE.SpotLight('#eaf3ff',0,19,.32,.72,2);
    lamp.position.set(...position);lamp.position.z+=.035;
    lamp.target.position.set(position[0]*1.45,.02,position[2]+12);
    holder.add(lamp,lamp.target);beams.push(lamp);
  }
  for(const position of parts.taillamps) {
    // Tail lamps stay visible as a car leaves into the dark beyond a doorway.
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:'#ff1926',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false,dithering:true}));
    sprite.position.set(...position);sprite.scale.set(.23,.13,1);holder.add(sprite);glows.push(sprite);
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(1.35,2.6),new THREE.MeshBasicMaterial({map:texture,color:'#ba0b13',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,dithering:true}));
    pool.rotation.x=-Math.PI/2;pool.position.set(position[0],.012,position[2]-.85);pool.userData.floorDecal=true;holder.add(pool);glows.push(pool);
  }
  return {
    // `distance` from the camera: far tail lamps keep a readable size, as
    // they do to the eye when a car leaves into the dark.
    setLevel(level,interactive=false,rearFacing=1,distance=0) {
      car.setHeadlights(level);car.setTaillights(level);
      beams.forEach(light=>{light.intensity=level*(interactive?900:135);});
      const far=THREE.MathUtils.clamp((distance-12)/20,0,1);
      glows.forEach(glow=>{
        glow.material.opacity=Math.min(1,level*(glow.isSprite ? .42*rearFacing*(1+1.6*far) : .1));
        if(glow.isSprite)glow.scale.set(.23*(1+1.4*far),.13*(1+1.4*far),1);
      });
    },
    snapshot:()=>({beams:beams.map(light=>light.intensity),rearGlows:glows.map(glow=>glow.material.opacity),materials:car.lightState()}),
  };
}
