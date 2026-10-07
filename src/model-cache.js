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

async function download(url, priority, progress) {
  const response = await fetch(url, { priority });
  if (!response.ok) throw new Error(`${response.status} loading ${url}`);
  const total = Number(response.headers.get('content-length')) || 0;
  // Without a length (or a readable body) there is nothing to report until it is in.
  if (!total || !response.body) { const bytes = await response.arrayBuffer(); progress(1); return bytes; }
  const reader = response.body.getReader();
  const bytes = new Uint8Array(total);
  let loaded = 0, chunks = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // A body larger than announced (a proxy re-encoding it) is gathered as it comes.
    if (chunks || loaded + value.length > total) { chunks ??= [bytes.subarray(0, loaded)]; chunks.push(value); }
    else bytes.set(value, loaded);
    loaded += value.length;
    progress(Math.min(1, loaded / total));
  }
  progress(1);
  if (!chunks) return loaded === total ? bytes.buffer : bytes.slice(0, loaded).buffer;
  const whole = new Uint8Array(loaded);
  let at = 0;
  for (const chunk of chunks) { whole.set(chunk, at); at += chunk.length; }
  return whole.buffer;
}
