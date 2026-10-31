// The cars' model files, each fetched once per page and shared. The home
// page's film, its collection drive and About draw some of the same cars in
// three renderers; without this each asked the network for its own copy, two
// at once for the X7 and the Defender. It imports nothing, so a page can ask
// for its cars the moment it starts, before three.js and the scene that will
// draw them have arrived.
const files = new Map();

// The file's bytes, as an ArrayBuffer. `onProgress(share)` follows the
// download, joining one already under way. `priority` is the fetch's
// priority hint: 'low' lets a page fetch ahead without slowing what it shows
// first.
export function fetchModel(url, { onProgress, priority = 'auto' } = {}) {
  let file = files.get(url);
  if (!file) {
    file = { listeners: new Set(), share: 0 };
    file.bytes = download(url, priority, share => { file.share = share; file.listeners.forEach(listener => listener(share)); })
      // A failed download may be asked for again.
      .catch(error => { files.delete(url); throw error; })
      .finally(() => file.listeners.clear());
    files.set(url, file);
  }
  if (onProgress) {
    if (file.share) onProgress(file.share);
    file.listeners.add(onProgress);
  }
  return file.bytes;
}

// Start the downloads for later; nothing waits on them here.
export function prefetchModels(urls, priority = 'low') {
  for (const url of urls) fetchModel(url, { priority }).catch(() => {});
}

// Touch screens (phones, tablets) are mostly on mobile connections, too thin
// to share between a car's photographs and these files. There a car photo
// on screen comes first: while one is loading, model downloads stop, keep
// what they have, and carry on from there (a Range request) once it is in.
// A pause lasts at most HOLD_MS, so a page's own cars are never starved.
const yields = typeof window !== 'undefined' && 'IntersectionObserver' in window && matchMedia('(pointer: coarse)').matches;
const HOLD_MS = 10000;
const waiting = new Set(); // car photos on screen and not yet in
const running = new Set(); // the AbortControllers of the downloads under way
let hold = null; // { done, release, timer } while downloads are paused
let spent = false; // a pause ran its full length: no other until the photos are in
let watcher = null;

// The car photos (img elements) a page shows: on a touch screen, model
// downloads wait while any of them is on screen and loading.
export function photosFirst(images) {
  if (!yields) return;
  watcher ??= new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && !entry.target.complete) waiting.add(entry.target);
      else waiting.delete(entry.target);
    }
    review();
  });
  for (const img of images) {
    watcher.observe(img);
    img.addEventListener('load', review);
    // After the image's own fallback (cards.js) has had its turn.
    img.addEventListener('error', () => setTimeout(review));
  }
}

function review() {
  for (const img of waiting) if (img.complete || !img.isConnected) waiting.delete(img);
  if (!waiting.size) {
    spent = false;
    if (hold) { clearTimeout(hold.timer); hold.release(); hold = null; }
    return;
  }
  if (hold || spent) return;
  let release;
  const done = new Promise(resolve => { release = resolve; });
  hold = { done, release, timer: setTimeout(() => { spent = true; hold.release(); hold = null; }, HOLD_MS) };
  running.forEach(controller => controller.abort());
}

async function download(url, priority, progress) {
  const chunks = [];
  let loaded = 0, total = 0, tag = '';
  for (;;) {
    while (hold) await hold.done;
    const controller = new AbortController();
    running.add(controller);
    try {
      const resuming = loaded > 0;
      const response = await fetch(url, { priority, signal: controller.signal, headers: resuming ? { Range: `bytes=${loaded}-`, ...(tag && { 'If-Range': tag }) } : {} });
      if (!response.ok) throw new Error(`${response.status} loading ${url}`);
      if (resuming && response.status === 206) {
        // Carrying on: the range must start where the pause left off.
        const [, from, size] = response.headers.get('content-range')?.match(/^bytes (\d+)-\d+\/(\d+)$/) || [];
        if (Number(from) !== loaded) { response.body?.cancel(); chunks.length = loaded = 0; tag = ''; continue; }
        total ||= Number(size) || 0;
      } else {
        // From the start (the first time, or the file changed during a pause).
        chunks.length = loaded = 0;
        // A compressed copy's weak ETag names the same file; made strong, it
        // lets the server check a later range is from this same file.
        tag = (response.headers.get('etag') || '').replace(/^W\//, '');
        // A compressed body's announced length is not the file's.
        total = response.headers.get('content-encoding') ? 0 : Number(response.headers.get('content-length')) || 0;
      }
      if (!response.body) { const whole = new Uint8Array(await response.arrayBuffer()); chunks.push(whole); loaded += whole.length; break; }
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) progress(Math.min(1, loaded / total));
      }
      break;
    } catch (error) {
      // Paused: round again, from where it stopped.
      if (!controller.signal.aborted) throw error;
    } finally {
      running.delete(controller);
    }
  }
  progress(1);
  if (chunks.length === 1 && chunks[0].byteOffset === 0 && chunks[0].byteLength === chunks[0].buffer.byteLength) return chunks[0].buffer;
  const whole = new Uint8Array(loaded);
  let at = 0;
  for (const chunk of chunks) { whole.set(chunk, at); at += chunk.length; }
  return whole.buffer;
}
