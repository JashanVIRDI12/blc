import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { createShowroom } from './showroom.js';
import { createCameraPath } from './camera-path.js';
import { createVehicleJourney, interval, smooth } from './motion.js';
import { cameraFrames, mobileCameraFrames, journeys, moments, tethers as tetherSpecs, bonnetProgress, doorProgress, lookAroundWeight as orbitWeight } from './storyboard.js';
import { vehicleParts } from './vehicle-parts.js';
import { inventory, filmVehicles } from './config.js';
import { createTurnGesture } from './turn-gesture.js';
gsap.registerPlugin(ScrollTrigger);

const TYPE_COLOR = '#f1ece2';
const easeOut = t => 1 - (1 - t) ** 3;
const easeIn = t => t ** 3;
const span = m => Math.min(.04, (m.end - m.start) * .3);

// Per headline line: 0 waits under its line box, 1 is set, 2 has risen out.
// Lines follow one another a beat apart, in and out. The opening title
// rises once, on `intro` (0..1), as the loader clears.
function lineProgress(m, p, count, intro) {
  const s = span(m), stagger = s * .26;
  return Array.from({ length: Math.max(count, 1) }, (_, i) => {
    const enter = m.start === 0 ? easeOut(interval(intro, i * .13, i * .13 + .62)) : easeOut(interval(p, m.start + i * stagger, m.start + i * stagger + s));
    const exit = m.end === 1 ? 0 : easeIn(interval(p, m.end - s + i * stagger * .6, m.end + i * stagger * .6));
    return enter + exit;
  });
}
// Supporting copy settles just after the headline and leaves just before it.
function bodyAlpha(m, p, intro = 1) {
  const s = span(m);
  const enter = m.start === 0 ? smooth(interval(intro, .5, 1)) : smooth(interval(p, m.start + s * .55, m.start + s * 1.35));
  const exit = m.end === 1 ? 1 : 1 - smooth(interval(p, m.end - s * 1.1, m.end - s * .35));
  return enter * exit;
}

export function createCinema({ onProgress, onFailure }) {
  const stage = document.querySelector('.cinema');
  const showroom = createShowroom(document.querySelector('#showroom'), onFailure);
  const desktopPath = createCameraPath(cameraFrames), portraitPath = createCameraPath(mobileCameraFrames);
  const travel = Object.fromEntries(Object.entries(journeys).map(([id,config])=>[id, createVehicleJourney(config, vehicleParts[id].wheelbase)]));
  const copies = moments.map(m => {
    const element = document.querySelector(`[data-moment="${m.id}"]`);
    return { ...m, element, heading: element.querySelector('.film-title'), kicker: element.querySelector('.moment-kicker'), body: element.querySelector('.moment-body') };
  });
  const tethers = tetherSpecs.map(t => ({ ...t, element: document.querySelector(`[data-tether="${t.id}"]`), window: moments.find(m => m.id === t.moment) }));
  const chapters = [...document.querySelectorAll('[data-chapter]')].map(button => ({ button, moment: moments.find(m => m.id === button.dataset.chapter) }));
  const playhead = { progress: 0 }, intro = { value: 0 };
  // While the GLS is parked, a sideways drag turns the shot about it.
  // Scrolling on eases the view back onto the film's path, and it is fully
  // back before the car moves (lookAroundWeight in storyboard.js).
  const orbit = { yaw: 0 };
  const hint = stage.querySelector('.turn-hint');
  let lastProgress = 0, looked = false, idle = 0;
  const lookable = () => typeReady && orbitWeight(playhead.progress) === 1;
  const gesture = createTurnGesture(document.querySelector('#showroom'), {
    enabled: lookable,
    onStart() { gsap.killTweensOf(orbit); looked = true; hint?.classList.remove('is-shown'); return {}; },
    // The car follows the finger: dragging right turns its near side right.
    onTurn(dx) { orbit.yaw -= dx / innerWidth * Math.PI * .9; render(); },
    onEnd() { orbit.yaw = Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw)); },
  });
  let timeline, disposed = false, typeReady = false, activeChapter = null, activeRecord = null;

  function bindVerifiedRecord() {
    const record = inventory.find(item => item.model3d === filmVehicles.first && item.available !== false);
    if (record === activeRecord) return;
    activeRecord = record;
    const tyres = record?.inspection?.tyrePercent;
    document.querySelector('[data-verified="tyres"]').textContent = Number.isFinite(tyres) && tyres >= 0 && tyres <= 100 ? `${tyres}% tyre condition` : '';
  }
  function render() {
    const p = playhead.progress;
    const narrow = innerWidth <= 760;
    if (Math.abs(p - lastProgress) > 1e-5) {
      if (orbit.yaw && !gesture.active && !gsap.isTweening(orbit)) gsap.to(orbit, { yaw: 0, duration: .9, ease: 'power3.out', onUpdate: render });
      hint?.classList.remove('is-shown');
      clearTimeout(idle);
      idle = setTimeout(() => hint?.classList.toggle('is-shown', lookable() && !looked), 1400);
    }
    lastProgress = p;
    if (orbitWeight(p) === 0 && !gesture.active) { gsap.killTweensOf(orbit); orbit.yaw = 0; }
    showroom.setOrbit(orbit.yaw * orbitWeight(p));
    const bonnet = bonnetProgress(p);
    const door = doorProgress(p);
    // The showroom is already lit at the opening and comes to full as the car rolls in.
    const light = .62 + .38*smooth(interval(p,0,.167));
    const motion = Object.fromEntries(Object.entries(travel).map(([id, sample])=>[id,sample(p)]));
    const shot = (narrow ? portraitPath : desktopPath)(p);
    const type = {};
    copies.forEach(m => {
      const lines = lineProgress(m, p, typeReady ? showroom.typeLines(m.id) : 1, intro.value);
      const alpha = bodyAlpha(m, p, intro.value);
      const set = Math.max(0, Math.min(lines[0], 2 - lines.at(-1), 1));
      // The large titles travel a little more slowly than the car. Their
      // movement is tied to the film, so reversing the scroll restores it.
      const passage = interval(p, m.start, m.end);
      const drift = m.front ? [0, 0] : [(narrow ? 8 : 28) * (1 - passage), -passage * (narrow ? 8 : 14)];
      type[m.id] = { lines, scrim: set, drift };
      m.kicker.style.opacity = set;
      m.kicker.style.transform = `translate3d(0,${((1 - set) * 8).toFixed(2)}px,0)`;
      m.body.style.opacity = alpha;
      m.body.style.transform = `translate3d(0,${((1 - alpha) * 14).toFixed(2)}px,0)`;
      const showing = typeReady ? set > .02 || alpha > .001 : alpha > .001;
      m.element.classList.toggle('is-visible', showing);
      // Without the WebGL type, the DOM headline carries the fade itself.
      if (!typeReady) m.heading.style.opacity = alpha;
      const readable = Math.max(alpha, set) >= .4;
      m.element.setAttribute('aria-hidden', readable ? 'false' : 'true');
      m.element.inert = !readable;
    });
    showroom.setFrame({
      shot, motion, light, cabin: false, bonnet, door, type,
      // Labels inside the cabin wait for the door: tethers are not occluded,
      // so through a shut door they would float on its skin.
      tethers: tethers.map(t => ({ element: t.element, id: t.vehicle, point: t.point, alpha: bodyAlpha(t.window, p) * (t.inside ? smooth(interval(door, .85, 1)) : 1) })),
    });
    updateChapters(p);
    bindVerifiedRecord();
    if (import.meta.env.DEV) window.__filmProgress = p;
  }
  function updateChapters(p) {
    const current = [...chapters].reverse().find(c => p >= c.moment.start - .004) ?? chapters[0];
    if (current !== activeChapter) {
      activeChapter?.button.removeAttribute('aria-current');
      current.button.setAttribute('aria-current', 'step');
      activeChapter = current;
    }
    const next = chapters[chapters.indexOf(current) + 1]?.moment.start ?? 1;
    stage.style.setProperty('--chapter-fill', interval(p, current.moment.start, next).toFixed(3));
  }
  // Chapters jump the film; the scroll position stays the source of truth.
  function goTo(progress) {
    const st = timeline?.scrollTrigger;
    if (!st) return;
    const y = st.start + (st.end - st.start) * progress;
    const smoother = ScrollSmoother.get();
    if (smoother) smoother.scrollTo(y, true); else scrollTo({ top: y, behavior: 'smooth' });
  }
  chapters.forEach(({ button, moment }) => button.addEventListener('click', () => {
    goTo(moment.start === 0 ? 0 : Math.min(1, moment.start + span(moment) * 1.6));
  }));
  function layoutType() {
    if (disposed) return;
    showroom.layoutType(copies.map(m => ({ id: m.id, element: m.heading, color: TYPE_COLOR, front: Boolean(m.front) })));
    typeReady = true;
    stage.classList.add('has-type');
    copies.forEach(m => { m.heading.style.opacity = ''; });
    render();
  }
  render();
  const ready = showroom.load(onProgress).then(async () => {
    if (disposed) return;
    await document.fonts.ready;
    layoutType();
    timeline = gsap.timeline({
      scrollTrigger: {
        trigger:stage, start:'top top', end:()=>`+=${innerHeight*(innerWidth<=760?3.6:4.2)}`,
        pin:true, scrub:.7, anticipatePin:1, invalidateOnRefresh:true,
        onRefresh:render,
      },
    }).to(playhead,{progress:1,duration:1,ease:'none',onUpdate:render});
    render();
    if (import.meta.env.DEV) window.__showroom = { snapshot:()=>showroom.snapshot(), setProgress:p=>{playhead.progress=p;render();}, scrollTo:p=>{const st=timeline.scrollTrigger;window.scrollTo(0,st.start+(st.end-st.start)*p);}, trigger:()=>({start:timeline.scrollTrigger.start,end:timeline.scrollTrigger.end}) };
  });
  // Draw while the film is on screen, including while it scrolls away after
  // the pin, so the scrub can settle on the final frame.
  const visibility = new IntersectionObserver(([entry]) => showroom.setActive(entry.isIntersecting));
  visibility.observe(stage);
  let relayout = 0;
  const onResize = () => {
    render();
    clearTimeout(relayout);
    if (typeReady) relayout = setTimeout(layoutType, 160);
  };
  addEventListener('resize', onResize);
  return {
    ready,
    // The loader has cleared: the opening title rises into the lit showroom.
    playIntro() { gsap.to(intro, { value: 1, duration: 1.9, ease: 'none', onUpdate: render }); },
    dispose() { disposed=true;clearTimeout(relayout);clearTimeout(idle);gesture.dispose();gsap.killTweensOf(orbit);visibility.disconnect();timeline?.scrollTrigger?.kill(true);timeline?.kill();showroom.dispose();removeEventListener('resize',onResize);stage.classList.remove('has-type');if(import.meta.env.DEV) delete window.__showroom; },
  };
}
