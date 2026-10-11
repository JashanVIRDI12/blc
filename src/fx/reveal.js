// Headlines that arrive as type set in metal does: each word rises out of
// its line and settles upright, one after another ([data-reveal="words"]),
// and quieter lines simply come up ([data-reveal="fade"]). Once each, as the
// line comes into view. Reduced motion leaves everything set.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(ScrollTrigger, SplitText);

export function setupReveals(root = document) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('[data-reveal="words"]').forEach(element => {
    SplitText.create(element, {
      type: 'lines,words', mask: 'lines', linesClass: 'fx-line', wordsClass: 'fx-word', autoSplit: true,
      onSplit(self) {
        element.classList.add('is-split');
        return gsap.from(self.words, {
          yPercent: 118, rotate: 5, transformOrigin: '0% 100%', duration: 1.6, ease: 'expo.out', stagger: .075,
          scrollTrigger: { trigger: element, start: 'top 88%', once: true, refreshPriority: -1 },
        });
      },
    });
  });
  root.querySelectorAll('[data-reveal="fade"]').forEach(element => {
    gsap.from(element, { autoAlpha: 0, y: 18, duration: 1.3, ease: 'expo.out', clearProps: 'transform', scrollTrigger: { trigger: element, start: 'top 92%', once: true, refreshPriority: -1 } });
  });
}
