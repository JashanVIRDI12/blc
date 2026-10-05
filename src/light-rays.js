// Light rays, after React Bits' LightRays (reactbits.dev, by David Haz):
// soft shafts of light fanning down from a point above the frame, drifting
// slowly and leaning a little towards the pointer. Ported from its OGL
// version to plain WebGL, with the same shader but for its fall-off colour. It draws only while the
// container is on screen and the page is visible. Returns null without WebGL.
const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAGMENT = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float fadeDistance;
uniform float saturation;
uniform vec2 mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

float noise(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0);
  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor;
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseDirection = normalize(mousePos * iResolution.xy - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }
  vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  vec4 color = rays1 * 0.5 + rays2 * 0.4;
  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    color.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }
  // The original cools towards blue as the rays fall; here they keep their
  // warmth and only dim.
  float brightness = 1.0 - (coord.y / iResolution.y);
  color.rgb *= 0.2 + brightness * 0.8;
  if (saturation != 1.0) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, saturation);
  }
  color.rgb *= raysColor;
  gl_FragColor = color;
}`;

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

// `origin`: where the rays start, as fractions of the container (y may be
// above it, below 0). The rest are LightRays' own props.
export function createLightRays(container, {
  origin = [.5, -.2], color = '#ffffff', speed = 1, spread = 1, length = 2, fadeDistance = 1,
  saturation = 1, mouseInfluence = .1, noiseAmount = 0, distortion = 0, maxRatio = 1.5,
} = {}) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  // One triangle covers the frame.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const u = name => gl.getUniformLocation(program, name);
  gl.uniform3fv(u('raysColor'), rgb(color));
  gl.uniform1f(u('raysSpeed'), speed);
  gl.uniform1f(u('lightSpread'), spread);
  gl.uniform1f(u('rayLength'), length);
  gl.uniform1f(u('fadeDistance'), fadeDistance);
  gl.uniform1f(u('saturation'), saturation);
  gl.uniform1f(u('mouseInfluence'), mouseInfluence);
  gl.uniform1f(u('noiseAmount'), noiseAmount);
  gl.uniform1f(u('distortion'), distortion);
  gl.uniform2f(u('rayDir'), 0, 1);
  const time = u('iTime'), mouse = u('mousePos');
  container.append(canvas);

  // Resizing a canvas clears it: draw again at once, so no blank frame
  // shows. Keep the container's size independent of content that animates
  // (the Baba standard gives it a fixed height), or the rays are re-aimed on
  // every frame of that animation.
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, maxRatio);
    const w = Math.max(1, Math.round(container.clientWidth * ratio)), h = Math.max(1, Math.round(container.clientHeight * ratio));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u('iResolution'), w, h);
    gl.uniform2f(u('rayPos'), origin[0] * w, origin[1] * h);
    draw(performance.now());
  }

  const pointer = { x: .5, y: .5 }, smooth = { x: .5, y: .5 };
  const onPointer = event => {
    const rect = container.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width;
    pointer.y = (event.clientY - rect.top) / rect.height;
  };
  let visible = false, raf = 0, disposed = false;
  function draw(now) {
    gl.uniform1f(time, now * .001);
    gl.uniform2f(mouse, smooth.x, smooth.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || disposed) return;
    smooth.x += (pointer.x - smooth.x) * .08;
    smooth.y += (pointer.y - smooth.y) * .08;
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if (!raf && visible && !document.hidden && !disposed) raf = requestAnimationFrame(frame); };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; run(); });
  observer.observe(container);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', run);

  return {
    canvas,
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      observer.disconnect(); resizeObserver.disconnect();
      removeEventListener('pointermove', onPointer); document.removeEventListener('visibilitychange', run);
      gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove();
    },
  };
}
