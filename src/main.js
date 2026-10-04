import './styles.css';
import './about.css';
import './film.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { setupInventory } from './inventory.js';
import { setupForms } from './forms.js';
import { dealer } from './config.js';
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const loader = document.querySelector('#loader');
let cinema, smoother, aboutDrive, cancelled = false;
const { openEnquiry } = setupForms();
setupInventory(openEnquiry);
document.querySelector('#year').textContent = new Date().getFullYear();
document.body.classList.add('is-loading');

// Keep configured business identity available to dialogs and enquiry drafts.
document.title=`${dealer.name} ${dealer.descriptor} — The art of choosing well.`;
const mobileMenu = document.querySelector('#mobile-menu');
const menuButton = document.querySelector('.menu-toggle');
const closeMenu = () => { mobileMenu.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open navigation');document.body.classList.remove('menu-open');document.querySelector('#smooth-wrapper').inert=false; };
menuButton.addEventListener('click',()=>{
  const open=mobileMenu.hidden;mobileMenu.hidden=!open;menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');document.body.classList.toggle('menu-open',open);
  document.querySelector('#smooth-wrapper').inert=open;
});
addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
function goTo(target, instant = false) {
  closeMenu();
  const element=typeof target==='string'?document.querySelector(target):target;
  if(!element)return;
  // The pinned About drive lands where the cars have stopped and the copy is set.
  if(element.id==='about'&&aboutDrive){aboutDrive.scrollTo(undefined,instant);return;}
  // Sections land at the very top; the glass header sits over their own padding.
  if(smoother) smoother.scrollTo(element,!instant,'top top');
  else scrollTo({top:element.getBoundingClientRect().top+scrollY,behavior:instant||reduced.matches?'instant':'smooth'});
}
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');
  if(!link)return;const href=link.getAttribute('href');if(href==='#')return;
  const element=document.getElementById(href.slice(1));if(!element)return;
  event.preventDefault();goTo(element);
});
document.querySelector('#skip-film').addEventListener('click',()=>goTo('#inventory'));
document.querySelectorAll('.standard-list details').forEach(d=>d.addEventListener('toggle',()=>ScrollTrigger.refresh()));
document.addEventListener('layout:change',()=>ScrollTrigger.refresh());
function finishLoading() {
  loader.classList.add('is-complete');loader.inert=true;
  cinema?.playIntro();
  document.body.classList.remove('is-loading');
  ScrollTrigger.refresh();
  if(location.hash && document.getElementById(location.hash.slice(1))) setTimeout(()=>goTo(location.hash,true),100);
}
function staticExperience() {
  cancelled=true;cinema?.dispose();cinema=null;aboutDrive?.dispose();aboutDrive=null;
  document.body.classList.add('static-experience');
  document.querySelectorAll('.moment').forEach(el=>{
    const opening=el.dataset.moment==='opening';el.style.opacity=opening?'1':'0';el.classList.toggle('is-visible',opening);el.setAttribute('aria-hidden',String(!opening));el.inert=!opening;el.style.transform='none';
  });
  finishLoading();
}
document.querySelector('#skip-loading').addEventListener('click',()=>{staticExperience();goTo('#inventory',true);});
function initPractical() {
  // Glass header from the collection on, its coachline filling as the page is read.
  // onUpdate also catches jumps that skip the whole range.
  const header=document.querySelector('.site-header');
  const practical=self=>{header.classList.toggle('is-practical',self.progress>0);header.style.setProperty('--progress',self.progress.toFixed(4));};
  ScrollTrigger.create({trigger:'#inventory',start:()=>`top ${header.offsetHeight+4}px`,endTrigger:'#contact',end:'bottom bottom',invalidateOnRefresh:true,onUpdate:practical,onRefresh:practical});
  // Pale glass while the white About studio is under the header. Observing
  // the rendered band follows the pinned stage and any jump.
  let band;
  const watchBand=()=>{
    band?.disconnect();
    band=new IntersectionObserver(([entry])=>header.classList.toggle('is-light',entry.isIntersecting),{rootMargin:`0px 0px -${Math.max(0,innerHeight-header.offsetHeight)}px 0px`});
    band.observe(document.querySelector('#about'));
  };
  watchBand();
  let rewatch=0;addEventListener('resize',()=>{clearTimeout(rewatch);rewatch=setTimeout(watchBand,200);});
}
// Created after the film so its pin is measured below the film's; the models
// load in the background without holding the loader.
async function startAbout() {
  try {
    const { createAboutDrive }=await import('./about-drive.js');
    if(!cancelled)aboutDrive=createAboutDrive(document.querySelector('#about'));
  } catch(error) { console.error('About drive unavailable; using the static introduction.',error); }
}
async function start() {
  if(reduced.matches){staticExperience();initPractical();return;}
  if(matchMedia('(min-width: 761px) and (pointer: fine)').matches) smoother=ScrollSmoother.create({wrapper:'#smooth-wrapper',content:'#smooth-content',smooth:.8,effects:false,smoothTouch:0});
  try {
    const { createCinema }=await import('./cinema.js');
    if(cancelled){initPractical();return;}
    cinema=createCinema({onProgress:value=>{document.querySelector('#load-bar').style.transform=`scaleX(${value})`;document.querySelector('#load-percent').textContent=`${Math.round(value*100)}%`;},onFailure:staticExperience});
    await cinema.ready;
    if(!cancelled){await startAbout();finishLoading();}
  } catch(error) { console.error('Showroom unavailable; using static collection.',error);staticExperience(); }
  initPractical();
}
reduced.addEventListener('change',()=>{if(reduced.matches){smoother?.kill();smoother=null;staticExperience();ScrollTrigger.refresh();}});
start();
