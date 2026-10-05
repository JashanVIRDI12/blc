// Wrap each word of `element` in a span, keeping inline markup (em, a) and
// the spaces between words as they were.
export function splitWords(element, className) {
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
      word.className = className;
      word.textContent = part;
      fragment.append(word);
      words.push(word);
    }
    node.replaceWith(fragment);
  }
  return words;
}
