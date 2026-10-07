import './styles.css';
import './about.css';
import './film.css';
import './fleet.css';
import './india.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { setupFeatured } from './inventory.js';
import { setupForms } from './forms.js';
import { setupMenu, previewBanner } from './chrome.js';
import { loadSite } from './data.js';
import { dealer, lightsVehicles } from './config.js';
import { models } from './models.js';
import { prefetchModels } from './model-cache.js';
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const loader = document.querySelector('#loader');
let cinema, smoother, aboutDrive, fleetDrive, cancelled = false;
const { renderContact } = setupForms();
setupFeatured();
loadSite().then(site=>{renderContact();previewBanner(site);});
document.querySelector('#year').textContent = new Date().getFullYear();
document.body.classList.add('is-loading');

// Keep configured business identity available to dialogs and enquiry drafts.
document.title=`${dealer.name} ${dealer.descriptor} — The art of choosing well.`;
const closeMenu = setupMenu(document.querySelector('#smooth-wrapper'));
function goTo(target, instant = false) {
  closeMenu();
  const element=typeof target==='string'?document.querySelector(target):target;
  if(!element)return;
  // The pinned About drive lands where the cars have stopped and the copy is set.
  if(element.id==='about'&&aboutDrive){aboutDrive.scrollTo(undefined,instant);return;}
  if(element.id==='fleet'&&fleetDrive){fleetDrive.scrollTo(undefined,instant);return;}
  // Sections land at the very top; the glass header sits over their own padding.
  if(smoother) smoother.scrollTo(element,!instant,'top top');
  else scrollTo({top:element.getBoundingClientRect().top+scrollY,behavior:instant||reduced.matches?'instant':'smooth'});
}
// Links into this page (#about, /#about, the logo's /) glide to their
// section; links to other pages leave as usual.
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||link.target||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey)return;
  const url=new URL(link.href,location.href);
  if(url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search)return;
  const id=url.hash.slice(1);
  const element=!id||id==='top'?document.getElementById('home'):document.getElementById(id);
  if(!element)return;
  event.preventDefault();goTo(element);
});
document.querySelector('#skip-film').addEventListener('click',()=>goTo('#fleet'));
document.addEventListener('layout:change',()=>ScrollTrigger.refresh());
function finishLoading() {
  loader.classList.add('is-complete');loader.inert=true;
  cinema?.playIntro();
  document.body.classList.remove('is-loading');
  ScrollTrigger.refresh();
  if(location.hash && document.getElementById(location.hash.slice(1))) setTimeout(()=>goTo(location.hash,true),100);
}
function staticExperience() {
  cancelled=true;cinema?.dispose();cinema=null;aboutDrive?.dispose();aboutDrive=null;fleetDrive?.dispose();fleetDrive=null;
  document.body.classList.add('static-experience');
  document.querySelectorAll('.moment').forEach(el=>{
    const opening=el.dataset.moment==='opening';el.style.opacity=opening?'1':'0';el.classList.toggle('is-visible',opening);el.setAttribute('aria-hidden',String(!opening));el.inert=!opening;el.style.transform='none';
  });
  finishLoading();
}
document.querySelector('#skip-loading').addEventListener('click',()=>{staticExperience();goTo('#inventory',true);});
function initPractical() {
  // Across India: the map, once the stock and its settings are in.
  loadSite().then(async site=>{
    const { createAcrossIndia }=await import('./across-india.js');
    createAcrossIndia(document.querySelector('#india'),{settings:site.settings,deliveries:site.deliveries,cars:site.cars,reduced:reduced.matches});
    ScrollTrigger.refresh();
  }).catch(error=>console.error('The map is unavailable.',error));
  // Glass header from the collection on, its coachline filling as the page is read.
  // onUpdate also catches jumps that skip the whole range.
  const header=document.querySelector('.site-header');
  const practical=self=>{header.classList.toggle('is-practical',self.progress>0);header.style.setProperty('--progress',self.progress.toFixed(4));};
  ScrollTrigger.create({trigger:'#inventory',start:()=>`top ${header.offsetHeight+4}px`,endTrigger:'#contact',end:'bottom bottom',invalidateOnRefresh:true,onUpdate:practical,onRefresh:practical});
  // Pale glass while a white stage (the collection drive, About) is under
  // the header. Observing the rendered band follows the pinned stages and
  // any jump.
  let band;
  const watchBand=()=>{
    band?.disconnect();
    const under=new Set();
    // A white stage still dark (the collection's lights not yet up) keeps the dark header.
    const tone=()=>header.classList.toggle('is-light',[...under].some(element=>!element.classList.contains('is-dark')));
    band=new IntersectionObserver(entries=>{entries.forEach(entry=>entry.isIntersecting?under.add(entry.target):under.delete(entry.target));tone();},{rootMargin:`0px 0px -${Math.max(0,innerHeight-header.offsetHeight)}px 0px`});
    document.removeEventListener('stage:tone',watchBand.tone);watchBand.tone=tone;document.addEventListener('stage:tone',tone);
    ['#fleet','#about'].forEach(selector=>band.observe(document.querySelector(selector)));
  };
  watchBand();
  let rewatch=0;addEventListener('resize',()=>{clearTimeout(rewatch);rewatch=setTimeout(watchBand,200);});
}
// Created after the film so their pins are measured below the film's, the
// collection drive before About; the models load in the background without
// holding the loader. About, further down, loads once the collection drive
// is ready: the drive the visitor reaches next has the network and the GPU
// to itself.
async function startFleet() {
  try {
    const { createLightsOn }=await import('./lights-on.js');
    if(!cancelled)fleetDrive=createLightsOn(document.querySelector('#fleet'));
  } catch(error) { console.error('Collection drive unavailable; keeping the still.',error); }
}
async function startAbout() {
  try {
    const { createAboutDrive }=await import('./about-drive.js');
    if(!cancelled)aboutDrive=createAboutDrive(document.querySelector('#about'),{after:fleetDrive?.loaded});
  } catch(error) { console.error('About drive unavailable; using the static introduction.',error); }
}
async function start() {
  if(reduced.matches){staticExperience();initPractical();return;}
  if(matchMedia('(min-width: 761px) and (pointer: fine)').matches) smoother=ScrollSmoother.create({wrapper:'#smooth-wrapper',content:'#smooth-content',smooth:.8,effects:false,smoothTouch:0});
  try {
    const { createCinema }=await import('./cinema.js');
    if(cancelled){initPractical();return;}
    cinema=createCinema({onProgress:value=>{document.querySelector('#load-bar').style.transform=`scaleX(${value})`;document.querySelector('#load-percent').textContent=`${Math.round(value*100)}%`;},onFailure:staticExperience});
    // The collection drive's cars download behind the film's at a lower
    // priority (model-cache.js), so they are in hand by the time the film
    // ends instead of starting then.
    prefetchModels(lightsVehicles.map(({id})=>models[id].url));
    await cinema.ready;
    if(!cancelled){await startFleet();await startAbout();finishLoading();}
  } catch(error) { console.error('Showroom unavailable; using static collection.',error);staticExperience(); }
  initPractical();
}
reduced.addEventListener('change',()=>{if(reduced.matches){smoother?.kill();smoother=null;staticExperience();ScrollTrigger.refresh();}});
start();
