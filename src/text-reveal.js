// Scroll-linked text reveal, after Magic UI's Text Reveal (21st.dev): every
// word waits as a faint ghost of itself, then fills in to full ink one after
// another as the scroll moves on. Words stay in place; only their opacity
// changes, so the text is laid out (and read by assistive tech) once.

// Wrap each word of `element` in a span, keeping inline markup (em, a) and
// the spaces between words as they were.
function splitWords(element) {
  const words = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  for (const node of nodes) {
    const parts = node.data.split(/(\s+)/);
    if (parts.length === 1 && !parts[0].trim()) continue;
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { fragment.append(part); continue; }
      const word = document.createElement('span');
      word.className = 'reveal-word';
      word.textContent = part;
      fragment.append(word);
      words.push(word);
    }
    node.replaceWith(fragment);
  }
  return words;
}

// `elements` are revealed in order, as one passage. `set(progress, presence)`:
// progress 0..1 runs through the words; presence 0..1 fades the ghosts in.
export function createTextReveal(elements, { ghost = .16, overlap = 2.4 } = {}) {
  const words = elements.flatMap(splitWords);
  const count = words.length;
  let last = '';
  return {
    words,
    set(progress, presence = 1) {
      const key = `${progress.toFixed(4)}:${presence.toFixed(3)}`;
      if (key === last) return;
      last = key;
      // Each word fills over `overlap` word-slots, so the ink runs on smoothly
      // rather than ticking word by word.
      const t = Math.min(Math.max(progress, 0), 1) * (count + overlap);
      for (let i = 0; i < count; i++) {
        const fill = Math.min(Math.max((t - i) / overlap, 0), 1);
        const eased = fill * fill * (3 - 2 * fill);
        words[i].style.opacity = ((ghost + (1 - ghost) * eased) * presence).toFixed(3);
      }
    },
    reset() { last = ''; words.forEach(word => { word.style.opacity = ''; }); },
  };
}
