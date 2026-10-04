import { dealer } from './config.js';
import { safeURL } from './inventory.js';

export function setupForms() {
  const enquiry = document.querySelector('#enquiry-dialog');
  const hasContact = Boolean(dealer.whatsapp || dealer.email);
  function openEnquiry(subject = '') {
    document.querySelector('#enquiry-subject').value = subject;
    const result = enquiry.querySelector('.form-result'); result.hidden = true; result.replaceChildren();
    enquiry.showModal();
  }
  document.querySelectorAll('[data-enquire]').forEach(button => button.addEventListener('click', () => openEnquiry(button.dataset.subject || '')));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close(); });
  });
  document.querySelector('#privacy-button').addEventListener('click', () => document.querySelector('#privacy-dialog').showModal());
  if (dealer.enquiryEndpoint) document.querySelector('#privacy-delivery').textContent = 'When you submit an enquiry, the details you enter are sent to the dealership to respond to your request. They are not saved in this browser.';
  else if (hasContact) document.querySelector('#privacy-delivery').textContent = 'Your enquiry is prepared in this browser. You choose whether to share it using the dealership’s email or WhatsApp contact. It is not sent automatically.';
  const contactDetails = document.querySelector('#contact-details');
  const addContact = (text, href) => { const element = document.createElement(href ? 'a' : 'span'); element.textContent = text; if(href) element.href = href; contactDetails.append(element); };
  if (dealer.phone) addContact(dealer.phone, `tel:${dealer.phone.replace(/[^+\d]/g,'')}`);
  if (dealer.email) addContact(dealer.email, `mailto:${dealer.email}`);
  if (dealer.address) addContact(dealer.address);

  document.querySelectorAll('[data-lead-form]').forEach(form => {
    const submit = form.querySelector('[type=submit]');
    if (dealer.enquiryEndpoint) form.querySelector('[data-submit-label]').textContent = form.dataset.leadForm === 'valuation' ? 'Request a valuation' : 'Send enquiry';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const type = form.dataset.leadForm;
      const data = Object.fromEntries(new FormData(form));
      const result = form.querySelector('.form-result'); result.hidden = false; result.replaceChildren();
      const heading = document.createElement('p'); result.append(heading);
      if (dealer.enquiryEndpoint) {
        submit.disabled = true; heading.textContent = 'Sending your enquiry…';
        try {
          const endpoint = safeURL(dealer.enquiryEndpoint);
          if (!endpoint) throw new Error('Invalid endpoint');
          const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type, ...data }), signal:AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error('Request failed');
          heading.textContent = 'Your enquiry has been sent. We’ll use the details provided to get in touch.'; form.reset(); result.focus(); return;
        } catch {
          heading.textContent = 'We couldn’t send this enquiry. Your details are still here. Please try again, or save the enquiry below.';
        } finally { submit.disabled = false; }
      } else {
        heading.textContent = hasContact ? 'Your enquiry is ready. Choose how you would like to share it.' : 'Your enquiry is ready to save. Online delivery is not connected yet, so nothing has been sent.';
      }
      const labels = {vehicle:'Vehicle',registration:'Registration',kilometres:'Kilometres',name:'Name',phone:'Phone',exchange:'Exchange',interest:'Interested in',message:'Message'};
      const draft = [`${dealer.name} — ${type==='valuation'?'Valuation enquiry':'Vehicle enquiry'}`, '', ...Object.entries(data).filter(([,v])=>String(v).trim()).map(([key,value])=>`${labels[key] || key}: ${key==='exchange'?'Yes':String(value).trim()}`)].join('\n');
      const pre = document.createElement('pre'); pre.textContent = draft; result.append(pre);
      const actions = document.createElement('div'); actions.className='result-actions'; result.append(actions);
      const action = (label, href, handler) => { const el=document.createElement(href?'a':'button'); el.className='text-link'; el.textContent=label; if(href){el.href=href;el.target='_blank';el.rel='noopener';} else {el.type='button';el.addEventListener('click',handler);} actions.append(el); return el; };
      if(dealer.whatsapp) action('Share on WhatsApp', `https://wa.me/${dealer.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(draft)}`);
      if(dealer.email) action('Open email', `mailto:${dealer.email}?subject=${encodeURIComponent(`${dealer.name} ${type} enquiry`)}&body=${encodeURIComponent(draft)}`);
      action('Copy enquiry', null, async e => {
        try { await navigator.clipboard.writeText(draft); e.currentTarget.textContent='Copied'; }
        catch { const selection=window.getSelection(); const range=document.createRange(); range.selectNodeContents(pre); selection.removeAllRanges();selection.addRange(range);heading.textContent='Enquiry selected. Use your browser’s Copy command.'; }
      });
      action('Download enquiry', null, () => { const url=URL.createObjectURL(new Blob([draft],{type:'text/plain;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download=`baba-${type}-enquiry.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); });
      result.focus();
    });
  });
  return { openEnquiry };
}
