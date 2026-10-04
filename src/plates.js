import * as THREE from 'three';

// Dealer number plates: black acrylic with the Baba Luxury Car logo in gold
// foil. The supplied models carry no usable plates, so each car's audited
// mounting points (vehicle-parts.js) receive one, front and rear.
const SIZE = [.52, .115]; // metres, as the X7's own plates
const LOGO = '/brand/baba-luxury-car.png';
let finish;

// The foil map is white wherever the logo is: there the plate is metal.
function silhouette(logo, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
  const c = canvas.getContext('2d');
  c.drawImage(logo, 0, 0, width, height);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawPlate(logo, foil) {
  const canvas = document.createElement('canvas');
  canvas.width = 1040; canvas.height = 230;
  const c = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, r = 18;
  c.fillStyle = '#000';
  c.fillRect(0, 0, w, h);
  c.beginPath(); c.roundRect(1, 1, w - 2, h - 2, r);
  c.fillStyle = foil ? '#000' : '#0b0b0c'; c.fill();
  c.lineWidth = 3; c.strokeStyle = foil ? '#fff' : '#9a6630';
  c.beginPath(); c.roundRect(12, 12, w - 24, h - 24, r - 8); c.stroke();
  const lh = h * .74, lw = lh * logo.width / logo.height;
  c.drawImage(foil ? silhouette(logo, lw, lh) : logo, (w - lw) / 2, (h - lh) / 2, lw, lh);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = foil ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function plateFinish() {
  return finish ??= new Promise((resolve, reject) => {
    const logo = new Image();
    logo.onload = () => {
      const corners = document.createElement('canvas');
      corners.width = 1040; corners.height = 230;
      const c = corners.getContext('2d');
      c.fillStyle = '#000'; c.fillRect(0, 0, corners.width, corners.height);
      c.beginPath(); c.roundRect(1, 1, corners.width - 2, corners.height - 2, 18); c.fillStyle = '#fff'; c.fill();
      const print = drawPlate(logo, false);
      resolve(new THREE.MeshPhysicalMaterial({
        name: 'Baba plate', map: print, emissiveMap: print, metalnessMap: drawPlate(logo, true),
        alphaMap: new THREE.CanvasTexture(corners), alphaTest: .5,
        metalness: .85, roughness: .32, clearcoat: .8, clearcoatRoughness: .08,
        // A trace of the print's own colour keeps the foil legible in shade.
        emissive: 0xffffff, emissiveIntensity: .14,
      }));
    };
    logo.onerror = reject;
    logo.src = LOGO;
  });
}

// `plates`: [{ at: [x, y, z], normal: [x, y, z] }] in car space. Plates hang on
// the body, so they pitch with it.
export async function mountPlates(body, plates = []) {
  if (!plates.length) return;
  const material = await plateFinish();
  const geometry = new THREE.PlaneGeometry(...SIZE);
  const up = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4();
  for (const { at, normal } of plates) {
    // Face along the bumper's normal, upright, reading correctly from outside.
    const z = new THREE.Vector3(...normal).normalize();
    const y = up.clone().addScaledVector(z, -z.dot(up)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const plate = new THREE.Mesh(geometry, material);
    plate.name = 'Baba plate';
    plate.quaternion.setFromRotationMatrix(basis.makeBasis(x, y, z));
    plate.position.set(...at).addScaledVector(z, .004);
    body.add(plate);
  }
}
