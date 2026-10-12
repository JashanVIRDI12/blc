// Run against Vite or a bundle built with NODE_ENV=development (dev hooks).
// Keep other GPU-heavy tabs closed; screenshots must be taken in a separate
// run because capturing them interrupts requestAnimationFrame in headless Chrome.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { lightsVehicles } from '../src/config.js';

const mobile = process.argv.includes('--mobile');
const base = process.argv.find(arg => /^https?:\/\//.test(arg)) || process.env.FORMA_SITE_URL || 'http://127.0.0.1:5174';
const debug = process.env.FORMA_CDP_URL || 'http://127.0.0.1:9222';
const width = Number(process.env.W || (mobile ? 390 : 1440));
const height = Number(process.env.H || (mobile ? 844 : 820));
const dpr = Number(process.env.DSF || (mobile ? 3 : 2));
const pause = Number(process.env.WAIT || 4000);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' });
assert(response.ok, `Cannot create a browser tab at ${debug}`);
const tab = await response.json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const requests = new Map(), errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) requests.get(message.id)?.(message);
  else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`Timed out: ${method}`)); }, 30000);
  requests.set(id, message => {
    clearTimeout(timeout); requests.delete(id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
};
async function waitFor(expression, timeout = 90000) {
  const began = Date.now();
  while (Date.now() - began < timeout) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${expression}`);
}
async function wheel(distance, seconds) {
  const ticks = Math.round(seconds * 1000 / 16), began = Date.now();
  const events = [];
  for (let i = 0; i < ticks; i++) {
    // CDP acknowledges a wheel event after the browser consumes it. Waiting
    // for each acknowledgement would halve the input rate on a 60 Hz display.
    events.push(send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: width / 2, y: height / 2, deltaX: 0, deltaY: distance / ticks }));
    const remaining = began + (i + 1) * 16 - Date.now();
    if (remaining > 0) await delay(remaining);
  }
  await Promise.all(events);
  await delay(900); // Let the scrub settle; include those frames in the sample.
}
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  if (process.argv.includes('--cold-network')) await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__homePerf = { frames: [], long: [], marks: {} };
    (() => {
      const data = window.__homePerf;
      let last = 0;
      function frame(now) {
        if (last) data.frames.push([now, now - last]);
        last = now; requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) data.long.push([entry.startTime, entry.duration]);
      }).observe({ type: 'longtask', buffered: true });
    })();
  ` });
  const began = Date.now();
  await send('Page.navigate', { url: base }); await delay(300);
  await waitFor('document.querySelector("#loader")?.classList.contains("is-complete")');
  const loaderMs = Date.now() - began;
  assert(await evaluate('!!window.__showroom && !!window.__fleet'), 'Use Vite or a build made with NODE_ENV=development to expose the scene hooks');
  const mark = name => evaluate(`__homePerf.marks[${JSON.stringify(name)}] = performance.now()`);
  await mark('loaded'); await delay(pause); await mark('start');
  const filmDistance = height * (mobile ? 3.6 : 4.2);
  await wheel(filmDistance, 9); await mark('film');
  const readyOnArrival = await evaluate('__fleet.snapshot().ready');
  await wheel(height * 3.3, 8); await mark('fleet');
  await wheel(-(filmDistance + height * 3.3), 12); await mark('back');
  const measurements = await evaluate(`(() => {
    const {frames, long, marks} = __homePerf;
    const round = n => +n.toFixed(1);
    function sample(from, to) {
      const gaps = frames.filter(([t]) => t >= from && t <= to).map(([,gap]) => gap).sort((a,b) => a-b);
      const tasks = long.filter(([t,d]) => t+d >= from && t <= to).map(([,d]) => d);
      const percentile = q => round(gaps[Math.min(gaps.length-1, Math.floor(gaps.length*q))] || 0);
      return {frames:gaps.length, averageMs:round(gaps.reduce((a,b)=>a+b,0)/Math.max(1,gaps.length)),
        p95Ms:percentile(.95), p99Ms:percentile(.99), maxMs:round(gaps.at(-1)||0),
        over50Ms:gaps.filter(g=>g>50).length, over100Ms:gaps.filter(g=>g>100).length,
        longTasks:tasks.length, longestTaskMs:round(Math.max(0,...tasks))};
    }
    return {browser:navigator.userAgent, film:sample(marks.start,marks.film), fleet:sample(marks.film,marks.fleet),
      back:sample(marks.fleet,marks.back), afterLoader:sample(marks.loaded,marks.start),
      quality:__fleet.snapshot().quality, filmDpr:__showroom.snapshot().dpr};
  })()`);
  // Functional checks follow timing, so they cannot affect the measurements.
  await waitFor('window.__fleet?.snapshot().ready');
  await evaluate('__fleet.scrollTo(.74)');
  await waitFor('Math.abs(__fleet.snapshot().progress-.74)<.001 && __fleet.snapshot().rendered && __fleet.snapshot().words');
  const fleet = await evaluate('__fleet.snapshot()');
  assert.deepEqual(fleet.vehicles.map(v => v.id), lightsVehicles.map(v => v.id), 'Every collection car must be present');
  // Older builds can still be measured for a comparison. Current builds
  // expose the actual drawing path separately from available quality modes.
  if (fleet.rendering) await waitFor('__fleet.snapshot().rendering.fullReady && !__fleet.snapshot().rendering.moving && !__fleet.snapshot().rendering.quick');
  const settledRendering = await evaluate('__fleet.snapshot().rendering');
  await evaluate('__showroom.scrollTo(.3)');
  await waitFor('Math.abs(__filmProgress-.3)<.0004');
  const pose = '__showroom.snapshot().vehicles.map(({id,position,yaw,wheel,steer,door}) => ({id,position,yaw,wheel,steer,door}))';
  const parked = await evaluate(pose);
  await evaluate('__showroom.scrollTo(.74)');
  await waitFor('Math.abs(__filmProgress-.74)<.0004');
  await evaluate('__showroom.scrollTo(.3)');
  await waitFor('Math.abs(__filmProgress-.3)<.0004');
  const reversed = await evaluate(pose);
  assert.deepEqual(reversed, parked, 'Reversing scroll must restore body, wheels, steering and door');
  assert.equal(await evaluate('document.documentElement.scrollWidth'), width, 'No horizontal overflow');
  assert.deepEqual(errors, [], 'No uncaught browser exceptions');
  const report = { date: new Date().toISOString(), url: base, viewport: { width, height, dpr, mobile },
    loaderMs, pauseMs: pause, coldNetwork: process.argv.includes('--cold-network'), readyOnArrival,
    ...measurements, settledRendering,
    checks: { fleet: true, settledFullQuality: settledRendering ? true : null, reversal: true, overflow: true, exceptions: true } };
  const output = process.env.BLC_PERF_REPORT;
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close();
  await fetch(`${debug}/json/close/${tab.id}`);
}
