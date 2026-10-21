import { dealer, dealerLines, salesFirst, social } from './config.js';
import { icons, directionLinks } from './icons.js';
import { safeURL } from './util.js';
import { live, supabase } from './data.js';

// With Supabase connected, every enquiry and valuation lands in the admin's
// inbox (the enquiries table: visitors may add one, never read any). A
// one-to-one consultation is a concierge request, about the call itself.
const CONSULTATION = '1:1 consultation call';
export async function saveEnquiry(type, data) {
  const { name, phone, email, interest, message, ...details } = data;
  if (type === 'consultation') return saveEnquiry('concierge', { name, phone, email, interest: CONSULTATION, message, ...details });
  const response = await fetch(`${supabase.url}/rest/v1/enquiries`, {
    method: 'POST',
    headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ kind: ['valuation', 'concierge'].includes(type) ? type : 'enquiry', name: name || null, phone: phone || null, email: email || null, subject: interest || (type === 'valuation' ? `Valuation: ${details.vehicle || 'a car'}` : null), message: message || null, car: new URLSearchParams(location.search).get('id') || null, details, page: `${location.pathname}${location.search}`.slice(0, 300) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Enquiry not saved (${response.status})`);
}

export function setupForms() {
  const enquiry = document.querySelector('#enquiry-dialog');
  // Contact details can arrive after the page (from the admin's settings), so
  // they are read when used, and renderContact() sets them out again.
  const hasContact = () => Boolean(dealer.whatsapp || dealer.email);
  function openEnquiry(subject = '') {
    document.querySelector('#enquiry-subject').value = subject;
    const result = enquiry.querySelector('.form-result'); result.hidden = true; result.replaceChildren();
    enquiry.showModal();
  }
  document.querySelectorAll('[data-enquire]').forEach(button => button.addEventListener('click', event => { if (button.matches('a')) event.preventDefault(); openEnquiry(button.dataset.subject || ''); }));
  // The one-to-one consultation: a call booked in its own dialog.
  const consult = document.querySelector('#consult-dialog');
  function openConsultation() {
    const result = consult.querySelector('.form-result'); result.hidden = true; result.replaceChildren();
    consult.showModal();
  }
  document.querySelectorAll('[data-consult]').forEach(button => button.addEventListener('click', event => { if (button.matches('a')) event.preventDefault(); openConsultation(); }));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close(); });
  });
  const esc = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tel = number => `tel:${String(number).replace(/[^+\d]/g, '')}`;
  function renderContact() {
    // The footer's columns, from the details the admin may have changed:
    // the showroom, its hours and the way there; each line, with WhatsApp
    // (which opens the card of lines, whatsapp.js); where we post.
    const visit = document.querySelector('[data-footer-visit]');
    if (visit && dealer.address) {
      const parts = dealer.address.split(/,\s*/), lines = [parts.slice(0, 2).join(', '), ...parts.slice(2)];
      visit.innerHTML = `<address class="footer-address">${lines.map(esc).join(',<br>')}</address>${dealer.hours ? `<p class="footer-hours">${esc(dealer.hours)}</p>` : ''}<p class="footer-directions">${directionLinks('footer-route')}</p>`;
    }
    const talk = document.querySelector('[data-footer-lines]'), chat = dealer.whatsapp.replace(/\D/g, '');
    // Sales: the numbers in salesFirst, then the admin's, one under another.
    const sales = [...new Set([...salesFirst, dealer.phone].filter(Boolean))];
    if (talk) talk.innerHTML = [
      sales.length && [chat ? 'Sales and WhatsApp' : 'Sales', ...sales],
      ...dealerLines.map(line => [line.label, line.phone]),
    ].filter(Boolean).map(([label, ...numbers]) => `<p class="footer-line"><small>${esc(label)}</small>${numbers.map(number => `<a href="${tel(number)}">${esc(number)}</a>`).join('')}</p>`).join('')
      + (dealer.email ? `<p class="footer-line"><small>Email</small><a class="footer-email" href="mailto:${esc(dealer.email)}">${esc(dealer.email)}</a></p>` : '')
      + (chat ? `<a class="footer-chat" href="https://wa.me/${chat}" target="_blank" rel="noopener" data-wa-open>${icons.whatsapp}Message us on WhatsApp</a>` : '');
    const follow = document.querySelector('[data-social]');
    if (follow) follow.innerHTML = social.map(({ name, icon, url, handle }) => `<a class="footer-follow" href="${url}" target="_blank" rel="noopener"><i>${icons[icon]}</i><span><b>${name}</b><small>${esc(handle || '')}</small></span></a>`).join('');
    if (dealer.enquiryEndpoint || live) document.querySelectorAll('[data-lead-form]').forEach(form => { form.querySelector('[data-submit-label]').textContent = { valuation: 'Request a valuation', consultation: 'Book my call' }[form.dataset.leadForm] || 'Send enquiry'; });
    const whatsapp = dealer.whatsapp.replace(/\D/g, '');
    document.querySelectorAll('[data-consult-whatsapp]').forEach(link => { link.hidden = !whatsapp; link.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hello Baba Luxury Cars, I’d like a one-to-one call to find the right car for me.')}`; });
  }
  renderContact();

  document.querySelectorAll('[data-lead-form]').forEach(form => {
    const submit = form.querySelector('[type=submit]');
    // The page can answer a request's outcome (the consultation's card is
    // sealed, the seller's record marked): 'sent', 'prepared' or 'failed',
    // told before a sent form is cleared.
    const announce = (status, data) => form.dispatchEvent(new CustomEvent('lead:result', { detail: { status, data } }));
    // A field people never see: forms that fill it are robots.
    const trap = Object.assign(document.createElement('input'), { type: 'text', name: 'company', tabIndex: -1, autocomplete: 'off' });
    trap.className = 'form-trap'; trap.setAttribute('aria-hidden', 'true');
    form.prepend(trap);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const type = form.dataset.leadForm;
      const { company, ...data } = Object.fromEntries(new FormData(form));
      const result = form.querySelector('.form-result'); result.hidden = false; result.replaceChildren();
      const heading = document.createElement('p'); result.append(heading);
      if (live) {
        submit.disabled = true; heading.textContent = 'Sending your enquiry…';
        try {
          if (!company) await saveEnquiry(type, data);
          heading.textContent = { valuation: 'Thank you. Your car’s details have reached us, and we’ll call you about its valuation shortly.', consultation: 'Thank you. Your request has reached us, and we’ll call you to confirm a time for your consultation.' }[type] || 'Thank you. Your enquiry has reached us, and we’ll get back to you shortly.';
          if (dealer.whatsapp) { const link = document.createElement('a'); link.className = 'text-link'; link.textContent = 'Or message us on WhatsApp now'; link.href = `https://wa.me/${dealer.whatsapp.replace(/\D/g, '')}`; link.target = '_blank'; link.rel = 'noopener'; const actions = document.createElement('div'); actions.className = 'result-actions'; actions.append(link); result.append(actions); }
          announce('sent', data); form.reset(); form.dispatchEvent(new Event('input')); result.focus(); return;
        } catch {
          heading.textContent = 'We couldn’t send this just now. Your details are still here: share them below, or try again.'; announce('failed', data);
        } finally { submit.disabled = false; }
      } else if (dealer.enquiryEndpoint) {
        submit.disabled = true; heading.textContent = 'Sending your enquiry…';
        try {
          const endpoint = safeURL(dealer.enquiryEndpoint);
          if (!endpoint) throw new Error('Invalid endpoint');
          const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type, ...data }), signal:AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error('Request failed');
          heading.textContent = 'Your enquiry has been sent. We’ll use the details provided to get in touch.'; announce('sent', data); form.reset(); result.focus(); return;
        } catch {
          heading.textContent = 'We couldn’t send this enquiry. Your details are still here. Please try again, or save the enquiry below.'; announce('failed', data);
        } finally { submit.disabled = false; }
      } else {
        heading.textContent = hasContact() ? 'Your enquiry is ready. Choose how you would like to share it.' : 'Your enquiry is ready to save. Online delivery is not connected yet, so nothing has been sent.';
      }
      const labels = {vehicle:'Vehicle',year:'Year',city:'City',registration:'Registration',kilometres:'Kilometres',owners:'Owners',care:'Care record',name:'Name',phone:'Phone',exchange:'Exchange',interest:'Interested in',message:'Message',callVia:'Call by',day:'Day',when:'Best time',budget:'Budget'};
      const brand = `${dealer.name === 'BABA' ? 'Baba' : dealer.name} ${dealer.descriptor}`;
      const draft = [`${brand} — ${{ valuation: 'Valuation enquiry', consultation: 'One-to-one consultation request' }[type] || 'Vehicle enquiry'}`, '', ...Object.entries(data).filter(([,v])=>String(v).trim()).map(([key,value])=>`${labels[key] || key}: ${key==='exchange'?'Yes':String(value).trim()}`)].join('\n');
      const pre = document.createElement('pre'); pre.textContent = draft; result.append(pre);
      const actions = document.createElement('div'); actions.className='result-actions'; result.append(actions);
      const action = (label, href, handler) => { const el=document.createElement(href?'a':'button'); el.className='text-link'; el.textContent=label; if(href){el.href=href;el.target='_blank';el.rel='noopener';} else {el.type='button';el.addEventListener('click',handler);} actions.append(el); return el; };
      if(dealer.whatsapp) action('Share on WhatsApp', `https://wa.me/${dealer.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(draft)}`);
      if(dealer.email) action('Open email', `mailto:${dealer.email}?subject=${encodeURIComponent(`${brand} ${type} enquiry`)}&body=${encodeURIComponent(draft)}`);
      action('Copy enquiry', null, async e => {
        try { await navigator.clipboard.writeText(draft); e.currentTarget.textContent='Copied'; }
        catch { const selection=window.getSelection(); const range=document.createRange(); range.selectNodeContents(pre); selection.removeAllRanges();selection.addRange(range);heading.textContent='Enquiry selected. Use your browser’s Copy command.'; }
      });
      action('Download enquiry', null, () => { const url=URL.createObjectURL(new Blob([draft],{type:'text/plain;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download=`baba-${type}-enquiry.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); });
      announce('prepared', data);
      result.focus();
    });
  });
  return { openEnquiry, renderContact };
}
